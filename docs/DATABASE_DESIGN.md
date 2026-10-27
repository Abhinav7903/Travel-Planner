# Wayfarer — Database Design

All schema changes live in `db/migrations`, are forward-only with a documented down path, and are applied manually. The application never creates tables at startup.

## Conventions

- UUID primary keys (`gen_random_uuid()` from `pgcrypto`).
- `timestamptz` for instants; `date` + trip-local `time` for scheduled itinerary items.
- IANA timezone string on `trips`; rendering converts local schedule to an instant only when needed.
- Money: `BIGINT` minor units, `CHAR(3)` ISO currency; no floating point.
- Optimistic concurrency: `version INTEGER NOT NULL DEFAULT 1` on notes, items, edges, days, expenses and trips. Updates use `WHERE version = $n` and return `409` on mismatch.
- Coordinates: `DOUBLE PRECISION` with `CHECK` bounds (-90..90, -180..180).
- `created_at`/`updated_at` defaults and a trigger for `updated_at` where useful.

## Tables

### Identity
- `users(id, email citext UNIQUE, display_name, created_at, updated_at)` — email normalized before insert.
- `otp_challenges(id, email citext, code_hmac bytea, expires_at, attempts, consumed_at, request_ip inet, created_at)` — only keyed digests. Index on `(email, created_at DESC)`.
- `sessions(id, user_id, token_hash bytea UNIQUE, expires_at, revoked_at, last_used_at, ip inet, user_agent, created_at)` — only SHA-256 token hashes.

### Trips and access
- `trips(id, owner_id, title, destination, start_date, end_date, timezone, currency, description, cover_image_url, status, version, created_at, updated_at)`
  - `CHECK (end_date >= start_date)`, `status IN ('active','archived')`.
- `trip_members(trip_id, user_id, role, joined_at, PK(trip_id,user_id))`
  - `role IN ('owner','editor','viewer')`; partial unique index guarantees one owner per trip.
- `trip_invitations(id, trip_id, email, role, token_hash bytea UNIQUE, invited_by, expires_at, accepted_at, revoked_at, created_at, last_sent_at)`
  - one live invitation per `(trip_id, lower(email))` via partial unique index.
- `trip_groups(id, trip_id, name, color, version, created_at, updated_at)`
  - unique `(trip_id, lower(name))`.
- `trip_group_members(group_id, user_id, trip_id, PK(group_id,user_id))`
  - composite FK to `trip_members(trip_id,user_id)` ensures group members belong to the trip.

### Itinerary
- `itinerary_days(id, trip_id, date, title, position, version, created_at, updated_at)`
  - unique `(trip_id,date)`; stable sort by `position,date`.
- `itinerary_items(id, trip_id, day_id, group_id nullable, title, kind, location_name, address, latitude, longitude, start_time, end_time, notes, cost_minor, currency, link, pos_x, pos_y, sort_order, version, created_by, created_at, updated_at)`
  - FK `day_id -> itinerary_days`; application checks day belongs to trip.
  - `CHECK (end_time IS NULL OR start_time IS NULL OR end_time >= start_time)`.
  - `kind` allowlist; `cost_minor >= 0`.
- `itinerary_edges(id, trip_id, day_id, group_id nullable, from_item_id, to_item_id, mode, duration_minutes, distance_km, depart_time, arrive_time, notes, version, created_at, updated_at)`
  - `CHECK (from_item_id <> to_item_id)`, distinct pair per day/group, FKs to items.
  - Duration is user-entered; no claim of live routing.

### Notes and money
- `trip_notes(id, trip_id, title, body_markdown, pinned, created_by, updated_by, version, created_at, updated_at)`.
- `expenses(id, trip_id, group_id, description, amount_minor, currency, category, expense_date, payer_id, note, version, created_by, created_at, updated_at)`
  - `amount_minor > 0`.
- `expense_splits(expense_id, user_id, amount_minor, PK(expense_id,user_id))`
  - sum is verified in the same transaction as the expense.
- `settlements(id, trip_id, from_user_id, to_user_id, amount_minor, currency, settled_on, note, created_by, created_at)`
  - `CHECK (from_user_id <> to_user_id AND amount_minor > 0)`.

## Transaction rules

1. OTP request: cooldown/rate checks, invalidate older challenges and insert the new digest in one transaction; send mail after commit.
2. OTP verify: increment attempts atomically, consume atomically, upsert user + create session in one transaction.
3. Invitation accept: lock the invite row `FOR UPDATE`, verify email/expiry/revocation, upsert membership, mark accepted. Races return the same membership.
4. Expense create/update: expense + all split rows + sum check in one transaction.
5. Item/edge mutations with `version` checks; delete edges that reference a deleted item via explicit transaction.
6. Trip archive is an enum update; data remains for history.

## Migration and rollback

- `0001_init.sql` creates extensions, enums/constraints, tables, indexes and an `updated_at` trigger.
- `0001_init.down.sql` drops in reverse dependency order for development only.
- Tests use a disposable local database (`wayfarer_test`); never run destructive SQL against Neon production.
