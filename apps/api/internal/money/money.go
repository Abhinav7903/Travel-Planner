package money

import (
	"errors"
	"sort"
)

var ErrInvalidSplit = errors.New("split amounts must sum exactly to the total")

// OrderParticipants deduplicates IDs, puts the payer first and sorts the rest
// so equal-split remainder distribution is deterministic across clients.
func OrderParticipants(payer string, participants []string) []string {
	seen := map[string]bool{}
	out := make([]string, 0, len(participants))
	payerIncluded := false
	for _, id := range participants {
		if id == payer && id != "" {
			payerIncluded = true
			break
		}
	}
	if payer != "" && payerIncluded {
		seen[payer] = true
		out = append(out, payer)
	}
	rest := make([]string, 0, len(participants))
	for _, id := range participants {
		if id == "" || seen[id] {
			continue
		}
		seen[id] = true
		rest = append(rest, id)
	}
	sort.Strings(rest)
	return append(out, rest...)
}

// SplitEqual divides total minor units into n shares. The remainder (0..n-1)
// is assigned one minor unit at a time to the first participants in order.
// Callers should use OrderParticipants so this rule is stable and documented.
func SplitEqual(total int64, participants []string) (map[string]int64, error) {
	n := int64(len(participants))
	if total <= 0 || n == 0 {
		return nil, ErrInvalidSplit
	}
	base := total / n
	remainder := total % n
	shares := make(map[string]int64, len(participants))
	for i, id := range participants {
		share := base
		if int64(i) < remainder {
			share++
		}
		shares[id] = share
	}
	return shares, nil
}

func Sum(values map[string]int64) int64 {
	var total int64
	for _, v := range values {
		total += v
	}
	return total
}

func ValidateCustom(total int64, shares map[string]int64) error {
	if total <= 0 || len(shares) == 0 {
		return ErrInvalidSplit
	}
	if Sum(shares) != total {
		return ErrInvalidSplit
	}
	for _, amount := range shares {
		if amount < 0 {
			return ErrInvalidSplit
		}
	}
	return nil
}

type Expense struct {
	PayerID string
	Amount  int64
	Splits  map[string]int64
}

type Settlement struct {
	FromID string
	ToID   string
	Amount int64
}

type Balance struct {
	UserID string `json:"user_id"`
	Net    int64  `json:"net_minor"`
}

type Transfer struct {
	FromUserID string `json:"from_user_id"`
	ToUserID   string `json:"to_user_id"`
	Amount     int64  `json:"amount_minor"`
}

// NetBalances returns paid - owed + settlements paid - settlements received.
// Positive means the user is owed money; negative means they owe money.
func NetBalances(userIDs []string, expenses []Expense, settlements []Settlement) []Balance {
	net := make(map[string]int64, len(userIDs))
	for _, id := range userIDs {
		net[id] = 0
	}
	for _, e := range expenses {
		net[e.PayerID] += e.Amount
		for userID, amount := range e.Splits {
			net[userID] -= amount
		}
	}
	for _, s := range settlements {
		net[s.FromID] += s.Amount
		net[s.ToID] -= s.Amount
	}
	balances := make([]Balance, 0, len(net))
	for id, amount := range net {
		balances = append(balances, Balance{UserID: id, Net: amount})
	}
	sort.Slice(balances, func(i, j int) bool {
		if balances[i].Net == balances[j].Net {
			return balances[i].UserID < balances[j].UserID
		}
		return balances[i].Net > balances[j].Net
	})
	return balances
}

// SuggestedTransfers greedily matches largest debtor to largest creditor
// within a single currency, never producing cross-currency transfers.
func SuggestedTransfers(balances []Balance) []Transfer {
	debtors := make([]Balance, 0)
	creditors := make([]Balance, 0)
	for _, b := range balances {
		if b.Net < 0 {
			debtors = append(debtors, Balance{UserID: b.UserID, Net: -b.Net})
		} else if b.Net > 0 {
			creditors = append(creditors, b)
		}
	}
	sort.Slice(debtors, func(i, j int) bool { return debtors[i].Net > debtors[j].Net })
	sort.Slice(creditors, func(i, j int) bool { return creditors[i].Net > creditors[j].Net })

	transfers := []Transfer{}
	i, j := 0, 0
	for i < len(debtors) && j < len(creditors) {
		amount := debtors[i].Net
		if creditors[j].Net < amount {
			amount = creditors[j].Net
		}
		if amount > 0 {
			transfers = append(transfers, Transfer{
				FromUserID: debtors[i].UserID,
				ToUserID:   creditors[j].UserID,
				Amount:     amount,
			})
			debtors[i].Net -= amount
			creditors[j].Net -= amount
		}
		if debtors[i].Net == 0 {
			i++
		}
		if creditors[j].Net == 0 {
			j++
		}
	}
	return transfers
}
