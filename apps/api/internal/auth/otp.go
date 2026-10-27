package auth

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"fmt"
	"math/big"
	"strings"
)

// GenerateOTP returns a cryptographically random zero-padded six-digit code.
func GenerateOTP() (string, error) {
	n, err := rand.Int(rand.Reader, big.NewInt(1_000_000))
	if err != nil {
		return "", fmt.Errorf("generate otp: %w", err)
	}
	return fmt.Sprintf("%06d", n.Int64()), nil
}

// DigestOTP stores only a keyed digest of challenge id + code.
func DigestOTP(secret []byte, challengeID, code string) []byte {
	mac := hmac.New(sha256.New, secret)
	mac.Write([]byte(challengeID))
	mac.Write([]byte(":"))
	mac.Write([]byte(code))
	return mac.Sum(nil)
}

func EqualDigest(a, b []byte) bool {
	return subtle.ConstantTimeCompare(a, b) == 1
}

// NewOpaqueToken returns a URL-safe random token and its SHA-256 hash.
func NewOpaqueToken() (plain string, hash []byte, err error) {
	buf := make([]byte, 32)
	if _, err = rand.Read(buf); err != nil {
		return "", nil, fmt.Errorf("generate token: %w", err)
	}
	plain = base64.RawURLEncoding.EncodeToString(buf)
	return plain, HashToken(plain), nil
}

func HashToken(plain string) []byte {
	sum := sha256.Sum256([]byte(plain))
	return sum[:]
}

func NormalizeEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}

func DisplayNameFromEmail(email string) string {
	local := strings.SplitN(email, "@", 2)[0]
	local = strings.NewReplacer(".", " ", "_", " ", "-", " ").Replace(local)
	local = strings.Join(strings.Fields(local), " ")
	if local == "" {
		return "Traveller"
	}
	if len(local) > 60 {
		local = local[:60]
	}
	return strings.ToUpper(local[:1]) + local[1:]
}
