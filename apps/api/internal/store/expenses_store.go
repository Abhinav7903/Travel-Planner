package store

import (
	"context"
	"errors"
	"sort"

	"github.com/jackc/pgx/v5"

	"wayfarer/api/internal/apperr"
	"wayfarer/api/internal/money"
)

const expenseColumns = `
	e.id, e.trip_id, COALESCE(e.group_id::text,''), e.description, e.amount_minor,
	rtrim(e.currency::text), e.category, to_char(e.expense_date,'YYYY-MM-DD'),
	e.payer_id, payer.display_name, e.note, e.version, e.created_at, e.updated_at`

func scanExpense(row scanner) (Expense, error) {
	var e Expense
	err := row.Scan(&e.ID, &e.TripID, &e.GroupID, &e.Description, &e.AmountMinor,
		&e.Currency, &e.Category, &e.ExpenseDate, &e.PayerID, &e.PayerName, &e.Note,
		&e.Version, &e.CreatedAt, &e.UpdatedAt)
	e.Splits = []ExpenseSplit{}
	return e, err
}

func (s *Store) ListExpenses(ctx context.Context, tripID string) ([]Expense, error) {
	rows, err := s.Pool.Query(ctx,
		`SELECT `+expenseColumns+`
		 FROM expenses e JOIN users payer ON payer.id=e.payer_id
		 WHERE e.trip_id=$1 ORDER BY e.expense_date DESC, e.created_at DESC LIMIT 200`, tripID)
	if err != nil {
		return nil, err
	}
	expenses := []Expense{}
	index := map[string]int{}
	for rows.Next() {
		e, err := scanExpense(rows)
		if err != nil {
			rows.Close()
			return nil, err
		}
		index[e.ID] = len(expenses)
		expenses = append(expenses, e)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}
	splitRows, err := s.Pool.Query(ctx,
		`SELECT sp.expense_id, sp.user_id, u.display_name, sp.amount_minor
		 FROM expense_splits sp
		 JOIN expenses e ON e.id=sp.expense_id
		 JOIN users u ON u.id=sp.user_id
		 WHERE e.trip_id=$1 ORDER BY sp.amount_minor DESC`, tripID)
	if err != nil {
		return nil, err
	}
	defer splitRows.Close()
	for splitRows.Next() {
		var expenseID string
		var split ExpenseSplit
		if err := splitRows.Scan(&expenseID, &split.UserID, &split.DisplayName, &split.AmountMinor); err != nil {
			return nil, err
		}
		if idx, ok := index[expenseID]; ok {
			expenses[idx].Splits = append(expenses[idx].Splits, split)
		}
	}
	return expenses, splitRows.Err()
}

func (s *Store) GetExpense(ctx context.Context, tripID, expenseID string) (Expense, error) {
	e, err := scanExpense(s.Pool.QueryRow(ctx,
		`SELECT `+expenseColumns+`
		 FROM expenses e JOIN users payer ON payer.id=e.payer_id
		 WHERE e.trip_id=$1 AND e.id=$2`, tripID, expenseID))
	if errors.Is(err, pgx.ErrNoRows) {
		return e, apperr.ErrNotFound
	}
	if err != nil {
		return e, err
	}
	rows, err := s.Pool.Query(ctx,
		`SELECT sp.user_id, u.display_name, sp.amount_minor
		 FROM expense_splits sp JOIN users u ON u.id=sp.user_id
		 WHERE sp.expense_id=$1 ORDER BY sp.amount_minor DESC`, expenseID)
	if err != nil {
		return e, err
	}
	defer rows.Close()
	for rows.Next() {
		var split ExpenseSplit
		if err := rows.Scan(&split.UserID, &split.DisplayName, &split.AmountMinor); err != nil {
			return e, err
		}
		e.Splits = append(e.Splits, split)
	}
	return e, rows.Err()
}

