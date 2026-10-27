package api

import (
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"wayfarer/api/internal/auth"
	"wayfarer/api/internal/store"
	"wayfarer/api/internal/validate"
)

func (s *Server) handleListNotes(w http.ResponseWriter, r *http.Request) {
	tripID := chi.URLParam(r, "tripID")
	if _, err := s.authorizeTrip(r, tripID, string(auth.ActionReadTrip)); err != nil {
		s.writeError(w, r, err)
		return
	}
	notes, err := s.store.ListNotes(r.Context(), tripID)
	if err != nil {
		s.writeError(w, r, err)
		return
	}
	writeData(w, http.StatusOK, map[string]any{"items": notes})
}

func (s *Server) handleGetNote(w http.ResponseWriter, r *http.Request) {
	tripID := chi.URLParam(r, "tripID")
	if _, err := s.authorizeTrip(r, tripID, string(auth.ActionReadTrip)); err != nil {
		s.writeError(w, r, err)
		return
	}
	note, err := s.store.GetNote(r.Context(), tripID, chi.URLParam(r, "noteID"))
	if err != nil {
		s.writeError(w, r, err)
		return
	}
	writeData(w, http.StatusOK, note)
}

func (s *Server) handleCreateNote(w http.ResponseWriter, r *http.Request) {
	tripID := chi.URLParam(r, "tripID")
	if _, err := s.authorizeTrip(r, tripID, string(auth.ActionEditContent)); err != nil {
		s.writeError(w, r, err)
		return
	}
	var in store.NoteInput
	if err := decodeJSON(w, r, &in); err != nil {
		s.writeError(w, r, err)
		return
	}
	in, err := sanitizeNote(in)
	if err != nil {
		s.writeError(w, r, err)
		return
	}
	note, err := s.store.CreateNote(r.Context(), tripID, s.user(r).ID, in)
	if err != nil {
		s.writeError(w, r, err)
		return
	}
	writeData(w, http.StatusCreated, note)
}

func (s *Server) handleUpdateNote(w http.ResponseWriter, r *http.Request) {
	tripID := chi.URLParam(r, "tripID")
	if _, err := s.authorizeTrip(r, tripID, string(auth.ActionEditContent)); err != nil {
		s.writeError(w, r, err)
		return
	}
	var in store.NoteInput
	if err := decodeJSON(w, r, &in); err != nil {
		s.writeError(w, r, err)
		return
	}
	in, err := sanitizeNote(in)
	if err != nil {
		s.writeError(w, r, err)
		return
	}
	if in.Version <= 0 {
		s.writeError(w, r, validationError("version", "Version is required."))
		return
	}
	note, err := s.store.UpdateNote(r.Context(), tripID, chi.URLParam(r, "noteID"), s.user(r).ID, in)
	if err != nil {
		s.writeError(w, r, err)
		return
	}
	writeData(w, http.StatusOK, note)
}

func (s *Server) handleDeleteNote(w http.ResponseWriter, r *http.Request) {
	tripID := chi.URLParam(r, "tripID")
	if _, err := s.authorizeTrip(r, tripID, string(auth.ActionEditContent)); err != nil {
		s.writeError(w, r, err)
		return
	}
	version, _ := strconv.Atoi(r.URL.Query().Get("version"))
	if err := s.store.DeleteNote(r.Context(), tripID, chi.URLParam(r, "noteID"), version); err != nil {
		s.writeError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func sanitizeNote(in store.NoteInput) (store.NoteInput, error) {
	var err error
	if in.Title, err = validate.Required(in.Title, "title", 200); err != nil {
		return in, err
	}
	if in.BodyMarkdown, err = validate.Optional(in.BodyMarkdown, "body_markdown", 100000); err != nil {
		return in, err
	}
	return in, nil
}
