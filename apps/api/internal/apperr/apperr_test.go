package apperr_test

import (
	"errors"
	"testing"

	"wayfarer/api/internal/apperr"
)

func TestAppError_NilSafety(t *testing.T) {
	var nilErr *apperr.Error
	if nilErr.Error() != "<nil>" {
		t.Errorf("expected <nil>, got %s", nilErr.Error())
	}

	if apperr.Is(nil, apperr.ErrNotFound) {
		t.Errorf("nil error should not match ErrNotFound")
	}

	if apperr.Is(errors.New("generic"), nil) {
		t.Errorf("error should not match nil target")
	}

	if !apperr.Is(nil, nil) {
		t.Errorf("nil should match nil target")
	}

	// Test WithFields with nil error
	fallback := apperr.WithFields(nil, map[string]string{"foo": "bar"})
	if fallback == nil || fallback.Fields["foo"] != "bar" {
		t.Errorf("expected fallback error with fields")
	}
}

func TestAppError_WithFieldsImmutability(t *testing.T) {
	orig := apperr.ErrValidation
	origFieldsCount := len(orig.Fields)

	cloned := apperr.WithFields(orig, map[string]string{"field1": "error1"})
	if len(orig.Fields) != origFieldsCount {
		t.Errorf("original ErrValidation was mutated! got len %d, want %d", len(orig.Fields), origFieldsCount)
	}
	if cloned.Fields["field1"] != "error1" {
		t.Errorf("cloned error missing field1")
	}

	cloned2 := apperr.WithFields(orig, map[string]string{"field2": "error2"})
	if cloned.Fields["field2"] != "" {
		t.Errorf("cloned was affected by cloned2")
	}
	if cloned2.Fields["field2"] != "error2" {
		t.Errorf("cloned2 missing field2")
	}
}

func TestAppError_IsMatching(t *testing.T) {
	err := apperr.WithFields(apperr.ErrNotFound, map[string]string{"id": "not found"})
	if !apperr.Is(err, apperr.ErrNotFound) {
		t.Errorf("expected err to match ErrNotFound")
	}
	if apperr.Is(err, apperr.ErrForbidden) {
		t.Errorf("expected err to not match ErrForbidden")
	}
}
