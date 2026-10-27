package store

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"

	"wayfarer/api/internal/apperr"
)

const tripColumns = `
	t.id, t.owner_id, t.title, t.destination,
	to_char(t.start_date, 'YYYY-MM-DD'), to_char(t.end_date, 'YYYY-MM-DD'),
	t.timezone, t.currency, t.description, t.cover_image_url, t.status,
	t.version, tm.role,
	(SELECT count(*) FROM trip_members m WHERE m.trip_id = t.id) AS member_count,
	t.created_at, t.updated_at`

type scanner interface {
	Scan(dest ...any) error
}

func scanTrip(row scanner) (Trip, error) {
	var t Trip
	err := row.Scan(&t.ID, &t.OwnerID, &t.Title, &t.Destination, &t.StartDate, &t.EndDate,
		&t.Timezone, &t.Currency, &t.Description, &t.CoverImageURL, &t.Status,
		&t.Version, &t.Role, &t.MemberCount, &t.CreatedAt, &t.UpdatedAt)
	return t, err
}

func (s *Store) ListTrips(ctx context.Context, userID, scope string) ([]Trip, error) {
	where := "tm.role = 'owner' AND t.status = 'active'"
	switch scope {
	case "shared":
		where = "tm.role <> 'owner' AND t.status = 'active'"
	case "archived":
		where = "t.status = 'archived'"
	case "", "owned":
	default:
		return nil, apperr.ErrBadRequest
	}
	rows, err := s.Pool.Query(ctx,
		`SELECT `+tripColumns+`
		 FROM trips t JOIN trip_members tm ON tm.trip_id = t.id AND tm.user_id = $1
		 WHERE `+where+`
		 ORDER BY t.start_date ASC, t.created_at DESC LIMIT 100`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	trips := []Trip{}
	for rows.Next() {
		t, err := scanTrip(rows)
		if err != nil {
			return nil, err
		}
		trips = append(trips, t)
	}
	return trips, rows.Err()
}

func (s *Store) GetTrip(ctx context.Context, tripID, userID string) (Trip, error) {
	t, err := scanTrip(s.Pool.QueryRow(ctx,
		`SELECT `+tripColumns+`
		 FROM trips t JOIN trip_members tm ON tm.trip_id = t.id AND tm.user_id = $2
		 WHERE t.id = $1`, tripID, userID))
	if errors.Is(err, pgx.ErrNoRows) {
		return t, apperr.ErrNotFound
	}
	return t, err
}

func (s *Store) GetMembership(ctx context.Context, tripID, userID string) (string, error) {
	var role string
	err := s.Pool.QueryRow(ctx, `SELECT role FROM trip_members WHERE trip_id = $1 AND user_id = $2`, tripID, userID).Scan(&role)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", apperr.ErrNotFound
	}
	return role, err
}

func (s *Store) CreateTrip(ctx context.Context, ownerID string, in TripInput) (Trip, error) {
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return Trip{}, err
	}
	defer rollback(ctx, tx)

	var tripID string
	status := in.Status
	if status == "" {
		status = "active"
	}
	err = tx.QueryRow(ctx,
		`INSERT INTO trips (owner_id, title, destination, start_date, end_date, timezone, currency, description, cover_image_url, status)
		 VALUES ($1,$2,$3,$4::date,$5::date,$6,$7,$8,$9,$10) RETURNING id`,
		ownerID, in.Title, in.Destination, in.StartDate, in.EndDate, in.Timezone, in.Currency, in.Description, in.CoverImageURL, status).Scan(&tripID)
	if err != nil {
		return Trip{}, mapWriteError(err)
	}
	if _, err := tx.Exec(ctx,
		`INSERT INTO trip_members (trip_id, user_id, role) VALUES ($1,$2,'owner')`, tripID, ownerID); err != nil {
		return Trip{}, err
	}
	if _, err := tx.Exec(ctx,
		`INSERT INTO itinerary_days (trip_id, date, position)
		 SELECT $1, d::date, row_number() OVER (ORDER BY d)
		 FROM generate_series($2::date, $3::date, '1 day') AS d
		 ON CONFLICT (trip_id, date) DO NOTHING`, tripID, in.StartDate, in.EndDate); err != nil {
		return Trip{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return Trip{}, err
	}
	return s.GetTrip(ctx, tripID, ownerID)
}

