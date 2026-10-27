package store

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"

	"wayfarer/api/internal/apperr"
	"wayfarer/api/internal/auth"
)

const invitationColumns = `
	i.id, i.trip_id, i.email, i.role,
	CASE WHEN i.accepted_at IS NOT NULL THEN 'accepted'
	     WHEN i.revoked_at IS NOT NULL THEN 'revoked'
	     WHEN i.expires_at < now() THEN 'expired'
	     ELSE 'pending' END AS status,
	i.expires_at, i.created_at, i.last_sent_at, inviter.display_name`

func scanInvitation(row scanner) (Invitation, error) {
	var inv Invitation
	err := row.Scan(&inv.ID, &inv.TripID, &inv.Email, &inv.Role, &inv.Status,
		&inv.ExpiresAt, &inv.CreatedAt, &inv.LastSentAt, &inv.InvitedByName)
	return inv, err
}

func (s *Store) CreateInvitation(ctx context.Context, tripID, inviterID, email, role string, tokenHash []byte, expires time.Time) (Invitation, error) {
	var inv Invitation
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return inv, err
	}
	defer rollback(ctx, tx)

	var alreadyMember bool
	if err := tx.QueryRow(ctx,
		`SELECT EXISTS(
		   SELECT 1 FROM trip_members tm JOIN users u ON u.id = tm.user_id
		   WHERE tm.trip_id = $1 AND u.email = $2)`, tripID, email).Scan(&alreadyMember); err != nil {
		return inv, err
	}
	if alreadyMember {
		return inv, apperr.New(409, "already_member", "That person is already a member of this trip.")
	}
	var recent int
	if err := tx.QueryRow(ctx,
		`SELECT count(*) FROM trip_invitations WHERE trip_id=$1 AND invited_by=$2 AND created_at > now() - interval '1 hour'`,
		tripID, inviterID).Scan(&recent); err != nil {
		return inv, err
	}
	if recent >= 20 {
		return inv, apperr.New(429, "invite_rate_limited", "Too many invitations sent. Try again later.")
	}

	var invID string
	err = tx.QueryRow(ctx,
		`INSERT INTO trip_invitations (trip_id, email, role, token_hash, invited_by, expires_at)
		 VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
		tripID, email, role, tokenHash, inviterID, expires).Scan(&invID)
	if err != nil {
		if isUnique(err) {
			return inv, apperr.New(409, "invitation_exists", "An active invitation already exists for that email.")
		}
		return inv, mapWriteError(err)
	}
	inv, err = scanInvitation(tx.QueryRow(ctx,
		`SELECT `+invitationColumns+`
		 FROM trip_invitations i JOIN users inviter ON inviter.id = i.invited_by
		 WHERE i.id=$1`, invID))
	if err != nil {
		return inv, err
	}
	if err := tx.Commit(ctx); err != nil {
		return inv, err
	}
	return inv, nil
}

func (s *Store) ListInvitations(ctx context.Context, tripID string) ([]Invitation, error) {
	rows, err := s.Pool.Query(ctx,
		`SELECT `+invitationColumns+`
		 FROM trip_invitations i JOIN users inviter ON inviter.id = i.invited_by
		 WHERE i.trip_id=$1 ORDER BY i.created_at DESC LIMIT 100`, tripID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []Invitation{}
	for rows.Next() {
		inv, err := scanInvitation(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, inv)
	}
	return items, rows.Err()
}

func (s *Store) ResendInvitation(ctx context.Context, tripID, invitationID string, tokenHash []byte, expires time.Time) (Invitation, error) {
	var inv Invitation
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return inv, err
	}
	defer rollback(ctx, tx)
	var id string
	err = tx.QueryRow(ctx,
		`UPDATE trip_invitations
		 SET token_hash=$3, expires_at=$4, last_sent_at=now()
		 WHERE id=$1 AND trip_id=$2 AND accepted_at IS NULL AND revoked_at IS NULL
		 RETURNING id`, invitationID, tripID, tokenHash, expires).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return inv, apperr.ErrConflict
	}
	if err != nil {
		return inv, mapWriteError(err)
	}
	inv, err = scanInvitation(tx.QueryRow(ctx,
		`SELECT `+invitationColumns+`
		 FROM trip_invitations i JOIN users inviter ON inviter.id = i.invited_by
		 WHERE i.id=$1`, id))
	if err != nil {
		return inv, err
	}
	return inv, tx.Commit(ctx)
}

func (s *Store) RevokeInvitation(ctx context.Context, tripID, invitationID string) error {
	tag, err := s.Pool.Exec(ctx,
		`UPDATE trip_invitations SET revoked_at=now()
		 WHERE id=$1 AND trip_id=$2 AND accepted_at IS NULL AND revoked_at IS NULL`, invitationID, tripID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return apperr.ErrConflict
	}
	return nil
}

func (s *Store) PreviewInvitation(ctx context.Context, tokenHash []byte) (InvitationPreview, string, error) {
	var p InvitationPreview
	var email string
	err := s.Pool.QueryRow(ctx,
		`SELECT i.trip_id, t.title, t.destination,
		        to_char(t.start_date,'YYYY-MM-DD'), to_char(t.end_date,'YYYY-MM-DD'),
		        inviter.display_name, i.email, i.role, i.expires_at,
		        CASE WHEN i.accepted_at IS NOT NULL THEN 'accepted'
		             WHEN i.revoked_at IS NOT NULL THEN 'revoked'
		             WHEN i.expires_at < now() THEN 'expired'
		             ELSE 'pending' END
		 FROM trip_invitations i
		 JOIN trips t ON t.id = i.trip_id
		 JOIN users inviter ON inviter.id = i.invited_by
		 WHERE i.token_hash=$1`, tokenHash).
		Scan(&p.TripID, &p.TripTitle, &p.Destination, &p.StartDate, &p.EndDate,
			&p.InviterName, &email, &p.Role, &p.ExpiresAt, &p.Status)
	if errors.Is(err, pgx.ErrNoRows) {
		return p, "", apperr.ErrNotFound
	}
	if err != nil {
		return p, "", err
	}
	p.MaskedEmail = maskEmail(email)
	return p, email, nil
}

type AcceptResult struct {
	TripID        string `json:"trip_id"`
	Role          string `json:"role"`
	AlreadyMember bool   `json:"already_member"`
}

func (s *Store) AcceptInvitation(ctx context.Context, tokenHash []byte, userID, userEmail string) (AcceptResult, error) {
	var result AcceptResult
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return result, err
	}
	defer rollback(ctx, tx)

	var invID, tripID, invitedEmail, role string
	var expiresAt time.Time
	var acceptedAt, revokedAt *time.Time
	err = tx.QueryRow(ctx,
		`SELECT id, trip_id, email, role, expires_at, accepted_at, revoked_at
		 FROM trip_invitations WHERE token_hash=$1 FOR UPDATE`, tokenHash).
		Scan(&invID, &tripID, &invitedEmail, &role, &expiresAt, &acceptedAt, &revokedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return result, apperr.ErrNotFound
	}
	if err != nil {
		return result, err
	}
	if revokedAt != nil || expiresAt.Before(time.Now()) {
		return result, apperr.ErrExpired
	}
	if auth.NormalizeEmail(invitedEmail) != auth.NormalizeEmail(userEmail) {
		return result, apperr.New(403, "invite_email_mismatch", "This invitation was sent to a different email address. Sign in with the invited email.")
	}

	var existingRole string
	err = tx.QueryRow(ctx, `SELECT role FROM trip_members WHERE trip_id=$1 AND user_id=$2`, tripID, userID).Scan(&existingRole)
	if errors.Is(err, pgx.ErrNoRows) {
		if _, err := tx.Exec(ctx,
			`INSERT INTO trip_members (trip_id, user_id, role) VALUES ($1,$2,$3)`, tripID, userID, role); err != nil {
			return result, mapWriteError(err)
		}
		result.Role = role
	} else if err != nil {
		return result, err
	} else {
		result.Role = existingRole
		result.AlreadyMember = true
	}
	if acceptedAt == nil {
		if _, err := tx.Exec(ctx, `UPDATE trip_invitations SET accepted_at=now() WHERE id=$1`, invID); err != nil {
			return result, err
		}
	}
	result.TripID = tripID
	return result, tx.Commit(ctx)
}

func maskEmail(email string) string {
	parts := strings.SplitN(email, "@", 2)
	if len(parts) != 2 {
		return "•••"
	}
	local := parts[0]
	if len(local) <= 2 {
		return "••" + "@" + parts[1]
	}
	return local[:1] + strings.Repeat("•", len(local)-1) + "@" + parts[1]
}
