package maplink

import (
	"context"
	"errors"
	"io"
	"net/http"
	"strings"
	"testing"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(request *http.Request) (*http.Response, error) {
	return f(request)
}

func redirect(location string) *http.Response {
	return &http.Response{
		StatusCode: http.StatusFound,
		Header:     http.Header{"Location": []string{location}},
		Body:       io.NopCloser(strings.NewReader("")),
	}
}

func success() *http.Response {
	return &http.Response{
		StatusCode: http.StatusOK,
		Header:     http.Header{},
		Body:       io.NopCloser(strings.NewReader("")),
	}
}

func TestResolvePlaceCoordinates(t *testing.T) {
	var calls int
	client := &http.Client{Transport: roundTripFunc(func(request *http.Request) (*http.Response, error) {
		calls++
		if request.Header.Get("Cookie") != "" {
			t.Fatal("resolver must not send cookies")
		}
		if !strings.Contains(request.Header.Get("User-Agent"), "Wayfarer") {
			t.Fatal("missing user agent")
		}
		if calls == 1 {
			return redirect("https://www.google.com/maps/place/Kyoto/@35.0116,135.7681,15z/data=!4m2!3d35.0116!4d135.7681"), nil
		}
		return success(), nil
	})}
	result, err := New(client).Resolve(context.Background(), "https://maps.app.goo.gl/example")
	if err != nil {
		t.Fatalf("Resolve: %v", err)
	}
	if result.Latitude != 35.0116 || result.Longitude != 135.7681 {
		t.Fatalf("unexpected coordinates: %+v", result)
	}
	if result.Link != "https://www.google.com/maps?q=35.0116,135.7681" {
		t.Fatalf("unexpected link: %s", result.Link)
	}
}

func TestResolveQueryCoordinates(t *testing.T) {
	calls := 0
	client := &http.Client{Transport: roundTripFunc(func(*http.Request) (*http.Response, error) {
		calls++
		if calls == 1 {
			return redirect("https://maps.google.com/?q=loc:48.8584,2.2945"), nil
		}
		return success(), nil
	})}
	result, err := New(client).Resolve(context.Background(), "https://goo.gl/example")
	if err != nil {
		t.Fatalf("Resolve: %v", err)
	}
	if result.Latitude != 48.8584 || result.Longitude != 2.2945 {
		t.Fatalf("unexpected coordinates: %+v", result)
	}
}

func TestResolveRejectsNonGoogleRedirect(t *testing.T) {
	client := &http.Client{Transport: roundTripFunc(func(*http.Request) (*http.Response, error) {
		return redirect("https://example.com/maps/@35.0116,135.7681"), nil
	})}
	_, err := New(client).Resolve(context.Background(), "https://goo.gl/example")
	if !errors.Is(err, ErrInvalidLink) {
		t.Fatalf("expected ErrInvalidLink, got %v", err)
	}
}

func TestResolveRejectsNoCoordinates(t *testing.T) {
	calls := 0
	client := &http.Client{Transport: roundTripFunc(func(*http.Request) (*http.Response, error) {
		calls++
		if calls == 1 {
			return redirect("https://www.google.com/maps/place/Kyoto"), nil
		}
		return success(), nil
	})}
	_, err := New(client).Resolve(context.Background(), "https://maps.app.goo.gl/example")
	if !errors.Is(err, ErrNoCoordinates) {
		t.Fatalf("expected ErrNoCoordinates, got %v", err)
	}
}

func TestResolveLimitsRedirects(t *testing.T) {
	calls := 0
	client := &http.Client{Transport: roundTripFunc(func(*http.Request) (*http.Response, error) {
		calls++
		return redirect("https://www.google.com/maps/place/Kyoto"), nil
	})}
	_, err := New(client).Resolve(context.Background(), "https://maps.app.goo.gl/example")
	if !errors.Is(err, ErrInvalidLink) {
		t.Fatalf("expected ErrInvalidLink, got %v", err)
	}
	if calls != maxRedirects+1 {
		t.Fatalf("expected %d requests, got %d", maxRedirects+1, calls)
	}
}

func TestResolveTimeout(t *testing.T) {
	client := &http.Client{Transport: roundTripFunc(func(*http.Request) (*http.Response, error) {
		return nil, context.DeadlineExceeded
	})}
	_, err := New(client).Resolve(context.Background(), "https://maps.app.goo.gl/example")
	if !errors.Is(err, ErrTimeout) {
		t.Fatalf("expected ErrTimeout, got %v", err)
	}
}

func TestResolveRejectsUntrustedInput(t *testing.T) {
	for _, raw := range []string{
		"https://example.com/maps",
		"http://maps.app.goo.gl/example",
		"https://maps.app.goo.gl.example/example",
		"https://user:pass@maps.app.goo.gl/example",
		"https://maps.app.goo.gl:8443/example",
		"",
	} {
		if _, err := New(nil).Resolve(context.Background(), raw); !errors.Is(err, ErrInvalidLink) {
			t.Fatalf("%q: expected ErrInvalidLink, got %v", raw, err)
		}
	}
}

func TestResolveRejectsGooglePageWithoutCoordinates(t *testing.T) {
	calls := 0
	client := &http.Client{Transport: roundTripFunc(func(*http.Request) (*http.Response, error) {
		calls++
		if calls == 1 {
			return redirect("https://www.google.com/url?q=https://example.com/@35.0116,135.7681"), nil
		}
		return success(), nil
	})}
	_, err := New(client).Resolve(context.Background(), "https://maps.app.goo.gl/example")
	if !errors.Is(err, ErrNoCoordinates) {
		t.Fatalf("expected ErrNoCoordinates, got %v", err)
	}
}
