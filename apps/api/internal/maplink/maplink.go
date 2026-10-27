package maplink

import (
	"context"
	"errors"
	"fmt"
	"io"
	"math"
	"net"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"
)

const (
	maxInputBytes = 2048
	maxRedirects  = 4
)

var (
	ErrInvalidLink   = errors.New("invalid map link")
	ErrNoCoordinates = errors.New("map link has no coordinates")
	ErrUnavailable   = errors.New("map link could not be resolved")
	ErrTimeout       = fmt.Errorf("%w: timed out", ErrUnavailable)
)

type Result struct {
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
	Link      string  `json:"link"`
}

type Resolver struct {
	client *http.Client
}

func New(client *http.Client) *Resolver {
	if client == nil {
		client = &http.Client{Timeout: 8 * time.Second}
	}
	clone := *client
	clone.CheckRedirect = func(*http.Request, []*http.Request) error {
		return http.ErrUseLastResponse
	}
	clone.Jar = nil
	if clone.Timeout == 0 {
		clone.Timeout = 8 * time.Second
	}
	return &Resolver{client: &clone}
}

func (r *Resolver) Resolve(ctx context.Context, raw string) (Result, error) {
	start, err := shortURL(raw)
	if err != nil {
		return Result{}, err
	}

	current := start
	for redirects := 0; ; {
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, current.String(), nil)
		if err != nil {
			return Result{}, ErrInvalidLink
		}
		req.Header.Set("Accept", "text/html,application/xhtml+xml")
		req.Header.Set("User-Agent", "Wayfarer-Map-Link-Resolver/1.0")

		response, err := r.client.Do(req)
		if err != nil {
			return Result{}, transportError(err)
		}
		status := response.StatusCode
		location := response.Header.Get("Location")
		discard(response)

		switch status {
		case http.StatusMovedPermanently, http.StatusFound, http.StatusSeeOther, http.StatusTemporaryRedirect, http.StatusPermanentRedirect:
			if redirects >= maxRedirects {
				return Result{}, fmt.Errorf("%w: too many redirects", ErrInvalidLink)
			}
			next, err := current.Parse(location)
			if err != nil || location == "" {
				return Result{}, fmt.Errorf("%w: invalid redirect", ErrInvalidLink)
			}
			if err := googleURL(next); err != nil {
				return Result{}, err
			}
			current = next
			redirects++
		case http.StatusOK:
			if !isMapsURL(current) {
				return Result{}, ErrNoCoordinates
			}
			latitude, longitude, ok := parseCoordinates(current)
			if !ok {
				return Result{}, ErrNoCoordinates
			}
			return Result{
				Latitude:  latitude,
				Longitude: longitude,
				Link:      mapsLink(latitude, longitude),
			}, nil
		default:
			return Result{}, ErrUnavailable
		}
	}
}

func shortURL(raw string) (*url.URL, error) {
	value := strings.TrimSpace(raw)
	if value == "" || len(value) > maxInputBytes || strings.ContainsAny(value, "\r\n") {
		return nil, ErrInvalidLink
	}
	parsed, err := url.Parse(value)
	if err != nil || parsed.User != nil || parsed.Port() != "" || parsed.Scheme != "https" {
		return nil, ErrInvalidLink
	}
	host := strings.ToLower(parsed.Hostname())
	if host != "maps.app.goo.gl" && host != "goo.gl" {
		return nil, ErrInvalidLink
	}
	return parsed, nil
}

var googleHostPattern = regexp.MustCompile(`(?i)^(?:[a-z0-9-]+\.)*google\.[a-z]{2,3}(?:\.[a-z]{2})?$`)

func googleURL(parsed *url.URL) error {
	if parsed == nil || parsed.User != nil || parsed.Port() != "" || parsed.Scheme != "https" {
		return ErrInvalidLink
	}
	host := strings.ToLower(strings.TrimSuffix(parsed.Hostname(), "."))
	if host == "goo.gl" || host == "maps.app.goo.gl" || googleHostPattern.MatchString(host) {
		return nil
	}
	return fmt.Errorf("%w: redirects outside Google Maps", ErrInvalidLink)
}

func isMapsURL(parsed *url.URL) bool {
	host := strings.ToLower(strings.TrimSuffix(parsed.Hostname(), "."))
	if host == "maps.google.com" || host == "maps.app.goo.gl" {
		return true
	}
	return googleHostPattern.MatchString(host) && strings.HasPrefix(parsed.Path, "/maps")
}

func discard(response *http.Response) {
	if response.Body == nil {
		return
	}
	_, _ = io.Copy(io.Discard, io.LimitReader(response.Body, 32<<10))
	_ = response.Body.Close()
}

func transportError(err error) error {
	if errors.Is(err, context.DeadlineExceeded) || errors.Is(err, context.Canceled) {
		return ErrTimeout
	}
	var networkError net.Error
	if errors.As(err, &networkError) && networkError.Timeout() {
		return ErrTimeout
	}
	return ErrUnavailable
}

const number = `-?\d{1,3}(?:\.\d+)?`

var (
	pairPattern     = regexp.MustCompile(`(` + number + `)\s*,\s*(` + number + `)`)
	placePattern    = regexp.MustCompile(`!3d(` + number + `)!4d(` + number + `)`)
	viewportPattern = regexp.MustCompile(`@(` + number + `),(` + number + `)`)
)

func parseCoordinates(parsed *url.URL) (float64, float64, bool) {
	decoded := parsed.String()
	if value, err := url.PathUnescape(decoded); err == nil {
		decoded = value
	}

	if match := placePattern.FindStringSubmatch(decoded); match != nil {
		if latitude, longitude, ok := coordinatePair(match[1], match[2]); ok {
			return latitude, longitude, true
		}
	}
	if match := viewportPattern.FindStringSubmatch(decoded); match != nil {
		if latitude, longitude, ok := coordinatePair(match[1], match[2]); ok {
			return latitude, longitude, true
		}
	}
	for _, key := range []string{"q", "query", "ll", "center", "latlng", "destination", "daddr", "saddr"} {
		value := parsed.Query().Get(key)
		if value == "" {
			continue
		}
		if match := pairPattern.FindStringSubmatch(value); match != nil {
			if latitude, longitude, ok := coordinatePair(match[1], match[2]); ok {
				return latitude, longitude, true
			}
		}
	}
	return 0, 0, false
}

func coordinatePair(latitudeText, longitudeText string) (float64, float64, bool) {
	latitude, latitudeErr := strconv.ParseFloat(latitudeText, 64)
	longitude, longitudeErr := strconv.ParseFloat(longitudeText, 64)
	if latitudeErr != nil || longitudeErr != nil {
		return 0, 0, false
	}
	if math.Abs(latitude) > 90 || math.Abs(longitude) > 180 {
		return 0, 0, false
	}
	return latitude, longitude, true
}

func mapsLink(latitude, longitude float64) string {
	return fmt.Sprintf(
		"https://www.google.com/maps?q=%s,%s",
		strconv.FormatFloat(latitude, 'f', -1, 64),
		strconv.FormatFloat(longitude, 'f', -1, 64),
	)
}
