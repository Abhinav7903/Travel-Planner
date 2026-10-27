package api

import (
	"context"
	"crypto/subtle"
	"encoding/json"
	"errors"
	"log/slog"
	"net"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"wayfarer/api/internal/apperr"
	"wayfarer/api/internal/auth"
	"wayfarer/api/internal/config"
	"wayfarer/api/internal/mail"
	"wayfarer/api/internal/maplink"
	"wayfarer/api/internal/store"
)

const (
	sessionCookie = "wf_session"
	csrfCookie    = "wf_csrf"
	csrfHeader    = "X-CSRF-Token"
	maxBodyBytes  = 1 << 20
)

type ctxKey string

const (
	ctxUser      ctxKey = "user"
	ctxRequestID ctxKey = "request_id"
)

type Server struct {
	cfg        config.Config
	store      *store.Store
	mailer     mail.Mailer
	log        *slog.Logger
	now        func() time.Time
	mapLinks   mapLinkResolver
	mapLimiter *fixedWindowLimiter
}

func New(cfg config.Config, st *store.Store, mailer mail.Mailer, logger *slog.Logger) *Server {
	now := time.Now
	return &Server{
		cfg:        cfg,
		store:      st,
		mailer:     mailer,
		log:        logger,
		now:        now,
		mapLinks:   maplink.New(&http.Client{Timeout: 8 * time.Second}),
		mapLimiter: newFixedWindowLimiter(10, time.Minute, now),
	}
}

func (s *Server) Router() http.Handler {
	r := chi.NewRouter()
	r.Use(s.requestID)
	r.Use(s.requestLogger)
	r.Use(s.recoverer)
	r.Use(s.bodyLimit)
	r.Use(s.timeout)

	r.Get("/healthz", s.handleHealth)
	r.Get("/readyz", s.handleReady)

	r.Route("/v1", func(r chi.Router) {
		r.Use(s.internalAuth)
		r.Post("/auth/otp/request", s.handleOTPRequest)
		r.Post("/auth/otp/verify", s.handleOTPVerify)
		r.Get("/invitations/{token}", s.handleInvitationPreview)

		r.Group(func(r chi.Router) {
			r.Use(s.authenticate)
			r.Use(s.csrfGuard)

			r.Get("/auth/me", s.handleMe)
			r.Post("/auth/logout", s.handleLogout)
			r.Post("/maps/resolve", s.handleResolveMapLink)

			r.Get("/trips", s.handleListTrips)
			r.Post("/trips", s.handleCreateTrip)
			r.Post("/invitations/{token}/accept", s.handleAcceptInvitation)

			r.Route("/trips/{tripID}", func(r chi.Router) {
				r.Get("/", s.handleGetTrip)
				r.Patch("/", s.handleUpdateTrip)
				r.Get("/members", s.handleListMembers)
				r.Patch("/members/{userID}", s.handleUpdateMember)
				r.Delete("/members/{userID}", s.handleRemoveMember)

				r.Get("/invitations", s.handleListInvitations)
				r.Post("/invitations", s.handleCreateInvitation)
				r.Post("/invitations/{invitationID}/resend", s.handleResendInvitation)
				r.Delete("/invitations/{invitationID}", s.handleRevokeInvitation)

				r.Get("/groups", s.handleListGroups)
				r.Post("/groups", s.handleCreateGroup)
				r.Patch("/groups/{groupID}", s.handleUpdateGroup)
				r.Delete("/groups/{groupID}", s.handleDeleteGroup)

				r.Get("/itinerary", s.handleGetItinerary)
				r.Patch("/days/{dayID}", s.handleUpdateDay)
				r.Post("/days/{dayID}/items", s.handleCreateItem)
				r.Patch("/items/{itemID}", s.handleUpdateItem)
				r.Delete("/items/{itemID}", s.handleDeleteItem)
				r.Post("/days/{dayID}/edges", s.handleCreateEdge)
				r.Patch("/edges/{edgeID}", s.handleUpdateEdge)
				r.Delete("/edges/{edgeID}", s.handleDeleteEdge)

				r.Get("/notes", s.handleListNotes)
				r.Post("/notes", s.handleCreateNote)
				r.Get("/notes/{noteID}", s.handleGetNote)
				r.Patch("/notes/{noteID}", s.handleUpdateNote)
				r.Delete("/notes/{noteID}", s.handleDeleteNote)

				r.Get("/expenses", s.handleListExpenses)
				r.Post("/expenses", s.handleCreateExpense)
				r.Patch("/expenses/{expenseID}", s.handleUpdateExpense)
				r.Delete("/expenses/{expenseID}", s.handleDeleteExpense)
				r.Get("/ledger", s.handleLedger)
				r.Get("/settlements", s.handleListSettlements)
				r.Post("/settlements", s.handleCreateSettlement)
			})
		})
	})
	return r
}

func (s *Server) requestID(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		id := strings.TrimSpace(r.Header.Get("X-Request-ID"))
		if id == "" || len(id) > 100 {
			id = uuid.NewString()
		}
		w.Header().Set("X-Request-ID", id)
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), ctxRequestID, id)))
	})
}

