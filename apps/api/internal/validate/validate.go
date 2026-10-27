package validate

import (
	"net/mail"
	"net/url"
	"strings"
	"time"
	"unicode/utf8"

	"wayfarer/api/internal/apperr"
)

func Email(v string) (string, error) {
	v = strings.ToLower(strings.TrimSpace(v))
	if len(v) < 3 || len(v) > 320 {
		return "", apperr.WithFields(apperr.ErrValidation, map[string]string{"email": "Enter a valid email address."})
	}
	addr, err := mail.ParseAddress(v)
	if err != nil || addr.Address != v || !strings.Contains(v, "@") {
		return "", apperr.WithFields(apperr.ErrValidation, map[string]string{"email": "Enter a valid email address."})
	}
	return v, nil
}

func Required(v string, field string, max int) (string, error) {
	v = strings.TrimSpace(v)
	if v == "" {
		return "", apperr.WithFields(apperr.ErrValidation, map[string]string{field: "This field is required."})
	}
	if utf8.RuneCountInString(v) > max {
		return "", apperr.WithFields(apperr.ErrValidation, map[string]string{field: "This is too long."})
	}
	return v, nil
}

func Optional(v string, field string, max int) (string, error) {
	v = strings.TrimSpace(v)
	if utf8.RuneCountInString(v) > max {
		return "", apperr.WithFields(apperr.ErrValidation, map[string]string{field: "This is too long."})
	}
	return v, nil
}

var CurrencyNames = map[string]bool{
	"AED": true, "ARS": true, "AUD": true, "BRL": true, "CAD": true, "CHF": true,
	"CLP": true, "CNY": true, "COP": true, "CZK": true, "DKK": true, "EGP": true,
	"EUR": true, "GBP": true, "HKD": true, "HUF": true, "IDR": true, "ILS": true,
	"INR": true, "ISK": true, "JPY": true, "KRW": true, "MAD": true, "MXN": true,
	"MYR": true, "NOK": true, "NZD": true, "PEN": true, "PHP": true, "PLN": true,
	"QAR": true, "RON": true, "SAR": true, "SEK": true, "SGD": true, "THB": true,
	"TRY": true, "TWD": true, "USD": true, "VND": true, "ZAR": true,
}

func Currency(v string) (string, error) {
	v = strings.ToUpper(strings.TrimSpace(v))
	if !CurrencyNames[v] {
		return "", apperr.WithFields(apperr.ErrValidation, map[string]string{"currency": "Choose a supported ISO 4217 currency."})
	}
	return v, nil
}

func Timezone(v string) (string, error) {
	v = strings.TrimSpace(v)
	if v == "" {
		return "", apperr.WithFields(apperr.ErrValidation, map[string]string{"timezone": "Timezone is required."})
	}
	if _, err := time.LoadLocation(v); err != nil {
		return "", apperr.WithFields(apperr.ErrValidation, map[string]string{"timezone": "Use a valid IANA timezone such as Asia/Kolkata."})
	}
	return v, nil
}

func Date(v string, field string) (string, error) {
	v = strings.TrimSpace(v)
	if _, err := time.Parse("2006-01-02", v); err != nil {
		return "", apperr.WithFields(apperr.ErrValidation, map[string]string{field: "Use a valid date."})
	}
	return v, nil
}

// Time returns HH:MM 24-hour local time or an empty value.
func TimeValue(v string, field string) (string, error) {
	v = strings.TrimSpace(v)
	if v == "" {
		return "", nil
	}
	if len(v) == 5 {
		if _, err := time.Parse("15:04", v); err == nil {
			return v, nil
		}
	}
	if len(v) == 8 {
		if t, err := time.Parse("15:04:05", v); err == nil {
			return t.Format("15:04"), nil
		}
	}
	return "", apperr.WithFields(apperr.ErrValidation, map[string]string{field: "Use a valid time (HH:MM)."})
}

func URLOrEmpty(v string, field string) (string, error) {
	v = strings.TrimSpace(v)
	if v == "" {
		return "", nil
	}
	if len(v) > 2048 {
		return "", apperr.WithFields(apperr.ErrValidation, map[string]string{field: "URL is too long."})
	}
	u, err := url.Parse(v)
	if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" {
		return "", apperr.WithFields(apperr.ErrValidation, map[string]string{field: "Use a full http(s) URL."})
	}
	return v, nil
}

func Coordinates(lat, lng *float64) error {
	if (lat == nil) != (lng == nil) {
		return apperr.WithFields(apperr.ErrValidation, map[string]string{"location": "Provide both latitude and longitude, or neither."})
	}
	if lat != nil && (*lat < -90 || *lat > 90 || *lng < -180 || *lng > 180) {
		return apperr.WithFields(apperr.ErrValidation, map[string]string{"location": "Coordinates are out of range."})
	}
	return nil
}

func HexColor(v string) (string, error) {
	v = strings.TrimSpace(v)
	if len(v) != 7 || v[0] != '#' {
		return "", apperr.WithFields(apperr.ErrValidation, map[string]string{"color": "Choose a hex color."})
	}
	for _, r := range v[1:] {
		if (r < '0' || r > '9') && (r < 'a' || r > 'f') && (r < 'A' || r > 'F') {
			return "", apperr.WithFields(apperr.ErrValidation, map[string]string{"color": "Choose a hex color."})
		}
	}
	return strings.ToLower(v), nil
}
