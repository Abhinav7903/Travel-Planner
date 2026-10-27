package api

import (
	"context"
	"errors"
	"net/http"

	"wayfarer/api/internal/apperr"
	"wayfarer/api/internal/maplink"
)

type mapLinkResolver interface {
	Resolve(context.Context, string) (maplink.Result, error)
}

type resolveMapLinkRequest struct {
	URL string `json:"url"`
}

func (s *Server) handleResolveMapLink(w http.ResponseWriter, r *http.Request) {
	if s.mapLinks == nil || s.mapLimiter == nil {
		s.writeError(w, r, apperr.New(503, "map_link_unavailable", "Map link resolution is not available."))
		return
	}

	var input resolveMapLinkRequest
	if err := decodeJSON(w, r, &input); err != nil {
		s.writeError(w, r, err)
		return
	}

	user := s.user(r)
	if !s.mapLimiter.Allow("user:"+user.ID) || !s.mapLimiter.Allow("ip:"+s.clientIP(r)) {
		s.writeError(w, r, apperr.New(429, "rate_limited", "Too many map link lookups. Try again in a minute."))
		return
	}

	result, err := s.mapLinks.Resolve(r.Context(), input.URL)
	switch {
	case errors.Is(err, maplink.ErrTimeout):
		s.writeError(w, r, apperr.New(504, "map_link_timeout", "Google Maps did not respond in time. Paste the full link instead."))
	case errors.Is(err, maplink.ErrNoCoordinates):
		s.writeError(w, r, apperr.New(422, "map_link_no_coordinates", "That link does not contain coordinates. Open it and copy the full Maps URL."))
	case errors.Is(err, maplink.ErrInvalidLink):
		s.writeError(w, r, apperr.New(422, "invalid_map_link", "Paste a Google Maps short link."))
	case err != nil:
		s.writeError(w, r, apperr.New(502, "map_link_unavailable", "That link could not be resolved. Paste the full link instead."))
	default:
		writeData(w, http.StatusOK, result)
	}
}
