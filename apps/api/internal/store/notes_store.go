package store

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"

	"wayfarer/api/internal/apperr"
)

const noteColumns = `
	n.id, n.trip_id, n.title, n.body_markdown, n.pinned,
	author.display_name, editor.display_name, n.version, n.created_at, n.updated_at`

func scanNote(row scanner) (Note, error) {
	var n Note
	err := row.Scan(&n.ID, &n.TripID, &n.Title, &n.BodyMarkdown, &n.Pinned,
		&n.AuthorName, &n.UpdatedByName, &n.Version, &n.CreatedAt, &n.UpdatedAt)
	return n, err
}

func (s *Store) ListNotes(ctx context.Context, tripID string) ([]Note, error) {
	rows, err := s.Pool.Query(ctx,
		`SELECT `+noteColumns+`
		 FROM trip_notes n
		 JOIN users author ON author.id = n.created_by
		 JOIN users editor ON editor.id = n.updated_by
		 WHERE n.trip_id=$1 ORDER BY n.pinned DESC, n.updated_at DESC LIMIT 100`, tripID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	notes := []Note{}
	for rows.Next() {
		n, err := scanNote(rows)
		if err != nil {
			return nil, err
		}
		notes = append(notes, n)
	}
	return notes, rows.Err()
}

func (s *Store) GetNote(ctx context.Context, tripID, noteID string) (Note, error) {
	n, err := scanNote(s.Pool.QueryRow(ctx,
		`SELECT `+noteColumns+`
		 FROM trip_notes n
		 JOIN users author ON author.id = n.created_by
		 JOIN users editor ON editor.id = n.updated_by
		 WHERE n.trip_id=$1 AND n.id=$2`, tripID, noteID))
	if errors.Is(err, pgx.ErrNoRows) {
		return n, apperr.ErrNotFound
	}
	return n, err
}

func (s *Store) CreateNote(ctx context.Context, tripID, userID string, in NoteInput) (Note, error) {
	var id string
	err := s.Pool.QueryRow(ctx,
		`INSERT INTO trip_notes (trip_id, title, body_markdown, pinned, created_by, updated_by)
		 VALUES ($1,$2,$3,$4,$5,$5) RETURNING id`,
		tripID, in.Title, in.BodyMarkdown, in.Pinned, userID).Scan(&id)
	if err != nil {
		return Note{}, mapWriteError(err)
	}
	return s.GetNote(ctx, tripID, id)
}

func (s *Store) UpdateNote(ctx context.Context, tripID, noteID, userID string, in NoteInput) (Note, error) {
	var id string
	err := s.Pool.QueryRow(ctx,
		`UPDATE trip_notes SET title=$3, body_markdown=$4, pinned=$5, updated_by=$6, version=version+1
		 WHERE id=$1 AND trip_id=$2 AND version=$7 RETURNING id`,
		noteID, tripID, in.Title, in.BodyMarkdown, in.Pinned, userID, in.Version).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return Note{}, apperr.ErrConflict
	}
	if err != nil {
		return Note{}, mapWriteError(err)
	}
	return s.GetNote(ctx, tripID, noteID)
}

func (s *Store) DeleteNote(ctx context.Context, tripID, noteID string, version int) error {
	var tag interface{ RowsAffected() int64 }
	var err error
	if version > 0 {
		tag, err = s.Pool.Exec(ctx, `DELETE FROM trip_notes WHERE id=$1 AND trip_id=$2 AND version=$3`, noteID, tripID, version)
	} else {
		tag, err = s.Pool.Exec(ctx, `DELETE FROM trip_notes WHERE id=$1 AND trip_id=$2`, noteID, tripID)
	}
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return apperr.ErrConflict
	}
	return nil
}
