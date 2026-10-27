package api

import (
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"wayfarer/api/internal/apperr"
	"wayfarer/api/internal/auth"
	"wayfarer/api/internal/money"
	"wayfarer/api/internal/store"
	"wayfarer/api/internal/validate"
)

var expenseCategories = map[string]bool{
	"food": true, "transport": true, "stay": true, "activity": true, "shopping": true, "other": true,
}

func (s *Server) handleListExpenses(w http.ResponseWriter, r *http.Request) {
	tripID := chi.URLParam(r, "tripID")
	if _, err := s.authorizeTrip(r, tripID, string(auth.ActionReadTrip)); err != nil {
		s.writeError(w, r, err)
		return
	}
	items, err := s.store.ListExpenses(r.Context(), tripID)
	if err != nil {
		s.writeError(w, r, err)
		return
	}
	writeData(w, http.StatusOK, map[string]any{"items": items})
}

func (s *Server) handleCreateExpense(w http.ResponseWriter, r *http.Request) {
	tripID := chi.URLParam(r, "tripID")
	if _, err := s.authorizeTrip(r, tripID, string(auth.ActionManageMoney)); err != nil {
		s.writeError(w, r, err)
		return
	}
	var in store.ExpenseInput
	if err := decodeJSON(w, r, &in); err != nil {
		s.writeError(w, r, err)
		return
	}
	in, err := sanitizeExpense(in)
	if err != nil {
		s.writeError(w, r, err)
		return
	}
	shares, err := buildShares(in)
	if err != nil {
		s.writeError(w, r, err)
		return
	}
	expense, err := s.store.CreateExpense(r.Context(), tripID, s.user(r).ID, in, shares)
	if err != nil {
		s.writeError(w, r, err)
		return
	}
	writeData(w, http.StatusCreated, expense)
}

func (s *Server) handleUpdateExpense(w http.ResponseWriter, r *http.Request) {
	tripID := chi.URLParam(r, "tripID")
	if _, err := s.authorizeTrip(r, tripID, string(auth.ActionManageMoney)); err != nil {
		s.writeError(w, r, err)
		return
	}
	var in store.ExpenseInput
	if err := decodeJSON(w, r, &in); err != nil {
		s.writeError(w, r, err)
		return
	}
	in, err := sanitizeExpense(in)
	if err != nil {
		s.writeError(w, r, err)
		return
	}
	if in.Version <= 0 {
		s.writeError(w, r, validationError("version", "Version is required."))
		return
	}
	shares, err := buildShares(in)
	if err != nil {
		s.writeError(w, r, err)
		return
	}
	expense, err := s.store.UpdateExpense(r.Context(), tripID, chi.URLParam(r, "expenseID"), s.user(r).ID, in, shares)
	if err != nil {
		s.writeError(w, r, err)
		return
	}
	writeData(w, http.StatusOK, expense)
}

