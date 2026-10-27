package api

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"

	"wayfarer/api/internal/apperr"
)

type envelope struct {
	Data  any        `json:"data,omitempty"`
	Error *errorBody `json:"error,omitempty"`
}

type errorBody struct {
	Code      string            `json:"code"`
	Message   string            `json:"message"`
	Fields    map[string]string `json:"fields,omitempty"`
	RequestID string            `json:"request_id,omitempty"`
}

func writeData(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	if data != nil {
		_ = json.NewEncoder(w).Encode(envelope{Data: data})
	}
}

func (s *Server) writeError(w http.ResponseWriter, r *http.Request, err error) {
	var apiErr *apperr.Error
	if !errors.As(err, &apiErr) {
		if errors.Is(err, context.DeadlineExceeded) {
			apiErr = apperr.New(503, "timeout", "The request took too long. Please try again.")
		} else {
			s.log.Error("unhandled error", "request_id", requestID(r.Context()), "error", err)
			apiErr = apperr.ErrInternal
		}
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(apiErr.Status)
	_ = json.NewEncoder(w).Encode(envelope{Error: &errorBody{
		Code:      apiErr.Code,
		Message:   apiErr.Message,
		Fields:    apiErr.Fields,
		RequestID: requestID(r.Context()),
	}})
}

// writeError is the package-level fallback used by middleware that has no
// access to the Server logger. Internal failures stay generic.
func writeError(w http.ResponseWriter, r *http.Request, err error) {
	var apiErr *apperr.Error
	if !errors.As(err, &apiErr) {
		apiErr = apperr.ErrInternal
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(apiErr.Status)
	_ = json.NewEncoder(w).Encode(envelope{Error: &errorBody{
		Code:      apiErr.Code,
		Message:   apiErr.Message,
		Fields:    apiErr.Fields,
		RequestID: requestID(r.Context()),
	}})
}

func validationError(field, message string) error {
	return apperr.WithFields(apperr.ErrValidation, map[string]string{field: message})
}
