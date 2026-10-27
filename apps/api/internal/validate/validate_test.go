package validate

import (
	"testing"
)

func TestEmail(t *testing.T) {
	for _, valid := range []string{"alex@example.com", "A.Morgan+travel@example.co.uk"} {
		if _, err := Email(valid); err != nil {
			t.Errorf("%q should be valid: %v", valid, err)
		}
	}
	for _, invalid := range []string{"", "alex", "alex@", "@example.com", "Alex <alex@example.com>", "a b@example.com"} {
		if _, err := Email(invalid); err == nil {
			t.Errorf("%q should be invalid", invalid)
		}
	}
	if got, _ := Email("  Alex@Example.COM "); got != "alex@example.com" {
		t.Fatalf("email not normalized: %q", got)
	}
}

func TestRequiredAndOptional(t *testing.T) {
	if _, err := Required("   ", "title", 10); err == nil {
		t.Fatal("blank required field must fail")
	}
	if got, err := Required("  Trip  ", "title", 10); err != nil || got != "Trip" {
		t.Fatalf("got %q err %v", got, err)
	}
	if _, err := Required("abcdefghijk", "title", 10); err == nil {
		t.Fatal("overlong field must fail")
	}
	if _, err := Optional("", "note", 10); err != nil {
		t.Fatal(err)
	}
	if got, _ := Optional("  hi  ", "note", 10); got != "hi" {
		t.Fatalf("optional not trimmed: %q", got)
	}
}

func TestCurrencyAndTimezone(t *testing.T) {
	if got, err := Currency(" inr "); err != nil || got != "INR" {
		t.Fatalf("got %q err %v", got, err)
	}
	if _, err := Currency("XXX"); err == nil {
		t.Fatal("unsupported currency must fail")
	}
	if _, err := Timezone("Asia/Kolkata"); err != nil {
		t.Fatal(err)
	}
	if _, err := Timezone("Mars/Olympus"); err == nil {
		t.Fatal("invalid timezone must fail")
	}
	if _, err := Timezone(""); err == nil {
		t.Fatal("empty timezone must fail")
	}
}

func TestDateAndTime(t *testing.T) {
	if _, err := Date("2026-10-25", "date"); err != nil {
		t.Fatal(err)
	}
	if _, err := Date("2026-02-30", "date"); err == nil {
		t.Fatal("invalid date must fail")
	}
	if _, err := Date("25/10/2026", "date"); err == nil {
		t.Fatal("wrong format must fail")
	}
	for in, want := range map[string]string{"09:30": "09:30", "09:30:00": "09:30", "": ""} {
		got, err := TimeValue(in, "time")
		if err != nil || got != want {
			t.Errorf("TimeValue(%q) = %q, %v; want %q", in, got, err, want)
		}
	}
	for _, invalid := range []string{"9:30", "24:00", "12:60", "noon"} {
		if _, err := TimeValue(invalid, "time"); err == nil {
			t.Errorf("%q should be invalid", invalid)
		}
	}
}

func TestURLAndCoordinates(t *testing.T) {
	if _, err := URLOrEmpty("https://example.com/path?q=1", "url"); err != nil {
		t.Fatal(err)
	}
	if _, err := URLOrEmpty("", "url"); err != nil {
		t.Fatal(err)
	}
	for _, invalid := range []string{"javascript:alert(1)", "ftp://example.com", "example.com", "//example.com"} {
		if _, err := URLOrEmpty(invalid, "url"); err == nil {
			t.Errorf("%q should be invalid", invalid)
		}
	}
	lat, lng := 35.0116, 135.7681
	if err := Coordinates(&lat, &lng); err != nil {
		t.Fatal(err)
	}
	bad := 91.0
	if err := Coordinates(&bad, &lng); err == nil {
		t.Fatal("latitude out of range must fail")
	}
	if err := Coordinates(&lat, nil); err == nil {
		t.Fatal("partial coordinates must fail")
	}
	if err := Coordinates(nil, nil); err != nil {
		t.Fatal(err)
	}
}

func TestHexColor(t *testing.T) {
	if got, err := HexColor(" #AABBCC "); err != nil || got != "#aabbcc" {
		t.Fatalf("got %q err %v", got, err)
	}
	for _, invalid := range []string{"aabbcc", "#abc", "#gggggg", "#12345"} {
		if _, err := HexColor(invalid); err == nil {
			t.Errorf("%q should be invalid", invalid)
		}
	}
}
