package api

import (
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"wayfarer/api/internal/apperr"
	"wayfarer/api/internal/auth"
	"wayfarer/api/internal/store"
	"wayfarer/api/internal/validate"
)

func (s *Server) handleListTrips(w http.ResponseWriter, r *http.Request) {
	scope := strings.TrimSpace(r.URL.Query().Get("scope"))
	if scope == "" {
		scope = "owned"
	}
	trips, err := s.store.ListTrips(r.Context(), s.user(r).ID, scope)
	if err != nil {
		s.writeError(w, r, err)
		return
	}
	writeData(w, http.StatusOK, map[string]any{"items": trips})
}

func (s *Server) handleCreateTrip(w http.ResponseWriter, r *http.Request) {
	var in store.TripInput
	if err := decodeJSON(w, r, &in); err != nil {
		s.writeError(w, r, err)
		return
	}
	in, err := sanitizeTripInput(in)
	if err != nil {
		s.writeError(w, r, err)
		return
	}
	trip, err := s.store.CreateTrip(r.Context(), s.user(r).ID, in)
	if err != nil {
		s.writeError(w, r, err)
		return
	}
	writeData(w, http.StatusCreated, trip)
}

func (s *Server) handleGetTrip(w http.ResponseWriter, r *http.Request) {
	tripID := chi.URLParam(r, "tripID")
	if _, err := s.authorizeTrip(r, tripID, string(auth.ActionReadTrip)); err != nil {
		s.writeError(w, r, err)
		return
	}
	trip, err := s.store.GetTrip(r.Context(), tripID, s.user(r).ID)
	if err != nil {
		s.writeError(w, r, err)
		return
	}
	writeData(w, http.StatusOK, trip)
}

func (s *Server) handleUpdateTrip(w http.ResponseWriter, r *http.Request) {
	tripID := chi.URLParam(r, "tripID")
	if _, err := s.authorizeTrip(r, tripID, string(auth.ActionManageTrip)); err != nil {
		s.writeError(w, r, err)
		return
	}
	var in store.TripInput
	if err := decodeJSON(w, r, &in); err != nil {
		s.writeError(w, r, err)
		return
	}
	current, err := s.store.GetTrip(r.Context(), tripID, s.user(r).ID)
	if err != nil {
		s.writeError(w, r, err)
		return
	}
	if strings.TrimSpace(in.Status) == "" {
		in.Status = current.Status
	}
	in, err = sanitizeTripInput(in)
	if err != nil {
		s.writeError(w, r, err)
		return
	}
	if in.Version <= 0 {
		s.writeError(w, r, validationError("version", "Version is required."))
		return
	}
	trip, err := s.store.UpdateTrip(r.Context(), tripID, s.user(r).ID, in)
	if err != nil {
		s.writeError(w, r, err)
		return
	}
	writeData(w, http.StatusOK, trip)
}

func sanitizeTripInput(in store.TripInput) (store.TripInput, error) {
	var err error
	if in.Title, err = validate.Required(in.Title, "title", 160); err != nil {
		return in, err
	}
	if in.Destination, err = validate.Required(in.Destination, "destination", 160); err != nil {
		return in, err
	}
	if in.StartDate, err = validate.Date(in.StartDate, "start_date"); err != nil {
		return in, err
	}
	if in.EndDate, err = validate.Date(in.EndDate, "end_date"); err != nil {
		return in, err
	}
	start, _ := time.Parse("2006-01-02", in.StartDate)
	end, _ := time.Parse("2006-01-02", in.EndDate)
	if end.Before(start) {
		return in, validationError("end_date", "The end date must be on or after the start date.")
	}
	if int(end.Sub(start).Hours()/24)+1 > 366 {
		return in, validationError("end_date", "Trips can span at most 366 days.")
	}
	if in.Timezone, err = validate.Timezone(in.Timezone); err != nil {
		return in, err
	}
	if in.Currency, err = validate.Currency(in.Currency); err != nil {
		return in, err
	}
	if in.Description, err = validate.Optional(in.Description, "description", 4000); err != nil {
		return in, err
	}
	if in.CoverImageURL, err = validate.URLOrEmpty(in.CoverImageURL, "cover_image_url"); err != nil {
		return in, err
	}
	in.Status = strings.TrimSpace(in.Status)
	if in.Status == "" {
		in.Status = "active"
	}
	if in.Status != "active" && in.Status != "archived" {
		return in, validationError("status", "Status must be active or archived.")
	}
	return in, nil
}

func (s *Server) handleListMembers(w http.ResponseWriter, r *http.Request) {
	tripID := chi.URLParam(r, "tripID")
	if _, err := s.authorizeTrip(r, tripID, string(auth.ActionReadTrip)); err != nil {
		s.writeError(w, r, err)
		return
	}
	members, err := s.store.ListMembers(r.Context(), tripID)
	if err != nil {
		s.writeError(w, r, err)
		return
	}
	writeData(w, http.StatusOK, map[string]any{"items": members})
}

func (s *Server) handleUpdateMember(w http.ResponseWriter, r *http.Request) {
	tripID := chi.URLParam(r, "tripID")
	if _, err := s.authorizeTrip(r, tripID, string(auth.ActionManageMember)); err != nil {
		s.writeError(w, r, err)
		return
	}
	var body struct {
		Role string `json:"role"`
	}
	if err := decodeJSON(w, r, &body); err != nil {
		s.writeError(w, r, err)
		return
	}
	if body.Role != "editor" && body.Role != "viewer" {
		s.writeError(w, r, validationError("role", "Role must be editor or viewer."))
		return
	}
	if err := s.store.UpdateMemberRole(r.Context(), tripID, chi.URLParam(r, "userID"), body.Role); err != nil {
		s.writeError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) handleRemoveMember(w http.ResponseWriter, r *http.Request) {
	tripID := chi.URLParam(r, "tripID")
	if _, err := s.authorizeTrip(r, tripID, string(auth.ActionManageMember)); err != nil {
		s.writeError(w, r, err)
		return
	}
	if err := s.store.RemoveMember(r.Context(), tripID, chi.URLParam(r, "userID")); err != nil {
		if !apperr.Is(err, apperr.ErrConflict) {
			s.writeError(w, r, err)
			return
		}
		s.writeError(w, r, apperr.ErrConflict)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
