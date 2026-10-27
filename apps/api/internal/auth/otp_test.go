package auth

import (
	"bytes"
	"strings"
	"testing"
)

func TestGenerateOTP(t *testing.T) {
	seen := map[string]bool{}
	for i := 0; i < 200; i++ {
		code, err := GenerateOTP()
		if err != nil {
			t.Fatal(err)
		}
		if len(code) != 6 || strings.Trim(code, "0123456789") != "" {
			t.Fatalf("code %q is not six digits", code)
		}
		seen[code] = true
	}
	if len(seen) < 50 {
		t.Fatalf("expected varied codes, got %d unique", len(seen))
	}
}

func TestDigestOTPIsKeyedAndBound(t *testing.T) {
	secret := []byte("test-secret")
	a := DigestOTP(secret, "challenge-a", "123456")
	b := DigestOTP(secret, "challenge-a", "123456")
	if !EqualDigest(a, b) {
		t.Fatal("digest should be deterministic")
	}
	if EqualDigest(a, DigestOTP(secret, "challenge-b", "123456")) {
		t.Fatal("digest must bind the challenge id")
	}
	if EqualDigest(a, DigestOTP(secret, "challenge-a", "123457")) {
		t.Fatal("digest must bind the code")
	}
	if EqualDigest(a, DigestOTP([]byte("other-secret"), "challenge-a", "123456")) {
		t.Fatal("digest must use the server secret")
	}
	if bytes.Contains(a, []byte("123456")) {
		t.Fatal("digest must not contain the plaintext code")
	}
}

func TestOpaqueTokens(t *testing.T) {
	plain, hash, err := NewOpaqueToken()
	if err != nil {
		t.Fatal(err)
	}
	if len(plain) < 40 {
		t.Fatalf("token too short: %d", len(plain))
	}
	if len(hash) != 32 {
		t.Fatalf("expected sha256 length, got %d", len(hash))
	}
	if !EqualDigest(hash, HashToken(plain)) {
		t.Fatal("hash should match token")
	}
	plain2, _, _ := NewOpaqueToken()
	if plain == plain2 {
		t.Fatal("tokens must be unique")
	}
}

func TestEmailHelpers(t *testing.T) {
	if got := NormalizeEmail("  Alex@Example.COM "); got != "alex@example.com" {
		t.Fatalf("unexpected normalization: %q", got)
	}
	if got := DisplayNameFromEmail("alex.morgan@example.com"); got != "Alex morgan" {
		t.Fatalf("unexpected display name: %q", got)
	}
}
