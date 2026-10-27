package api

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"

	"wayfarer/api/internal/auth"
	"wayfarer/api/internal/store"
	"wayfarer/api/internal/validate"
)

var itemKinds = map[string]bool{
	"place": true, "activity": true, "meal": true, "transport": true, "stay": true, "note": true,
}

var edgeModes = map[string]bool{
	"walk": true, "transit": true, "train": true, "bus": true, "ferry": true,
	"bike": true, "car": true, "flight": true, "other": true,
}

func (s *Server) handleGetItinerary(w http.ResponseWriter, r *http.Request) {
	tripID := chi.URLParam(r, "tripID")
	if _, err := s.authorizeTrip(r, tripID, string(auth.ActionReadTrip)); err != nil {
		s.writeError(w, r, err)
		return
	}
	days, err := s.store.GetItinerary(r.Context(), tripID)
	if err != nil {
		s.writeError(w, r, err)
		return
	}
	writeData(w, http.StatusOK, map[string]any{"days": days})
}

func (s *Server) handleUpdateDay(w http.ResponseWriter, r *http.Request) {
	tripID := chi.URLParam(r, "tripID")
	if _, err := s.authorizeTrip(r, tripID, string(auth.ActionEditContent)); err != nil {
		s.writeError(w, r, err)
		return
	}
	var body struct {
		Title   string `json:"title"`
		Version int    `json:"version"`
	}
	if err := decodeJSON(w, r, &body); err != nil {
		s.writeError(w, r, err)
		return
	}
	title, err := validate.Optional(body.Title, "title", 120)
	if err != nil {
		s.writeError(w, r, err)
		return
	}
	if body.Version <= 0 {
		s.writeError(w, r, validationError("version", "Version is required."))
		return
	}
	if err := s.store.UpdateDay(r.Context(), tripID, chi.URLParam(r, "dayID"), title, body.Version); err != nil {
		s.writeError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) handleCreateItem(w http.ResponseWriter, r *http.Request) {
	tripID := chi.URLParam(r, "tripID")
	if _, err := s.authorizeTrip(r, tripID, string(auth.ActionEditContent)); err != nil {
		s.writeError(w, r, err)
		return
	}
	var in store.ItemInput
	if err := decodeJSON(w, r, &in); err != nil {
		s.writeError(w, r, err)
		return
	}
	in.DayID = chi.URLParam(r, "dayID")
	in, err := sanitizeItem(in)
	if err != nil {
		s.writeError(w, r, err)
		return
	}
	item, err := s.store.CreateItem(r.Context(), tripID, s.user(r).ID, in)
	if err != nil {
		s.writeError(w, r, err)
		return
	}
	writeData(w, http.StatusCreated, item)
}

func (s *Server) handleUpdateItem(w http.ResponseWriter, r *http.Request) {
	tripID := chi.URLParam(r, "tripID")
	if _, err := s.authorizeTrip(r, tripID, string(auth.ActionEditContent)); err != nil {
		s.writeError(w, r, err)
		return
	}
	var in store.ItemInput
	if err := decodeJSON(w, r, &in); err != nil {
		s.writeError(w, r, err)
		return
	}
	in, err := sanitizeItem(in)
	if err != nil {
		s.writeError(w, r, err)
		return
	}
	if in.Version <= 0 {
		s.writeError(w, r, validationError("version", "Version is required."))
		return
	}
	item, err := s.store.UpdateItem(r.Context(), tripID, chi.URLParam(r, "itemID"), in)
	if err != nil {
		s.writeError(w, r, err)
		return
	}
	writeData(w, http.StatusOK, item)
}

func (s *Server) handleDeleteItem(w http.ResponseWriter, r *http.Request) {
	tripID := chi.URLParam(r, "tripID")
	if _, err := s.authorizeTrip(r, tripID, string(auth.ActionEditContent)); err != nil {
		s.writeError(w, r, err)
		return
	}
	version, _ := strconv.Atoi(r.URL.Query().Get("version"))
	if err := s.store.DeleteItem(r.Context(), tripID, chi.URLParam(r, "itemID"), version); err != nil {
		s.writeError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func sanitizeItem(in store.ItemInput) (store.ItemInput, error) {
	var err error
	if strings.TrimSpace(in.DayID) == "" {
		return in, validationError("day_id", "Choose a day.")
	}
	if in.Title, err = validate.Required(in.Title, "title", 160); err != nil {
		return in, err
	}
	in.Kind = strings.TrimSpace(in.Kind)
	if !itemKinds[in.Kind] {
		in.Kind = "activity"
	}
	if in.LocationName, err = validate.Optional(in.LocationName, "location_name", 200); err != nil {
		return in, err
	}
	if in.Address, err = validate.Optional(in.Address, "address", 500); err != nil {
		return in, err
	}
	if err := validate.Coordinates(&in.Latitude, &in.Longitude); err != nil {
		return in, err
	}
	if !in.HasCoordinates {
		in.Latitude, in.Longitude = 0, 0
	}
	if in.StartTime, err = validate.TimeValue(in.StartTime, "start_time"); err != nil {
		return in, err
	}
	if in.EndTime, err = validate.TimeValue(in.EndTime, "end_time"); err != nil {
		return in, err
	}
	if in.StartTime != "" && in.EndTime != "" && in.EndTime < in.StartTime {
		return in, validationError("end_time", "The end time must be after the start time.")
	}
	if in.Notes, err = validate.Optional(in.Notes, "notes", 4000); err != nil {
		return in, err
	}
	if in.CostMinor < 0 {
		return in, validationError("cost_minor", "Cost cannot be negative.")
	}
	if in.CostMinor > 0 {
		if in.Currency, err = validate.Currency(in.Currency); err != nil {
			return in, err
		}
	} else {
		in.Currency = ""
	}
	if in.Link, err = validate.URLOrEmpty(in.Link, "link"); err != nil {
		return in, err
	}
	if in.PosX < -100000 || in.PosX > 100000 || in.PosY < -100000 || in.PosY > 100000 {
		return in, validationError("position", "Canvas position is out of range.")
	}
	if in.SortOrder < 0 {
		return in, validationError("sort_order", "Order cannot be negative.")
	}
	return in, nil
}

func (s *Server) handleCreateEdge(w http.ResponseWriter, r *http.Request) {
	tripID := chi.URLParam(r, "tripID")
	if _, err := s.authorizeTrip(r, tripID, string(auth.ActionEditContent)); err != nil {
		s.writeError(w, r, err)
		return
	}
	var in store.EdgeInput
	if err := decodeJSON(w, r, &in); err != nil {
		s.writeError(w, r, err)
		return
	}
	in.DayID = chi.URLParam(r, "dayID")
	in, err := sanitizeEdge(in)
	if err != nil {
		s.writeError(w, r, err)
		return
	}
	edge, err := s.store.CreateEdge(r.Context(), tripID, in)
	if err != nil {
		s.writeError(w, r, err)
		return
	}
	writeData(w, http.StatusCreated, edge)
}

func (s *Server) handleUpdateEdge(w http.ResponseWriter, r *http.Request) {
	tripID := chi.URLParam(r, "tripID")
	if _, err := s.authorizeTrip(r, tripID, string(auth.ActionEditContent)); err != nil {
		s.writeError(w, r, err)
		return
	}
	var in store.EdgeInput
	if err := decodeJSON(w, r, &in); err != nil {
		s.writeError(w, r, err)
		return
	}
	in, err := sanitizeEdge(in)
	if err != nil {
		s.writeError(w, r, err)
		return
	}
	if in.Version <= 0 {
		s.writeError(w, r, validationError("version", "Version is required."))
		return
	}
	edge, err := s.store.UpdateEdge(r.Context(), tripID, chi.URLParam(r, "edgeID"), in)
	if err != nil {
		s.writeError(w, r, err)
		return
	}
	writeData(w, http.StatusOK, edge)
}

func (s *Server) handleDeleteEdge(w http.ResponseWriter, r *http.Request) {
	tripID := chi.URLParam(r, "tripID")
	if _, err := s.authorizeTrip(r, tripID, string(auth.ActionEditContent)); err != nil {
		s.writeError(w, r, err)
		return
	}
	version, _ := strconv.Atoi(r.URL.Query().Get("version"))
	if err := s.store.DeleteEdge(r.Context(), tripID, chi.URLParam(r, "edgeID"), version); err != nil {
		s.writeError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func sanitizeEdge(in store.EdgeInput) (store.EdgeInput, error) {
	var err error
	if strings.TrimSpace(in.DayID) == "" {
		return in, validationError("day_id", "Choose a day.")
	}
	if strings.TrimSpace(in.FromItemID) == "" || strings.TrimSpace(in.ToItemID) == "" {
		return in, validationError("items", "Choose two stops for this leg.")
	}
	in.Mode = strings.TrimSpace(in.Mode)
	if !edgeModes[in.Mode] {
		return in, validationError("mode", "Choose a travel mode.")
	}
	if in.DurationMinutes < 0 || in.DurationMinutes > 100000 {
		return in, validationError("duration_minutes", "Duration is out of range.")
	}
	if in.DistanceKM < 0 || in.DistanceKM > 100000 {
		return in, validationError("distance_km", "Distance is out of range.")
	}
	if in.DepartTime, err = validate.TimeValue(in.DepartTime, "depart_time"); err != nil {
		return in, err
	}
	if in.ArriveTime, err = validate.TimeValue(in.ArriveTime, "arrive_time"); err != nil {
		return in, err
	}
	if in.Notes, err = validate.Optional(in.Notes, "notes", 2000); err != nil {
		return in, err
	}
	return in, nil
}