func (s *Store) validateMoneyMembers(ctx context.Context, tx pgx.Tx, tripID, payerID string, shares map[string]int64) error {
	var payerOK bool
	if err := tx.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM trip_members WHERE trip_id=$1 AND user_id=$2)`, tripID, payerID).Scan(&payerOK); err != nil {
		return err
	}
	if !payerOK {
		return apperr.New(422, "invalid_payer", "The payer must be a trip member.")
	}
	for userID := range shares {
		var ok bool
		if err := tx.QueryRow(ctx,
			`SELECT EXISTS(SELECT 1 FROM trip_members WHERE trip_id=$1 AND user_id=$2)`, tripID, userID).Scan(&ok); err != nil {
			return err
		}
		if !ok {
			return apperr.New(422, "invalid_participant", "Everyone in a split must be a trip member.")
		}
	}
	if err := money.ValidateCustom(sumShares(shares), shares); err != nil {
		return apperr.New(422, "invalid_split", "Split amounts must sum exactly to the total.")
	}
	return nil
}

func sumShares(shares map[string]int64) int64 {
	var total int64
	for _, v := range shares {
		total += v
	}
	return total
}

func (s *Store) CreateExpense(ctx context.Context, tripID, userID string, in ExpenseInput, shares map[string]int64) (Expense, error) {
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return Expense{}, err
	}
	defer rollback(ctx, tx)
	if sumShares(shares) != in.AmountMinor || in.AmountMinor <= 0 {
		return Expense{}, apperr.New(422, "invalid_split", "Split amounts must sum exactly to the total.")
	}
	if err := s.validateMoneyMembers(ctx, tx, tripID, in.PayerID, shares); err != nil {
		return Expense{}, err
	}
	if in.GroupID != "" {
		ok, err := s.GroupBelongsToTrip(ctx, tripID, in.GroupID)
		if err != nil {
			return Expense{}, err
		}
		if !ok {
			return Expense{}, apperr.New(422, "invalid_group", "That group does not belong to this trip.")
		}
	}
	var id string
	err = tx.QueryRow(ctx,
		`INSERT INTO expenses (trip_id, group_id, description, amount_minor, currency, category, expense_date, payer_id, note, created_by)
		 VALUES ($1,NULLIF($2,'')::uuid,$3,$4,$5,$6,$7::date,$8,$9,$10) RETURNING id`,
		tripID, in.GroupID, in.Description, in.AmountMinor, in.Currency, in.Category, in.ExpenseDate, in.PayerID, in.Note, userID).Scan(&id)
	if err != nil {
		return Expense{}, mapWriteError(err)
	}
	for splitUser, amount := range shares {
		if _, err := tx.Exec(ctx,
			`INSERT INTO expense_splits (expense_id, user_id, amount_minor) VALUES ($1,$2,$3)`,
			id, splitUser, amount); err != nil {
			return Expense{}, mapWriteError(err)
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return Expense{}, err
	}
	return s.GetExpense(ctx, tripID, id)
}

func (s *Store) UpdateExpense(ctx context.Context, tripID, expenseID, userID string, in ExpenseInput, shares map[string]int64) (Expense, error) {
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return Expense{}, err
	}
	defer rollback(ctx, tx)
	if sumShares(shares) != in.AmountMinor || in.AmountMinor <= 0 {
		return Expense{}, apperr.New(422, "invalid_split", "Split amounts must sum exactly to the total.")
	}
	if err := s.validateMoneyMembers(ctx, tx, tripID, in.PayerID, shares); err != nil {
		return Expense{}, err
	}
	if in.GroupID != "" {
		ok, err := s.GroupBelongsToTrip(ctx, tripID, in.GroupID)
		if err != nil {
			return Expense{}, err
		}
		if !ok {
			return Expense{}, apperr.New(422, "invalid_group", "That group does not belong to this trip.")
		}
	}
	var id string
	err = tx.QueryRow(ctx,
		`UPDATE expenses SET group_id=NULLIF($3,'')::uuid, description=$4, amount_minor=$5,
		   currency=$6, category=$7, expense_date=$8::date, payer_id=$9, note=$10, version=version+1
		 WHERE id=$1 AND trip_id=$2 AND version=$11 RETURNING id`,
		expenseID, tripID, in.GroupID, in.Description, in.AmountMinor, in.Currency,
		in.Category, in.ExpenseDate, in.PayerID, in.Note, in.Version).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return Expense{}, apperr.ErrConflict
	}
	if err != nil {
		return Expense{}, mapWriteError(err)
	}
	if _, err := tx.Exec(ctx, `DELETE FROM expense_splits WHERE expense_id=$1`, expenseID); err != nil {
		return Expense{}, err
	}
	for splitUser, amount := range shares {
		if _, err := tx.Exec(ctx,
			`INSERT INTO expense_splits (expense_id, user_id, amount_minor) VALUES ($1,$2,$3)`,
			expenseID, splitUser, amount); err != nil {
			return Expense{}, mapWriteError(err)
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return Expense{}, err
	}
	return s.GetExpense(ctx, tripID, expenseID)
}

func (s *Store) DeleteExpense(ctx context.Context, tripID, expenseID string, version int) error {
	var tag interface{ RowsAffected() int64 }
	var err error
	if version > 0 {
		tag, err = s.Pool.Exec(ctx, `DELETE FROM expenses WHERE id=$1 AND trip_id=$2 AND version=$3`, expenseID, tripID, version)
	} else {
		tag, err = s.Pool.Exec(ctx, `DELETE FROM expenses WHERE id=$1 AND trip_id=$2`, expenseID, tripID)
	}
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return apperr.ErrConflict
	}
	return nil
}

const settlementColumns = `
	s.id, s.trip_id, s.from_user_id, f.display_name, s.to_user_id, t.display_name,
	s.amount_minor, rtrim(s.currency::text), to_char(s.settled_on,'YYYY-MM-DD'), s.note, s.created_at`

func scanSettlement(row scanner) (Settlement, error) {
	var s Settlement
	err := row.Scan(&s.ID, &s.TripID, &s.FromUserID, &s.FromName, &s.ToUserID, &s.ToName,
		&s.AmountMinor, &s.Currency, &s.SettledOn, &s.Note, &s.CreatedAt)
	return s, err
}

func (s *Store) ListSettlements(ctx context.Context, tripID string) ([]Settlement, error) {
	rows, err := s.Pool.Query(ctx,
		`SELECT `+settlementColumns+`
		 FROM settlements s JOIN users f ON f.id=s.from_user_id JOIN users t ON t.id=s.to_user_id
		 WHERE s.trip_id=$1 ORDER BY s.settled_on DESC, s.created_at DESC LIMIT 200`, tripID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []Settlement{}
	for rows.Next() {
		st, err := scanSettlement(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, st)
	}
	return items, rows.Err()
}

func (s *Store) CreateSettlement(ctx context.Context, tripID, userID string, in SettlementInput) (Settlement, error) {
	if in.FromUserID == in.ToUserID {
		return Settlement{}, apperr.New(422, "invalid_settlement", "Choose two different people.")
	}
	for _, memberID := range []string{in.FromUserID, in.ToUserID} {
		ok, err := s.MemberExists(ctx, tripID, memberID)
		if err != nil {
			return Settlement{}, err
		}
		if !ok {
			return Settlement{}, apperr.New(422, "invalid_member", "Both people must be trip members.")
		}
	}
	var id string
	err := s.Pool.QueryRow(ctx,
		`INSERT INTO settlements (trip_id, from_user_id, to_user_id, amount_minor, currency, settled_on, note, created_by)
		 VALUES ($1,$2,$3,$4,$5,$6::date,$7,$8) RETURNING id`,
		tripID, in.FromUserID, in.ToUserID, in.AmountMinor, in.Currency, in.SettledOn, in.Note, userID).Scan(&id)
	if err != nil {
		return Settlement{}, mapWriteError(err)
	}
	return scanSettlement(s.Pool.QueryRow(ctx,
		`SELECT `+settlementColumns+`
		 FROM settlements s JOIN users f ON f.id=s.from_user_id JOIN users t ON t.id=s.to_user_id
		 WHERE s.id=$1`, id))
}

func (s *Store) Ledger(ctx context.Context, tripID string) ([]CurrencyLedger, error) {
	members, err := s.ListMembers(ctx, tripID)
	if err != nil {
		return nil, err
	}
	userIDs := make([]string, 0, len(members))
	for _, m := range members {
		userIDs = append(userIDs, m.UserID)
	}

	type expenseAgg struct {
		payerID string
		amount  int64
		splits  map[string]int64
	}
	byCurrencyExpenses := map[string]map[string]*expenseAgg{}
	rows, err := s.Pool.Query(ctx,
		`SELECT e.id, rtrim(e.currency::text), e.payer_id, e.amount_minor
		 FROM expenses e WHERE e.trip_id=$1`, tripID)
	if err != nil {
		return nil, err
	}
	expenseCurrency := map[string]string{}
	for rows.Next() {
		var id, currency, payer string
		var amount int64
		if err := rows.Scan(&id, &currency, &payer, &amount); err != nil {
			rows.Close()
			return nil, err
		}
		expenseCurrency[id] = currency
		if byCurrencyExpenses[currency] == nil {
			byCurrencyExpenses[currency] = map[string]*expenseAgg{}
		}
		byCurrencyExpenses[currency][id] = &expenseAgg{payerID: payer, amount: amount, splits: map[string]int64{}}
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}
	splitRows, err := s.Pool.Query(ctx,
		`SELECT sp.expense_id, sp.user_id, sp.amount_minor
		 FROM expense_splits sp JOIN expenses e ON e.id=sp.expense_id WHERE e.trip_id=$1`, tripID)
	if err != nil {
		return nil, err
	}
	for splitRows.Next() {
		var expenseID, userID string
		var amount int64
		if err := splitRows.Scan(&expenseID, &userID, &amount); err != nil {
			splitRows.Close()
			return nil, err
		}
		currency := expenseCurrency[expenseID]
		if agg := byCurrencyExpenses[currency][expenseID]; agg != nil {
			agg.splits[userID] = amount
		}
	}
	splitRows.Close()
	if err := splitRows.Err(); err != nil {
		return nil, err
	}

	settlementsByCurrency := map[string][]money.Settlement{}
	stRows, err := s.Pool.Query(ctx,
		`SELECT rtrim(currency::text), from_user_id, to_user_id, amount_minor FROM settlements WHERE trip_id=$1`, tripID)
	if err != nil {
		return nil, err
	}
	for stRows.Next() {
		var currency, from, to string
		var amount int64
		if err := stRows.Scan(&currency, &from, &to, &amount); err != nil {
			stRows.Close()
			return nil, err
		}
		settlementsByCurrency[currency] = append(settlementsByCurrency[currency], money.Settlement{FromID: from, ToID: to, Amount: amount})
	}
	stRows.Close()
	if err := stRows.Err(); err != nil {
		return nil, err
	}

	ledgers := []CurrencyLedger{}
	for currency, aggMap := range byCurrencyExpenses {
		expenses := make([]money.Expense, 0, len(aggMap))
		var total int64
		for _, agg := range aggMap {
			expenses = append(expenses, money.Expense{PayerID: agg.payerID, Amount: agg.amount, Splits: agg.splits})
			total += agg.amount
		}
		balances := money.NetBalances(userIDs, expenses, settlementsByCurrency[currency])
		ledgers = append(ledgers, CurrencyLedger{
			Currency:    currency,
			Balances:    balances,
			Suggestions: money.SuggestedTransfers(balances),
			TotalMinor:  total,
		})
	}
	sort.Slice(ledgers, func(i, j int) bool { return ledgers[i].Currency < ledgers[j].Currency })
	return ledgers, nil
}
