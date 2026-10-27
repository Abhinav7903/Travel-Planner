package store

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"

	"wayfarer/api/internal/apperr"
)

const itemColumns = `
	i.id, i.trip_id, i.day_id, COALESCE(i.group_id::text, ''),
	i.title, i.kind, i.location_name, i.address,
	COALESCE(i.latitude, 0), COALESCE(i.longitude, 0), (i.latitude IS NOT NULL),
	COALESCE(to_char(i.start_time, 'HH24:MI'), ''),
	COALESCE(to_char(i.end_time, 'HH24:MI'), ''),
	i.notes, COALESCE(i.cost_minor, 0), COALESCE(rtrim(i.currency::text), ''), i.link,
	i.pos_x, i.pos_y, i.sort_order, i.version, i.created_at, i.updated_at`

const edgeColumns = `
	e.id, e.trip_id, e.day_id, COALESCE(e.group_id::text, ''),
	e.from_item_id, e.to_item_id, e.mode,
	COALESCE(e.duration_minutes, 0), COALESCE(e.distance_km::float8, 0),
	COALESCE(to_char(e.depart_time, 'HH24:MI'), ''),
	COALESCE(to_char(e.arrive_time, 'HH24:MI'), ''),
	e.notes, e.version, e.created_at, e.updated_at`

func scanItem(row scanner) (Item, error) {
	var it Item
	err := row.Scan(&it.ID, &it.TripID, &it.DayID, &it.GroupID, &it.Title, &it.Kind,
		&it.LocationName, &it.Address, &it.Latitude, &it.Longitude, &it.HasCoordinates,
		&it.StartTime, &it.EndTime, &it.Notes, &it.CostMinor, &it.Currency, &it.Link,
		&it.PosX, &it.PosY, &it.SortOrder, &it.Version, &it.CreatedAt, &it.UpdatedAt)
	return it, err
}

func scanEdge(row scanner) (Edge, error) {
	var e Edge
	err := row.Scan(&e.ID, &e.TripID, &e.DayID, &e.GroupID, &e.FromItemID, &e.ToItemID,
		&e.Mode, &e.DurationMinutes, &e.DistanceKM, &e.DepartTime, &e.ArriveTime,
		&e.Notes, &e.Version, &e.CreatedAt, &e.UpdatedAt)
	return e, err
}

func (s *Store) GetItinerary(ctx context.Context, tripID string) ([]Day, error) {
	dayRows, err := s.Pool.Query(ctx,
		`SELECT id, trip_id, to_char(date, 'YYYY-MM-DD'), title, position, version, created_at, updated_at
		 FROM itinerary_days WHERE trip_id=$1 ORDER BY position, date`, tripID)
	if err != nil {
		return nil, err
	}
	days := []Day{}
	dayIndex := map[string]int{}
	for dayRows.Next() {
		var d Day
		if err := dayRows.Scan(&d.ID, &d.TripID, &d.Date, &d.Title, &d.Position, &d.Version, &d.CreatedAt, &d.UpdatedAt); err != nil {
			dayRows.Close()
			return nil, err
		}
		d.Items = []Item{}
		d.Edges = []Edge{}
		dayIndex[d.ID] = len(days)
		days = append(days, d)
	}
	dayRows.Close()
	if err := dayRows.Err(); err != nil {
		return nil, err
	}

	itemRows, err := s.Pool.Query(ctx,
		`SELECT `+itemColumns+`
		 FROM itinerary_items i WHERE i.trip_id=$1
		 ORDER BY i.sort_order, i.start_time NULLS LAST, i.created_at`, tripID)
	if err != nil {
		return nil, err
	}
	for itemRows.Next() {
		it, err := scanItem(itemRows)
		if err != nil {
			itemRows.Close()
			return nil, err
		}
		if idx, ok := dayIndex[it.DayID]; ok {
			days[idx].Items = append(days[idx].Items, it)
		}
	}
	itemRows.Close()
	if err := itemRows.Err(); err != nil {
		return nil, err
	}

	edgeRows, err := s.Pool.Query(ctx,
		`SELECT `+edgeColumns+` FROM itinerary_edges e WHERE e.trip_id=$1 ORDER BY e.created_at`, tripID)
	if err != nil {
		return nil, err
	}
	for edgeRows.Next() {
		e, err := scanEdge(edgeRows)
		if err != nil {
			edgeRows.Close()
			return nil, err
		}
		if idx, ok := dayIndex[e.DayID]; ok {
			days[idx].Edges = append(days[idx].Edges, e)
		}
	}
	edgeRows.Close()
	return days, edgeRows.Err()
}