type statusWriter struct {
	http.ResponseWriter
	status int
}

func (w *statusWriter) WriteHeader(status int) {
	w.status = status
	w.ResponseWriter.WriteHeader(status)
}

func (s *Server) requestLogger(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		sw := &statusWriter{ResponseWriter: w, status: 200}
		next.ServeHTTP(sw, r)
		s.log.Info("request",
			"method", r.Method,
			"path", r.URL.Path,
			"status", sw.status,
			"duration_ms", time.Since(start).Milliseconds(),
			"request_id", requestID(r.Context()),
		)
	})
}

func (s *Server) recoverer(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if rec := recover(); rec != nil {
				s.log.Error("panic", "request_id", requestID(r.Context()), "panic", rec)
				writeError(w, r, apperr.ErrInternal)
			}
		}()
		next.ServeHTTP(w, r)
	})
}

func (s *Server) bodyLimit(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Body != nil && r.Method != http.MethodGet && r.Method != http.MethodHead {
			r.Body = http.MaxBytesReader(w, r.Body, maxBodyBytes)
		}
		next.ServeHTTP(w, r)
	})
}

func (s *Server) timeout(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 20*time.Second)
		defer cancel()
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func (s *Server) internalAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if s.cfg.InternalAPIToken == "" {
			next.ServeHTTP(w, r)
			return
		}
		provided := r.Header.Get("X-Internal-Token")
		if subtle.ConstantTimeCompare([]byte(provided), []byte(s.cfg.InternalAPIToken)) != 1 {
			writeError(w, r, apperr.New(401, "internal_auth_required", "This API is only available to the web application."))
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (s *Server) authenticate(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		c, err := r.Cookie(sessionCookie)
		if err != nil || c.Value == "" {
			writeError(w, r, apperr.ErrUnauthorized)
			return
		}
		user, err := s.store.GetSessionUser(r.Context(), auth.HashToken(c.Value))
		if err != nil {
			writeError(w, r, apperr.ErrUnauthorized)
			return
		}
		ctx := context.WithValue(r.Context(), ctxUser, user)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func (s *Server) csrfGuard(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet, http.MethodHead, http.MethodOptions:
			next.ServeHTTP(w, r)
			return
		}
		origin := strings.TrimRight(strings.TrimSpace(r.Header.Get("Origin")), "/")
		if origin != "" && !s.cfg.AllowedOriginSet[origin] {
			writeError(w, r, apperr.New(403, "origin_rejected", "This request came from an untrusted origin."))
			return
		}
		if origin == "" && s.cfg.IsProduction() {
			writeError(w, r, apperr.New(403, "origin_required", "This request could not be verified."))
			return
		}
		cookie, err := r.Cookie(csrfCookie)
		header := r.Header.Get(csrfHeader)
		if err != nil || cookie.Value == "" || header == "" ||
			subtle.ConstantTimeCompare([]byte(cookie.Value), []byte(header)) != 1 {
			writeError(w, r, apperr.New(403, "csrf_failed", "Your session could not be verified. Refresh and try again."))
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	writeData(w, http.StatusOK, map[string]any{"status": "ok", "service": "wayfarer-api"})
}

func (s *Server) handleReady(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
	defer cancel()
	if err := s.store.Ping(ctx); err != nil {
		writeData(w, http.StatusServiceUnavailable, map[string]any{"status": "unavailable"})
		return
	}
	writeData(w, http.StatusOK, map[string]any{"status": "ready"})
}

func (s *Server) user(r *http.Request) store.User {
	u, _ := r.Context().Value(ctxUser).(store.User)
	return u
}

func requestID(ctx context.Context) string {
	id, _ := ctx.Value(ctxRequestID).(string)
	return id
}

func (s *Server) clientIP(r *http.Request) string {
	if s.cfg.TrustProxyHeader {
		if v := strings.TrimSpace(r.Header.Get("X-Real-IP")); net.ParseIP(v) != nil {
			return v
		}
		if forwarded := r.Header.Get("X-Forwarded-For"); forwarded != "" {
			first := strings.TrimSpace(strings.Split(forwarded, ",")[0])
			if net.ParseIP(first) != nil {
				return first
			}
		}
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err == nil {
		return host
	}
	return ""
}

func decodeJSON(w http.ResponseWriter, r *http.Request, dst any) error {
	r.Body = http.MaxBytesReader(w, r.Body, maxBodyBytes)
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(dst); err != nil {
		var maxErr *http.MaxBytesError
		if errors.As(err, &maxErr) {
			return apperr.New(413, "body_too_large", "That request is too large.")
		}
		return apperr.New(400, "invalid_json", "The request body could not be read.")
	}
	return nil
}

func (s *Server) authorizeTrip(r *http.Request, tripID, action string) (string, error) {
	role, err := s.store.GetMembership(r.Context(), tripID, s.user(r).ID)
	if err != nil {
		return "", apperr.ErrNotFound
	}
	if !auth.Allowed(role, auth.Action(action)) {
		return "", apperr.ErrForbidden
	}
	return role, nil
}
