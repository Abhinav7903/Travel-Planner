package api

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"

	"wayfarer/api/internal/apperr"
	"wayfarer/api/internal/auth"
	"wayfarer/api/internal/store"
	"wayfarer/api/internal/validate"
)

type otpRequestBody struct {
	Email string `json:"email"`
}

type otpVerifyBody struct {
	Email string `json:"email"`
	Code  string `json:"code"`
}

func (s *Server) handleOTPRequest(w http.ResponseWriter, r *http.Request) {
	var body otpRequestBody
	if err := decodeJSON(w, r, &body); err != nil {
		s.writeError(w, r, err)
		return
	}
	email, err := validate.Email(body.Email)
	if err != nil {
		s.writeError(w, r, err)
		return
	}
	code, err := auth.GenerateOTP()
	if err != nil {
		s.writeError(w, r, err)
		return
	}
	challengeID := uuid.NewString()
	expiresAt := s.now().Add(s.cfg.OTPTTL)
	digest := auth.DigestOTP(s.cfg.OTPHMACSecret, challengeID, code)
	err = s.store.CreateOTPChallenge(r.Context(), challengeID, email, digest, expiresAt,
		s.clientIP(r), s.cfg.OTPCooldown, s.cfg.OTPEmailLimit, s.cfg.OTPIPLimit)
	if err != nil {
		s.auditAuth(r, "otp_request_failed", "failure", email, "", auditReason(err))
		s.writeError(w, r, err)
		return
	}

	mailCtx, cancel := context.WithTimeout(r.Context(), 12*time.Second)
	defer cancel()
	if err := s.mailer.SendOTP(mailCtx, email, code, expiresAt); err != nil {
		s.log.Error("otp email failed", "request_id", requestID(r.Context()), "error", err)
		s.auditAuth(r, "otp_request_failed", "failure", email, "", "mail_failed")
		s.writeError(w, r, apperr.New(502, "mail_failed", "We could not send the code. Please try again in a minute."))
		return
	}
	s.auditAuth(r, "otp_requested", "success", email, "", "")

	resp := map[string]any{
		"status":     "sent",
		"expires_at": expiresAt.UTC(),
	}
	if s.cfg.DevMailSink() {
		resp["dev_code"] = code
		resp["dev_notice"] = "Development mail sink: this code is shown only because MAIL_MODE=dev."
	}
	writeData(w, http.StatusAccepted, resp)
}

func (s *Server) handleOTPVerify(w http.ResponseWriter, r *http.Request) {
	var body otpVerifyBody
	if err := decodeJSON(w, r, &body); err != nil {
		s.writeError(w, r, err)
		return
	}
	email, err := validate.Email(body.Email)
	if err != nil {
		s.writeError(w, r, err)
		return
	}
	code := strings.TrimSpace(body.Code)
	if len(code) != 6 || strings.Trim(code, "0123456789") != "" {
		s.writeError(w, r, validationError("code", "Enter the six-digit code."))
		return
	}

	sessionToken, sessionHash, err := auth.NewOpaqueToken()
	if err != nil {
		s.writeError(w, r, err)
		return
	}
	csrfToken, _, err := auth.NewOpaqueToken()
	if err != nil {
		s.writeError(w, r, err)
		return
	}
	ua := r.UserAgent()
	if len(ua) > 500 {
		ua = ua[:500]
	}
	user, err := s.store.VerifyOTP(r.Context(), email,
		func(challengeID string) []byte {
			return auth.DigestOTP(s.cfg.OTPHMACSecret, challengeID, code)
		},
		sessionHash, s.now().Add(s.cfg.SessionTTL), s.clientIP(r), ua)
	if err != nil {
		s.auditAuth(r, "otp_verify_failed", "failure", email, "", auditReason(err))
		s.writeError(w, r, err)
		return
	}
	s.auditAuth(r, "login_succeeded", "success", email, user.ID, "")
	s.setSessionCookie(w, sessionToken, int(s.cfg.SessionTTL.Seconds()))
	s.setCSRFCookie(w, csrfToken, int(s.cfg.SessionTTL.Seconds()))
	writeData(w, http.StatusOK, map[string]any{"user": user})
}

func (s *Server) handleMe(w http.ResponseWriter, r *http.Request) {
	if _, err := r.Cookie(csrfCookie); err != nil {
		token, _, tokenErr := auth.NewOpaqueToken()
		if tokenErr == nil {
			s.setCSRFCookie(w, token, int(s.cfg.SessionTTL.Seconds()))
		}
	}
	writeData(w, http.StatusOK, map[string]any{"user": s.user(r)})
}

func (s *Server) handleLogout(w http.ResponseWriter, r *http.Request) {
	user := s.user(r)
	if c, err := r.Cookie(sessionCookie); err == nil && c.Value != "" {
		if err := s.store.RevokeSession(r.Context(), auth.HashToken(c.Value)); err != nil {
			s.writeError(w, r, err)
			return
		}
	}
	s.auditAuth(r, "logout", "success", user.Email, user.ID, "")
	s.clearAuthCookies(w)
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) setSessionCookie(w http.ResponseWriter, value string, maxAge int) {
	http.SetCookie(w, &http.Cookie{
		Name:     sessionCookie,
		Value:    value,
		Path:     "/",
		HttpOnly: true,
		Secure:   s.cfg.IsProduction(),
		SameSite: http.SameSiteLaxMode,
		MaxAge:   maxAge,
		Expires:  s.now().Add(time.Duration(maxAge) * time.Second),
	})
}

func (s *Server) setCSRFCookie(w http.ResponseWriter, value string, maxAge int) {
	http.SetCookie(w, &http.Cookie{
		Name:     csrfCookie,
		Value:    value,
		Path:     "/",
		HttpOnly: false,
		Secure:   s.cfg.IsProduction(),
		SameSite: http.SameSiteLaxMode,
		MaxAge:   maxAge,
		Expires:  s.now().Add(time.Duration(maxAge) * time.Second),
	})
}

func (s *Server) clearAuthCookies(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{Name: sessionCookie, Value: "", Path: "/", HttpOnly: true, Secure: s.cfg.IsProduction(), SameSite: http.SameSiteLaxMode, MaxAge: -1, Expires: time.Unix(0, 0)})
	http.SetCookie(w, &http.Cookie{Name: csrfCookie, Value: "", Path: "/", HttpOnly: false, Secure: s.cfg.IsProduction(), SameSite: http.SameSiteLaxMode, MaxAge: -1, Expires: time.Unix(0, 0)})
}

func (s *Server) auditAuth(r *http.Request, event, outcome, email, userID, reason string) {
	userAgent := r.UserAgent()
	if len(userAgent) > 500 {
		userAgent = userAgent[:500]
	}
	err := s.store.RecordAuthAudit(r.Context(), store.AuthAuditEvent{
		Event:     event,
		Outcome:   outcome,
		Email:     email,
		UserID:    userID,
		IP:        s.clientIP(r),
		UserAgent: userAgent,
		Reason:    reason,
		RequestID: requestID(r.Context()),
	})
	if err != nil {
		s.log.Error("auth audit write failed", "request_id", requestID(r.Context()), "event", event, "error", err)
	}
}

func auditReason(err error) string {
	var apiErr *apperr.Error
	if errors.As(err, &apiErr) {
		return apiErr.Code
	}
	return "internal_error"
}