func (s *Store) GetItem(ctx context.Context, tripID, itemID string) (Item, error) {
	it, err := scanItem(s.Pool.QueryRow(ctx,
		`SELECT `+itemColumns+` FROM itinerary_items i WHERE i.trip_id=$1 AND i.id=$2`, tripID, itemID))
	if errors.Is(err, pgx.ErrNoRows) {
		return it, apperr.ErrNotFound
	}
	return it, err
}

func (s *Store) validateDayAndGroup(ctx context.Context, tripID, dayID, groupID string) error {
	var dayOK bool
	err := s.Pool.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM itinerary_days WHERE id=$1 AND trip_id=$2)`, dayID, tripID).Scan(&dayOK)
	if err != nil {
		return err
	}
	if !dayOK {
		return apperr.New(422, "invalid_day", "That day does not belong to this trip.")
	}
	if groupID != "" {
		ok, err := s.GroupBelongsToTrip(ctx, tripID, groupID)
		if err != nil {
			return err
		}
		if !ok {
			return apperr.New(422, "invalid_group", "That group does not belong to this trip.")
		}
	}
	return nil
}

func coord(v float64, has bool) any {
	if !has {
		return nil
	}
	return v
}

func (s *Store) CreateItem(ctx context.Context, tripID, userID string, in ItemInput) (Item, error) {
	if err := s.validateDayAndGroup(ctx, tripID, in.DayID, in.GroupID); err != nil {
		return Item{}, err
	}
	var id string
	err := s.Pool.QueryRow(ctx,
		`INSERT INTO itinerary_items (
		   trip_id, day_id, group_id, title, kind, location_name, address, latitude, longitude,
		   start_time, end_time, notes, cost_minor, currency, link, pos_x, pos_y, sort_order, created_by)
		 VALUES ($1,$2,NULLIF($3,'')::uuid,$4,$5,$6,$7,$8,$9,NULLIF($10,'')::time,NULLIF($11,'')::time,
		   $12,NULLIF($13,0),NULLIF($14,''),$15,$16,$17,
		   CASE WHEN $18 > 0 THEN $18 ELSE (SELECT COALESCE(MAX(sort_order),0)+1 FROM itinerary_items WHERE day_id=$2) END,
		   $19)
		 RETURNING id`,
		tripID, in.DayID, in.GroupID, in.Title, in.Kind, in.LocationName, in.Address,
		coord(in.Latitude, in.HasCoordinates), coord(in.Longitude, in.HasCoordinates),
		in.StartTime, in.EndTime, in.Notes, in.CostMinor, in.Currency, in.Link,
		in.PosX, in.PosY, in.SortOrder, userID).Scan(&id)
	if err != nil {
		return Item{}, mapWriteError(err)
	}
	return s.GetItem(ctx, tripID, id)
}

func (s *Store) UpdateItem(ctx context.Context, tripID, itemID string, in ItemInput) (Item, error) {
	if err := s.validateDayAndGroup(ctx, tripID, in.DayID, in.GroupID); err != nil {
		return Item{}, err
	}
	var id string
	err := s.Pool.QueryRow(ctx,
		`UPDATE itinerary_items SET
		   day_id=$3, group_id=NULLIF($4,'')::uuid, title=$5, kind=$6, location_name=$7, address=$8,
		   latitude=$9, longitude=$10, start_time=NULLIF($11,'')::time, end_time=NULLIF($12,'')::time,
		   notes=$13, cost_minor=NULLIF($14,0), currency=NULLIF($15,''), link=$16,
		   pos_x=$17, pos_y=$18, sort_order=$19, version=version+1
		 WHERE id=$1 AND trip_id=$2 AND version=$20 RETURNING id`,
		itemID, tripID, in.DayID, in.GroupID, in.Title, in.Kind, in.LocationName, in.Address,
		coord(in.Latitude, in.HasCoordinates), coord(in.Longitude, in.HasCoordinates),
		in.StartTime, in.EndTime, in.Notes, in.CostMinor, in.Currency, in.Link,
		in.PosX, in.PosY, in.SortOrder, in.Version).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return Item{}, apperr.ErrConflict
	}
	if err != nil {
		return Item{}, mapWriteError(err)
	}
	return s.GetItem(ctx, tripID, itemID)
}

func (s *Store) DeleteItem(ctx context.Context, tripID, itemID string, version int) error {
	var tag interface{ RowsAffected() int64 }
	var err error
	if version > 0 {
		tag, err = s.Pool.Exec(ctx, `DELETE FROM itinerary_items WHERE id=$1 AND trip_id=$2 AND version=$3`, itemID, tripID, version)
	} else {
		tag, err = s.Pool.Exec(ctx, `DELETE FROM itinerary_items WHERE id=$1 AND trip_id=$2`, itemID, tripID)
	}
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return apperr.ErrConflict
	}
	return nil
}

func (s *Store) GetEdge(ctx context.Context, tripID, edgeID string) (Edge, error) {
	e, err := scanEdge(s.Pool.QueryRow(ctx,
		`SELECT `+edgeColumns+` FROM itinerary_edges e WHERE e.trip_id=$1 AND e.id=$2`, tripID, edgeID))
	if errors.Is(err, pgx.ErrNoRows) {
		return e, apperr.ErrNotFound
	}
	return e, err
}

func (s *Store) validateEdge(ctx context.Context, tripID, dayID string, in EdgeInput) error {
	if in.FromItemID == in.ToItemID {
		return apperr.New(422, "self_edge", "A travel leg needs two different stops.")
	}
	if err := s.validateDayAndGroup(ctx, tripID, dayID, in.GroupID); err != nil {
		return err
	}
	var count int
	err := s.Pool.QueryRow(ctx,
		`SELECT count(*) FROM itinerary_items WHERE trip_id=$1 AND day_id=$2 AND (id=$3 OR id=$4)`,
		tripID, dayID, in.FromItemID, in.ToItemID).Scan(&count)
	if err != nil {
		return err
	}
	if count != 2 {
		return apperr.New(422, "invalid_edge", "Both stops must belong to this trip day.")
	}
	return nil
}

func (s *Store) CreateEdge(ctx context.Context, tripID string, in EdgeInput) (Edge, error) {
	if err := s.validateEdge(ctx, tripID, in.DayID, in); err != nil {
		return Edge{}, err
	}
	var id string
	err := s.Pool.QueryRow(ctx,
		`INSERT INTO itinerary_edges (trip_id, day_id, group_id, from_item_id, to_item_id, mode,
		   duration_minutes, distance_km, depart_time, arrive_time, notes)
		 VALUES ($1,$2,NULLIF($3,'')::uuid,$4,$5,$6,NULLIF($7,0),NULLIF($8,0),NULLIF($9,'')::time,NULLIF($10,'')::time,$11)
		 RETURNING id`,
		tripID, in.DayID, in.GroupID, in.FromItemID, in.ToItemID, in.Mode,
		in.DurationMinutes, in.DistanceKM, in.DepartTime, in.ArriveTime, in.Notes).Scan(&id)
	if err != nil {
		if isUnique(err) {
			return Edge{}, apperr.New(409, "edge_exists", "A leg already connects those stops for this day and group.")
		}
		return Edge{}, mapWriteError(err)
	}
	return s.GetEdge(ctx, tripID, id)
}

func (s *Store) UpdateEdge(ctx context.Context, tripID, edgeID string, in EdgeInput) (Edge, error) {
	if err := s.validateEdge(ctx, tripID, in.DayID, in); err != nil {
		return Edge{}, err
	}
	var id string
	err := s.Pool.QueryRow(ctx,
		`UPDATE itinerary_edges SET
		   day_id=$3, group_id=NULLIF($4,'')::uuid, from_item_id=$5, to_item_id=$6, mode=$7,
		   duration_minutes=NULLIF($8,0), distance_km=NULLIF($9,0),
		   depart_time=NULLIF($10,'')::time, arrive_time=NULLIF($11,'')::time, notes=$12, version=version+1
		 WHERE id=$1 AND trip_id=$2 AND version=$13 RETURNING id`,
		edgeID, tripID, in.DayID, in.GroupID, in.FromItemID, in.ToItemID, in.Mode,
		in.DurationMinutes, in.DistanceKM, in.DepartTime, in.ArriveTime, in.Notes, in.Version).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return Edge{}, apperr.ErrConflict
	}
	if err != nil {
		if isUnique(err) {
			return Edge{}, apperr.New(409, "edge_exists", "A leg already connects those stops for this day and group.")
		}
		return Edge{}, mapWriteError(err)
	}
	return s.GetEdge(ctx, tripID, edgeID)
}

func (s *Store) DeleteEdge(ctx context.Context, tripID, edgeID string, version int) error {
	var tag interface{ RowsAffected() int64 }
	var err error
	if version > 0 {
		tag, err = s.Pool.Exec(ctx, `DELETE FROM itinerary_edges WHERE id=$1 AND trip_id=$2 AND version=$3`, edgeID, tripID, version)
	} else {
		tag, err = s.Pool.Exec(ctx, `DELETE FROM itinerary_edges WHERE id=$1 AND trip_id=$2`, edgeID, tripID)
	}
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return apperr.ErrConflict
	}
	return nil
}

func (s *Store) UpdateDay(ctx context.Context, tripID, dayID, title string, version int) error {
	tag, err := s.Pool.Exec(ctx,
		`UPDATE itinerary_days SET title=$3, version=version+1 WHERE id=$1 AND trip_id=$2 AND version=$4`,
		dayID, tripID, title, version)
	if err != nil {
		return mapWriteError(err)
	}
	if tag.RowsAffected() == 0 {
		return apperr.ErrConflict
	}
	return nil
}
