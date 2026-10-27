package store

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"

	"wayfarer/api/internal/apperr"
)

const groupColumns = `
	g.id, g.trip_id, g.name, g.color, g.version,
	COALESCE(array_agg(gm.user_id::text) FILTER (WHERE gm.user_id IS NOT NULL), ARRAY[]::text[]) AS member_ids,
	g.created_at, g.updated_at`

func scanGroup(row scanner) (Group, error) {
	var g Group
	err := row.Scan(&g.ID, &g.TripID, &g.Name, &g.Color, &g.Version, &g.MemberIDs, &g.CreatedAt, &g.UpdatedAt)
	return g, err
}

func (s *Store) ListGroups(ctx context.Context, tripID string) ([]Group, error) {
	rows, err := s.Pool.Query(ctx,
		`SELECT `+groupColumns+`
		 FROM trip_groups g LEFT JOIN trip_group_members gm ON gm.group_id = g.id
		 WHERE g.trip_id=$1
		 GROUP BY g.id ORDER BY lower(g.name)`, tripID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	groups := []Group{}
	for rows.Next() {
		g, err := scanGroup(rows)
		if err != nil {
			return nil, err
		}
		groups = append(groups, g)
	}
	return groups, rows.Err()
}

func (s *Store) GetGroup(ctx context.Context, tripID, groupID string) (Group, error) {
	g, err := scanGroup(s.Pool.QueryRow(ctx,
		`SELECT `+groupColumns+`
		 FROM trip_groups g LEFT JOIN trip_group_members gm ON gm.group_id = g.id
		 WHERE g.trip_id=$1 AND g.id=$2
		 GROUP BY g.id`, tripID, groupID))
	if errors.Is(err, pgx.ErrNoRows) {
		return g, apperr.ErrNotFound
	}
	return g, err
}

func (s *Store) CreateGroup(ctx context.Context, tripID string, in GroupInput) (Group, error) {
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return Group{}, err
	}
	defer rollback(ctx, tx)
	var id string
	err = tx.QueryRow(ctx,
		`INSERT INTO trip_groups (trip_id, name, color) VALUES ($1,$2,$3) RETURNING id`,
		tripID, in.Name, in.Color).Scan(&id)
	if err != nil {
		if isUnique(err) {
			return Group{}, apperr.New(409, "group_exists", "A group with that name already exists.")
		}
		return Group{}, mapWriteError(err)
	}
	for _, memberID := range uniqueStrings(in.MemberIDs) {
		if _, err := tx.Exec(ctx,
			`INSERT INTO trip_group_members (group_id, trip_id, user_id) VALUES ($1,$2,$3)`,
			id, tripID, memberID); err != nil {
			return Group{}, mapWriteError(err)
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return Group{}, err
	}
	return s.GetGroup(ctx, tripID, id)
}

func (s *Store) UpdateGroup(ctx context.Context, tripID, groupID string, in GroupInput) (Group, error) {
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return Group{}, err
	}
	defer rollback(ctx, tx)
	var id string
	err = tx.QueryRow(ctx,
		`UPDATE trip_groups SET name=$3, color=$4, version=version+1
		 WHERE id=$1 AND trip_id=$2 AND version=$5 RETURNING id`,
		groupID, tripID, in.Name, in.Color, in.Version).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return Group{}, apperr.ErrConflict
	}
	if err != nil {
		if isUnique(err) {
			return Group{}, apperr.New(409, "group_exists", "A group with that name already exists.")
		}
		return Group{}, mapWriteError(err)
	}
	if _, err := tx.Exec(ctx, `DELETE FROM trip_group_members WHERE group_id=$1`, groupID); err != nil {
		return Group{}, err
	}
	for _, memberID := range uniqueStrings(in.MemberIDs) {
		if _, err := tx.Exec(ctx,
			`INSERT INTO trip_group_members (group_id, trip_id, user_id) VALUES ($1,$2,$3)`,
			groupID, tripID, memberID); err != nil {
			return Group{}, mapWriteError(err)
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return Group{}, err
	}
	return s.GetGroup(ctx, tripID, groupID)
}

func (s *Store) DeleteGroup(ctx context.Context, tripID, groupID string) error {
	tag, err := s.Pool.Exec(ctx, `DELETE FROM trip_groups WHERE id=$1 AND trip_id=$2`, groupID, tripID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return apperr.ErrNotFound
	}
	return nil
}

func (s *Store) GroupBelongsToTrip(ctx context.Context, tripID, groupID string) (bool, error) {
	if groupID == "" {
		return true, nil
	}
	var exists bool
	err := s.Pool.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM trip_groups WHERE id=$1 AND trip_id=$2)`, groupID, tripID).Scan(&exists)
	return exists, err
}

func uniqueStrings(values []string) []string {
	seen := map[string]bool{}
	out := make([]string, 0, len(values))
	for _, v := range values {
		if v == "" || seen[v] {
			continue
		}
		seen[v] = true
		out = append(out, v)
	}
	return out
}