func (s *Store) UpdateTrip(ctx context.Context, tripID, ownerID string, in TripInput) (Trip, error) {
	status := in.Status
	if status == "" {
		status = "active"
	}
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return Trip{}, err
	}
	defer rollback(ctx, tx)

	var id string
	err = tx.QueryRow(ctx,
		`UPDATE trips SET title=$3, destination=$4, start_date=$5::date, end_date=$6::date,
		   timezone=$7, currency=$8, description=$9, cover_image_url=$10, status=$11, version=version+1
		 WHERE id=$1 AND owner_id=$2 AND version=$12
		 RETURNING id`,
		tripID, ownerID, in.Title, in.Destination, in.StartDate, in.EndDate, in.Timezone, in.Currency,
		in.Description, in.CoverImageURL, status, in.Version).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return Trip{}, apperr.ErrConflict
	}
	if err != nil {
		return Trip{}, mapWriteError(err)
	}
	if _, err := tx.Exec(ctx,
		`DELETE FROM itinerary_days d
		 WHERE d.trip_id=$1 AND (d.date < $2::date OR d.date > $3::date)
		   AND NOT EXISTS (SELECT 1 FROM itinerary_items i WHERE i.day_id = d.id)`,
		tripID, in.StartDate, in.EndDate); err != nil {
		return Trip{}, err
	}
	if _, err := tx.Exec(ctx,
		`INSERT INTO itinerary_days (trip_id, date, position)
		 SELECT $1, d::date, row_number() OVER (ORDER BY d)
		 FROM generate_series($2::date, $3::date, '1 day') AS d
		 ON CONFLICT (trip_id, date) DO NOTHING`, tripID, in.StartDate, in.EndDate); err != nil {
		return Trip{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return Trip{}, err
	}
	return s.GetTrip(ctx, tripID, ownerID)
}

func (s *Store) ListMembers(ctx context.Context, tripID string) ([]Member, error) {
	rows, err := s.Pool.Query(ctx,
		`SELECT u.id, u.email, u.display_name, tm.role, tm.joined_at
		 FROM trip_members tm JOIN users u ON u.id = tm.user_id
		 WHERE tm.trip_id = $1
		 ORDER BY CASE tm.role WHEN 'owner' THEN 0 WHEN 'editor' THEN 1 ELSE 2 END, u.display_name`, tripID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	members := []Member{}
	for rows.Next() {
		var m Member
		if err := rows.Scan(&m.UserID, &m.Email, &m.DisplayName, &m.Role, &m.JoinedAt); err != nil {
			return nil, err
		}
		members = append(members, m)
	}
	return members, rows.Err()
}

func (s *Store) UpdateMemberRole(ctx context.Context, tripID, userID, role string) error {
	tag, err := s.Pool.Exec(ctx,
		`UPDATE trip_members SET role=$3 WHERE trip_id=$1 AND user_id=$2 AND role <> 'owner'`,
		tripID, userID, role)
	if err != nil {
		return mapWriteError(err)
	}
	if tag.RowsAffected() == 0 {
		return apperr.ErrConflict
	}
	return nil
}

func (s *Store) RemoveMember(ctx context.Context, tripID, userID string) error {
	tag, err := s.Pool.Exec(ctx,
		`DELETE FROM trip_members WHERE trip_id=$1 AND user_id=$2 AND role <> 'owner'`, tripID, userID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return apperr.ErrConflict
	}
	return nil
}

func (s *Store) MemberExists(ctx context.Context, tripID, userID string) (bool, error) {
	var exists bool
	err := s.Pool.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM trip_members WHERE trip_id=$1 AND user_id=$2)`, tripID, userID).Scan(&exists)
	return exists, err
}

func (s *Store) TripTitle(ctx context.Context, tripID string) (string, error) {
	var title string
	err := s.Pool.QueryRow(ctx, `SELECT title FROM trips WHERE id=$1`, tripID).Scan(&title)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", apperr.ErrNotFound
	}
	return title, err
}