func (s *Server) handleDeleteExpense(w http.ResponseWriter, r *http.Request) {
	tripID := chi.URLParam(r, "tripID")
	if _, err := s.authorizeTrip(r, tripID, string(auth.ActionManageMoney)); err != nil {
		s.writeError(w, r, err)
		return
	}
	version, _ := strconv.Atoi(r.URL.Query().Get("version"))
	if err := s.store.DeleteExpense(r.Context(), tripID, chi.URLParam(r, "expenseID"), version); err != nil {
		s.writeError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) handleLedger(w http.ResponseWriter, r *http.Request) {
	tripID := chi.URLParam(r, "tripID")
	if _, err := s.authorizeTrip(r, tripID, string(auth.ActionReadTrip)); err != nil {
		s.writeError(w, r, err)
		return
	}
	ledgers, err := s.store.Ledger(r.Context(), tripID)
	if err != nil {
		s.writeError(w, r, err)
		return
	}
	settlements, err := s.store.ListSettlements(r.Context(), tripID)
	if err != nil {
		s.writeError(w, r, err)
		return
	}
	writeData(w, http.StatusOK, map[string]any{"ledgers": ledgers, "settlements": settlements})
}

func (s *Server) handleListSettlements(w http.ResponseWriter, r *http.Request) {
	tripID := chi.URLParam(r, "tripID")
	if _, err := s.authorizeTrip(r, tripID, string(auth.ActionReadTrip)); err != nil {
		s.writeError(w, r, err)
		return
	}
	items, err := s.store.ListSettlements(r.Context(), tripID)
	if err != nil {
		s.writeError(w, r, err)
		return
	}
	writeData(w, http.StatusOK, map[string]any{"items": items})
}

func (s *Server) handleCreateSettlement(w http.ResponseWriter, r *http.Request) {
	tripID := chi.URLParam(r, "tripID")
	if _, err := s.authorizeTrip(r, tripID, string(auth.ActionManageMoney)); err != nil {
		s.writeError(w, r, err)
		return
	}
	var in store.SettlementInput
	if err := decodeJSON(w, r, &in); err != nil {
		s.writeError(w, r, err)
		return
	}
	var err error
	if in.FromUserID == "" || in.ToUserID == "" {
		s.writeError(w, r, validationError("people", "Choose who paid whom."))
		return
	}
	if in.AmountMinor <= 0 {
		s.writeError(w, r, validationError("amount_minor", "Amount must be greater than zero."))
		return
	}
	if in.Currency, err = validate.Currency(in.Currency); err != nil {
		s.writeError(w, r, err)
		return
	}
	if in.SettledOn, err = validate.Date(in.SettledOn, "settled_on"); err != nil {
		s.writeError(w, r, err)
		return
	}
	if in.Note, err = validate.Optional(in.Note, "note", 1000); err != nil {
		s.writeError(w, r, err)
		return
	}
	settlement, err := s.store.CreateSettlement(r.Context(), tripID, s.user(r).ID, in)
	if err != nil {
		s.writeError(w, r, err)
		return
	}
	writeData(w, http.StatusCreated, settlement)
}

func sanitizeExpense(in store.ExpenseInput) (store.ExpenseInput, error) {
	var err error
	if in.Description, err = validate.Required(in.Description, "description", 200); err != nil {
		return in, err
	}
	if in.AmountMinor <= 0 || in.AmountMinor > 1_000_000_000_000 {
		return in, validationError("amount_minor", "Enter an amount greater than zero.")
	}
	if in.Currency, err = validate.Currency(in.Currency); err != nil {
		return in, err
	}
	if !expenseCategories[in.Category] {
		in.Category = "other"
	}
	if in.ExpenseDate, err = validate.Date(in.ExpenseDate, "expense_date"); err != nil {
		return in, err
	}
	if in.PayerID == "" {
		return in, validationError("payer_id", "Choose who paid.")
	}
	if in.Note, err = validate.Optional(in.Note, "note", 2000); err != nil {
		return in, err
	}
	if in.SplitMode == "" {
		in.SplitMode = "equal"
	}
	if in.SplitMode != "equal" && in.SplitMode != "custom" {
		return in, validationError("split_mode", "Split mode must be equal or custom.")
	}
	return in, nil
}

func buildShares(in store.ExpenseInput) (map[string]int64, error) {
	if in.SplitMode == "custom" {
		shares := map[string]int64{}
		for _, split := range in.CustomSplits {
			if split.UserID == "" {
				return nil, validationError("custom_splits", "Choose a person for every custom split.")
			}
			if split.AmountMinor < 0 {
				return nil, validationError("custom_splits", "Split amounts cannot be negative.")
			}
			if _, exists := shares[split.UserID]; exists {
				return nil, validationError("custom_splits", "Each person can appear only once.")
			}
			shares[split.UserID] = split.AmountMinor
		}
		if err := money.ValidateCustom(in.AmountMinor, shares); err != nil {
			return nil, apperr.New(422, "invalid_split", "Custom split amounts must sum exactly to the total.")
		}
		return shares, nil
	}
	if len(in.Participants) == 0 {
		return nil, validationError("participants", "Choose at least one person to split with.")
	}
	participants := money.OrderParticipants(in.PayerID, in.Participants)
	shares, err := money.SplitEqual(in.AmountMinor, participants)
	if err != nil {
		return nil, validationError("participants", "Choose at least one person to split with.")
	}
	return shares, nil
}
