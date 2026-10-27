package money

import (
	"reflect"
	"testing"
)

func total(shares map[string]int64) int64 {
	var sum int64
	for _, v := range shares {
		sum += v
	}
	return sum
}

func TestOrderParticipants(t *testing.T) {
	got := OrderParticipants("b", []string{"c", "a", "b", "a"})
	want := []string{"b", "a", "c"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("got %v want %v", got, want)
	}
	got = OrderParticipants("z", []string{"c", "a"})
	want = []string{"a", "c"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("payer outside the split must not be added: got %v", got)
	}
}

func TestSplitEqualUsesMinorUnitsAndStableRemainder(t *testing.T) {
	parts := []string{"a", "b", "c"}
	shares, err := SplitEqual(100, parts)
	if err != nil {
		t.Fatal(err)
	}
	want := map[string]int64{"a": 34, "b": 33, "c": 33}
	if !reflect.DeepEqual(shares, want) {
		t.Fatalf("got %v want %v", shares, want)
	}
	if total(shares) != 100 {
		t.Fatal("shares must sum to total")
	}
	shares, _ = SplitEqual(2, []string{"a", "b"})
	if shares["a"] != 1 || shares["b"] != 1 {
		t.Fatalf("unexpected split: %v", shares)
	}
	shares, _ = SplitEqual(1, []string{"a", "b"})
	if shares["a"] != 1 || shares["b"] != 0 {
		t.Fatalf("remainder must go to first participant: %v", shares)
	}
	if _, err := SplitEqual(0, parts); err == nil {
		t.Fatal("zero total must fail")
	}
	if _, err := SplitEqual(10, nil); err == nil {
		t.Fatal("no participants must fail")
	}
}

func TestValidateCustomRejectsMismatch(t *testing.T) {
	if err := ValidateCustom(100, map[string]int64{"a": 50, "b": 50}); err != nil {
		t.Fatal(err)
	}
	if err := ValidateCustom(100, map[string]int64{"a": 50, "b": 49}); err == nil {
		t.Fatal("mismatched split must fail")
	}
	if err := ValidateCustom(100, map[string]int64{"a": -1, "b": 101}); err == nil {
		t.Fatal("negative split must fail")
	}
	if err := ValidateCustom(100, map[string]int64{}); err == nil {
		t.Fatal("empty split must fail")
	}
}

func TestBalancesAndSuggestions(t *testing.T) {
	users := []string{"a", "b", "c"}
	expenses := []Expense{{
		PayerID: "a",
		Amount:  9000,
		Splits:  map[string]int64{"a": 3000, "b": 3000, "c": 3000},
	}}
	settlements := []Settlement{{FromID: "b", ToID: "a", Amount: 1000}}
	balances := NetBalances(users, expenses, settlements)
	want := []Balance{
		{UserID: "a", Net: 5000},
		{UserID: "b", Net: -2000},
		{UserID: "c", Net: -3000},
	}
	if !reflect.DeepEqual(balances, want) {
		t.Fatalf("got %+v want %+v", balances, want)
	}
	transfers := SuggestedTransfers(balances)
	wantTransfers := []Transfer{
		{FromUserID: "c", ToUserID: "a", Amount: 3000},
		{FromUserID: "b", ToUserID: "a", Amount: 2000},
	}
	if !reflect.DeepEqual(transfers, wantTransfers) {
		t.Fatalf("got %+v want %+v", transfers, wantTransfers)
	}
	var sum int64
	for _, b := range balances {
		sum += b.Net
	}
	if sum != 0 {
		t.Fatalf("balances must net to zero, got %d", sum)
	}
}

func TestNoFloatingPointMoney(t *testing.T) {
	shares, err := SplitEqual(999999999, []string{"a", "b", "c", "d", "e", "f", "g"})
	if err != nil {
		t.Fatal(err)
	}
	if total(shares) != 999999999 {
		t.Fatalf("large minor-unit split lost precision: %d", total(shares))
	}
}
