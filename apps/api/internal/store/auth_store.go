package store

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"

	"wayfarer/api/internal/apperr"
	"wayfarer/api/internal/auth"
)

func (s *Store) CreateOTPChallenge(ctx context.Context, id, email string, digest []byte, expires time.Time, ip string, cooldown time.Duration, emailLimit, ipLimit int) error {
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer rollback(ctx, tx)

	var emailCount int
	if err := tx.QueryRow(ctx,
		`SELECT count(*) FROM otp_challenges WHERE email = $1 AND created_at > now() - interval '15 minutes'`,
		email).Scan(&emailCount); err != nil {
		return err
	}
	if emailCount >= emailLimit {
		return apperr.ErrRateLimited
	}
	if ip != "" {
		var ipCount int
		if err := tx.QueryRow(ctx,
			`SELECT count(*) FROM otp_challenges WHERE request_ip = NULLIF($1,'')::inet AND created_at > now() - interval '15 minutes'`,
			ip).Scan(&ipCount); err != nil {
			return err
		}
		if ipCount >= ipLimit {
			return apperr.ErrRateLimited
		}
	}
	var lastCreated time.Time
	err = tx.QueryRow(ctx,
		`SELECT created_at FROM otp_challenges WHERE email = $1 ORDER BY created_at DESC LIMIT 1`, email).Scan(&lastCreated)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return err
	}
	if err == nil && time.Since(lastCreated) < cooldown {
		return apperr.New(429, "cooldown", "Please wait a minute before requesting another code.")
	}

	if _, err := tx.Exec(ctx,
		`UPDATE otp_challenges SET consumed_at = now() WHERE email = $1 AND consumed_at IS NULL`, email); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx,
		`INSERT INTO otp_challenges (id, email, code_hmac, expires_at, request_ip) VALUES ($1,$2,$3,$4,NULLIF($5,'')::inet)`,
		id, email, digest, expires, ip); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// VerifyOTP locks the newest live challenge, increments attempts atomically,
// compares the keyed digest and, on success, consumes the challenge, upserts the
// user and stores a new session hash in one transaction.
func (s *Store) VerifyOTP(ctx context.Context, email string, digestFor func(challengeID string) []byte, sessionHash []byte, sessionExpires time.Time, ip, userAgent string) (User, error) {
	var user User
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return user, err
	}
	defer rollback(ctx, tx)

	var ch OTPChallenge
	err = tx.QueryRow(ctx,
		`SELECT id, email, code_hmac, expires_at, attempts
		 FROM otp_challenges
		 WHERE email = $1 AND consumed_at IS NULL
		 ORDER BY created_at DESC LIMIT 1 FOR UPDATE`, email).
		Scan(&ch.ID, &ch.Email, &ch.CodeHMAC, &ch.ExpiresAt, &ch.Attempts)
	if errors.Is(err, pgx.ErrNoRows) {
		return user, apperr.New(400, "invalid_code", "That code is incorrect or has expired.")
	}
	if err != nil {
		return user, err
	}
	if ch.ExpiresAt.Before(time.Now()) {
		_, _ = tx.Exec(ctx, `UPDATE otp_challenges SET consumed_at = now() WHERE id = $1`, ch.ID)
		_ = tx.Commit(ctx)
		return user, apperr.New(400, "invalid_code", "That code is incorrect or has expired.")
	}
	if ch.Attempts >= 5 {
		_, _ = tx.Exec(ctx, `UPDATE otp_challenges SET consumed_at = now() WHERE id = $1`, ch.ID)
		_ = tx.Commit(ctx)
		return user, apperr.New(400, "invalid_code", "That code is incorrect or has expired.")
	}
	newAttempts := ch.Attempts + 1
	if _, err := tx.Exec(ctx, `UPDATE otp_challenges SET attempts = $2 WHERE id = $1`, ch.ID, newAttempts); err != nil {
		return user, err
	}
	if !auth.EqualDigest(ch.CodeHMAC, digestFor(ch.ID)) {
		if newAttempts >= 5 {
			_, _ = tx.Exec(ctx, `UPDATE otp_challenges SET consumed_at = now() WHERE id = $1`, ch.ID)
		}
		if err := tx.Commit(ctx); err != nil {
			return user, err
		}
		return user, apperr.New(400, "invalid_code", "That code is incorrect or has expired.")
	}

	if _, err := tx.Exec(ctx, `UPDATE otp_challenges SET consumed_at = now() WHERE id = $1`, ch.ID); err != nil {
		return user, err
	}
	displayName := auth.DisplayNameFromEmail(email)
	err = tx.QueryRow(ctx,
		`INSERT INTO users (email, display_name) VALUES ($1, $2)
		 ON CONFLICT (email) DO UPDATE SET
		   display_name = CASE WHEN users.display_name = '' THEN EXCLUDED.display_name ELSE users.display_name END,
		   updated_at = now()
		 RETURNING id, email, display_name, created_at`, email, displayName).
		Scan(&user.ID, &user.Email, &user.DisplayName, &user.CreatedAt)
	if err != nil {
		return user, err
	}
	_, err = tx.Exec(ctx,
		`INSERT INTO sessions (user_id, token_hash, expires_at, ip, user_agent)
		 VALUES ($1,$2,$3,NULLIF($4,'')::inet,$5)`,
		user.ID, sessionHash, sessionExpires, ip, userAgent)
	if err != nil {
		return user, err
	}
	return user, tx.Commit(ctx)
}

func (s *Store) GetSessionUser(ctx context.Context, tokenHash []byte) (User, error) {
	var u User
	err := s.Pool.QueryRow(ctx,
		`SELECT u.id, u.email, u.display_name, u.created_at
		 FROM sessions s JOIN users u ON u.id = s.user_id
		 WHERE s.token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > now()`,
		tokenHash).Scan(&u.ID, &u.Email, &u.DisplayName, &u.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return u, apperr.ErrUnauthorized
	}
	if err != nil {
		return u, err
	}
	_, _ = s.Pool.Exec(ctx, `UPDATE sessions SET last_used_at = now() WHERE token_hash = $1`, tokenHash)
	return u, nil
}

func (s *Store) RevokeSession(ctx context.Context, tokenHash []byte) error {
	_, err := s.Pool.Exec(ctx,
		`UPDATE sessions SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL`, tokenHash)
	return err
}

func (s *Store) GetUser(ctx context.Context, id string) (User, error) {
	var u User
	err := s.Pool.QueryRow(ctx,
		`SELECT id, email, display_name, created_at FROM users WHERE id = $1`, id).
		Scan(&u.ID, &u.Email, &u.DisplayName, &u.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return u, apperr.ErrNotFound
	}
	return u, err
}

// RecordAuthAudit stores a login/security event. It never stores OTP codes or
// session tokens; callers must not put those values in Reason.
func (s *Store) RecordAuthAudit(ctx context.Context, event AuthAuditEvent) error {
	_, err := s.Pool.Exec(ctx,
		`INSERT INTO auth_audit_events
		   (event, outcome, email, user_id, ip, user_agent, reason, request_id)
		 VALUES ($1, $2, NULLIF($3,'')::citext, NULLIF($4,'')::uuid,
		         NULLIF($5,'')::inet, $6, $7, $8)`,
		event.Event, event.Outcome, event.Email, event.UserID, event.IP,
		event.UserAgent, event.Reason, event.RequestID)
	return err
}
