package api

import (
	"net/http"

	"github.com/go-chi/chi/v5"

	"wayfarer/api/internal/auth"
	"wayfarer/api/internal/store"
	"wayfarer/api/internal/validate"
)

func (s *Server) handleListGroups(w http.ResponseWriter, r *http.Request) {
	tripID := chi.URLParam(r, "tripID")
	if _, err := s.authorizeTrip(r, tripID, string(auth.ActionReadTrip)); err != nil {
		s.writeError(w, r, err)
		return
	}
	groups, err := s.store.ListGroups(r.Context(), tripID)
	if err != nil {
		s.writeError(w, r, err)
		return
	}
	writeData(w, http.StatusOK, map[string]any{"items": groups})
}

func (s *Server) handleCreateGroup(w http.ResponseWriter, r *http.Request) {
	tripID := chi.URLParam(r, "tripID")
	if _, err := s.authorizeTrip(r, tripID, string(auth.ActionManageGroup)); err != nil {
		s.writeError(w, r, err)
		return
	}
	var in store.GroupInput
	if err := decodeJSON(w, r, &in); err != nil {
		s.writeError(w, r, err)
		return
	}
	in, err := sanitizeGroup(in)
	if err != nil {
		s.writeError(w, r, err)
		return
	}
	group, err := s.store.CreateGroup(r.Context(), tripID, in)
	if err != nil {
		s.writeError(w, r, err)
		return
	}
	writeData(w, http.StatusCreated, group)
}

func (s *Server) handleUpdateGroup(w http.ResponseWriter, r *http.Request) {
	tripID := chi.URLParam(r, "tripID")
	if _, err := s.authorizeTrip(r, tripID, string(auth.ActionManageGroup)); err != nil {
		s.writeError(w, r, err)
		return
	}
	var in store.GroupInput
	if err := decodeJSON(w, r, &in); err != nil {
		s.writeError(w, r, err)
		return
	}
	in, err := sanitizeGroup(in)
	if err != nil {
		s.writeError(w, r, err)
		return
	}
	if in.Version <= 0 {
		s.writeError(w, r, validationError("version", "Version is required."))
		return
	}
	group, err := s.store.UpdateGroup(r.Context(), tripID, chi.URLParam(r, "groupID"), in)
	if err != nil {
		s.writeError(w, r, err)
		return
	}
	writeData(w, http.StatusOK, group)
}

func (s *Server) handleDeleteGroup(w http.ResponseWriter, r *http.Request) {
	tripID := chi.URLParam(r, "tripID")
	if _, err := s.authorizeTrip(r, tripID, string(auth.ActionManageGroup)); err != nil {
		s.writeError(w, r, err)
		return
	}
	if err := s.store.DeleteGroup(r.Context(), tripID, chi.URLParam(r, "groupID")); err != nil {
		s.writeError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func sanitizeGroup(in store.GroupInput) (store.GroupInput, error) {
	var err error
	if in.Name, err = validate.Required(in.Name, "name", 80); err != nil {
		return in, err
	}
	if in.Color, err = validate.HexColor(in.Color); err != nil {
		return in, err
	}
	return in, nil
}
