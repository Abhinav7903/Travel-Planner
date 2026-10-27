package api

import (
	"strings"
	"testing"

	"wayfarer/api/internal/store"
)

func TestSanitizeTripInput(t *testing.T) {
	base := store.TripInput{
		Title:       "Japan in autumn",
		Destination: "Kyoto, Japan",
		StartDate:   "2026-11-01",
		EndDate:     "2026-11-07",
		Timezone:    "Asia/Tokyo",
		Currency:    "JPY",
	}
	got, err := sanitizeTripInput(base)
	if err != nil {
		t.Fatal(err)
	}
	if got.Status != "active" {
		t.Fatalf("default status should be active: %q", got.Status)
	}
	bad := base
	bad.EndDate = "2026-10-31"
	if _, err := sanitizeTripInput(bad); err == nil {
		t.Fatal("end before start must fail")
	}
	bad = base
	bad.Timezone = "Asia/Nowhere"
	if _, err := sanitizeTripInput(bad); err == nil {
		t.Fatal("invalid timezone must fail")
	}
	bad = base
	bad.CoverImageURL = "javascript:alert(1)"
	if _, err := sanitizeTripInput(bad); err == nil {
		t.Fatal("unsafe cover image URL must fail")
	}
}

func TestSanitizeItemInput(t *testing.T) {
	in := store.ItemInput{
		DayID:          "00000000-0000-0000-0000-000000000001",
		Title:          "Fushimi Inari",
		Kind:           "place",
		Latitude:       34.9671,
		Longitude:      135.7727,
		HasCoordinates: true,
		StartTime:      "08:00:00",
		EndTime:        "10:00",
		CostMinor:      500,
		Currency:       "jpy",
	}
	got, err := sanitizeItem(in)
	if err != nil {
		t.Fatal(err)
	}
	if got.StartTime != "08:00" || got.Currency != "JPY" {
		t.Fatalf("times or currency not normalized: %+v", got)
	}
	in.EndTime = "07:00"
	if _, err := sanitizeItem(in); err == nil {
		t.Fatal("end before start must fail")
	}
	in = store.ItemInput{DayID: "day", Title: "Stop", Kind: "unknown", Latitude: 200, Longitude: 0, HasCoordinates: true}
	if _, err := sanitizeItem(in); err == nil {
		t.Fatal("out-of-range coordinates must fail")
	}
}

func TestSanitizeEdgeRequiresModeAndItems(t *testing.T) {
	in := store.EdgeInput{
		DayID:      "day",
		FromItemID: "a",
		ToItemID:   "b",
		Mode:       "walk",
	}
	if _, err := sanitizeEdge(in); err != nil {
		t.Fatal(err)
	}
	in.Mode = "teleport"
	if _, err := sanitizeEdge(in); err == nil {
		t.Fatal("unknown mode must fail")
	}
	in.Mode = "walk"
	in.ToItemID = ""
	if _, err := sanitizeEdge(in); err == nil {
		t.Fatal("missing endpoint must fail")
	}
	in.ToItemID = "b"
	in.DurationMinutes = -1
	if _, err := sanitizeEdge(in); err == nil {
		t.Fatal("negative duration must fail")
	}
}

func TestBuildSharesEqualAndCustom(t *testing.T) {
	in := store.ExpenseInput{
		AmountMinor:  10000,
		PayerID:      "a",
		SplitMode:    "equal",
		Participants: []string{"b", "a", "b"},
	}
	shares, err := buildShares(in)
	if err != nil {
		t.Fatal(err)
	}
	if len(shares) != 2 || shares["a"]+shares["b"] != 10000 || shares["a"] != shares["b"] {
		t.Fatalf("unexpected equal shares: %v", shares)
	}
	in.SplitMode = "custom"
	in.CustomSplits = []store.ExpenseSplit{{UserID: "a", AmountMinor: 4000}, {UserID: "b", AmountMinor: 6000}}
	shares, err = buildShares(in)
	if err != nil || shares["b"] != 6000 {
		t.Fatalf("unexpected custom shares: %v %v", shares, err)
	}
	in.CustomSplits[1].AmountMinor = 5999
	if _, err := buildShares(in); err == nil {
		t.Fatal("custom split that does not sum to total must fail")
	}
	in.CustomSplits = []store.ExpenseSplit{{UserID: "a", AmountMinor: 5000}, {UserID: "a", AmountMinor: 5000}}
	if _, err := buildShares(in); err == nil {
		t.Fatal("duplicate user in custom split must fail")
	}
}

func TestSanitizeExpenseAndNote(t *testing.T) {
	in := store.ExpenseInput{
		Description: "Kaiseki dinner",
		AmountMinor: 24000,
		Currency:    "jpy",
		Category:    "martian",
		ExpenseDate: "2026-11-03",
		PayerID:     "user",
		SplitMode:   "",
	}
	got, err := sanitizeExpense(in)
	if err != nil {
		t.Fatal(err)
	}
	if got.Category != "other" || got.SplitMode != "equal" {
		t.Fatalf("expected safe defaults, got %+v", got)
	}
	in.AmountMinor = 0
	if _, err := sanitizeExpense(in); err == nil {
		t.Fatal("zero amount must fail")
	}
	note := store.NoteInput{Title: strings.Repeat("x", 201)}
	if _, err := sanitizeNote(note); err == nil {
		t.Fatal("overlong note title must fail")
	}
	note.Title = "Packing list"
	note.BodyMarkdown = "<script>alert(1)</script>"
	if _, err := sanitizeNote(note); err != nil {
		t.Fatal("markdown body may include raw HTML; rendering must sanitize it")
	}
}
