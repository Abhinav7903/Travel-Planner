package apperr

import (
	"errors"
	"fmt"
	"net/http"
)

// Error is a user-safe API error. Internal causes are deliberately not
// serialized or logged with request payloads.
type Error struct {
	Status  int               `json:"-"`
	Code    string            `json:"code"`
	Message string            `json:"message"`
	Fields  map[string]string `json:"fields,omitempty"`
}

func (e *Error) Error() string { return fmt.Sprintf("%s: %s", e.Code, e.Message) }

func New(status int, code, message string) *Error {
	return &Error{Status: status, Code: code, Message: message}
}

func WithFields(e *Error, fields map[string]string) *Error {
	e.Fields = fields
	return e
}

func Is(err error, target *Error) bool {
	var e *Error
	if errors.As(err, &e) {
		return e.Code == target.Code
	}
	return false
}

var (
	ErrUnauthorized = New(http.StatusUnauthorized, "unauthorized", "Sign in to continue.")
	ErrForbidden    = New(http.StatusForbidden, "forbidden", "You do not have permission to do that.")
	ErrNotFound     = New(http.StatusNotFound, "not_found", "That item could not be found.")
	ErrConflict     = New(http.StatusConflict, "conflict", "This was changed by someone else. Refresh and try again.")
	ErrValidation   = New(http.StatusUnprocessableEntity, "validation_failed", "Please check the highlighted fields.")
	ErrRateLimited  = New(http.StatusTooManyRequests, "rate_limited", "Too many attempts. Please wait and try again.")
	ErrExpired      = New(http.StatusGone, "expired", "This invitation or code has expired.")
	ErrInternal     = New(http.StatusInternalServerError, "internal_error", "Something went wrong. Please try again.")
	ErrBadRequest   = New(http.StatusBadRequest, "bad_request", "The request could not be processed.")
	ErrUnavailable  = New(http.StatusServiceUnavailable, "service_unavailable", "The service is temporarily unavailable.")
)
