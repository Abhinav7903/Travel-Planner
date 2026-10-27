package api

import (
	"context"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"wayfarer/api/internal/apperr"
	"wayfarer/api/internal/auth"
	"wayfarer/api/internal/store"
	"wayfarer/api/internal/validate"
)

func (s *Server) handleListInvitations(w http.ResponseWriter, r *http.Request) {
	tripID := chi.URLParam(r, "tripID")
	if _, err := s.authorizeTrip(r, tripID, string(auth.ActionInvite)); err != nil {
		s.writeError(w, r, err)
		return
	}
	items, err := s.store.ListInvitations(r.Context(), tripID)
	if err != nil {
		s.writeError(w, r, err)
		return
	}
	writeData(w, http.StatusOK, map[string]any{"items": items})
}

func (s *Server) handleCreateInvitation(w http.ResponseWriter, r *http.Request) {
	tripID := chi.URLParam(r, "tripID")
	if _, err := s.authorizeTrip(r, tripID, string(auth.ActionInvite)); err != nil {
		s.writeError(w, r, err)
		return
	}
	var body struct {
		Email string `json:"email"`
		Role  string `json:"role"`
	}
	if err := decodeJSON(w, r, &body); err != nil {
		s.writeError(w, r, err)
		return
	}
	email, err := validate.Email(body.Email)
	if err != nil {
		s.writeError(w, r, err)
		return
	}
	if body.Role != "editor" && body.Role != "viewer" {
		s.writeError(w, r, validationError("role", "Role must be editor or viewer."))
		return
	}
	token, tokenHash, err := auth.NewOpaqueToken()
	if err != nil {
		s.writeError(w, r, err)
		return
	}
	expiresAt := s.now().Add(s.cfg.InviteTTL)
	inv, err := s.store.CreateInvitation(r.Context(), tripID, s.user(r).ID, email, body.Role, tokenHash, expiresAt)
	if err != nil {
		s.writeError(w, r, err)
		return
	}
	inv.InviteURL = s.inviteURL(token)
	title, _ := s.store.TripTitle(r.Context(), tripID)
	s.sendInvitation(r.Context(), &inv, title, email, token, expiresAt, s.user(r).DisplayName)
	writeData(w, http.StatusCreated, inv)
}

func (s *Server) handleResendInvitation(w http.ResponseWriter, r *http.Request) {
	tripID := chi.URLParam(r, "tripID")
	if _, err := s.authorizeTrip(r, tripID, string(auth.ActionInvite)); err != nil {
		s.writeError(w, r, err)
		return
	}
	token, tokenHash, err := auth.NewOpaqueToken()
	if err != nil {
		s.writeError(w, r, err)
		return
	}
	expiresAt := s.now().Add(s.cfg.InviteTTL)
	inv, err := s.store.ResendInvitation(r.Context(), tripID, chi.URLParam(r, "invitationID"), tokenHash, expiresAt)
	if err != nil {
		s.writeError(w, r, err)
		return
	}
	inv.InviteURL = s.inviteURL(token)
	title, _ := s.store.TripTitle(r.Context(), tripID)
	s.sendInvitation(r.Context(), &inv, title, inv.Email, token, expiresAt, s.user(r).DisplayName)
	writeData(w, http.StatusOK, inv)
}

func (s *Server) handleRevokeInvitation(w http.ResponseWriter, r *http.Request) {
	tripID := chi.URLParam(r, "tripID")
	if _, err := s.authorizeTrip(r, tripID, string(auth.ActionInvite)); err != nil {
		s.writeError(w, r, err)
		return
	}
	if err := s.store.RevokeInvitation(r.Context(), tripID, chi.URLParam(r, "invitationID")); err != nil {
		s.writeError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) handleInvitationPreview(w http.ResponseWriter, r *http.Request) {
	token := chi.URLParam(r, "token")
	if token == "" || len(token) > 200 {
		s.writeError(w, r, apperr.ErrNotFound)
		return
	}
	preview, _, err := s.store.PreviewInvitation(r.Context(), auth.HashToken(token))
	if err != nil {
		s.writeError(w, r, err)
		return
	}
	writeData(w, http.StatusOK, preview)
}

func (s *Server) handleAcceptInvitation(w http.ResponseWriter, r *http.Request) {
	token := chi.URLParam(r, "token")
	if token == "" || len(token) > 200 {
		s.writeError(w, r, apperr.ErrNotFound)
		return
	}
	user := s.user(r)
	result, err := s.store.AcceptInvitation(r.Context(), auth.HashToken(token), user.ID, user.Email)
	if err != nil {
		s.writeError(w, r, err)
		return
	}
	writeData(w, http.StatusOK, result)
}

func (s *Server) inviteURL(token string) string {
	return strings.TrimRight(s.cfg.PublicWebURL, "/") + "/invite/" + url.PathEscape(token)
}

func (s *Server) sendInvitation(ctx context.Context, inv *store.Invitation, tripTitle, email, token string, expiresAt time.Time, inviter string) {
	mailCtx, cancel := context.WithTimeout(ctx, 12*time.Second)
	defer cancel()
	if err := s.mailer.SendInvitation(mailCtx, email, inviter, tripTitle, inv.Role, s.inviteURL(token), expiresAt); err != nil {
		s.log.Error("invitation email failed", "request_id", requestID(ctx), "invitation_id", inv.ID, "error", err)
		inv.EmailSent = false
		inv.Warning = "The invitation was saved, but the email could not be sent. Share the invite link manually."
		return
	}
	inv.EmailSent = true
	if s.cfg.DevMailSink() {
		inv.Warning = "Development mail sink: copy the invite link to test the acceptance flow."
	}
}
