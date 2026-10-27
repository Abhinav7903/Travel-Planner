-- Wayfarer initial schema
-- Forward-only. Review before applying to a Neon production branch.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- Identity
-- ---------------------------------------------------------------------------

CREATE TABLE users (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email        citext NOT NULL UNIQUE CHECK (length(email) BETWEEN 3 AND 320 AND position('@' IN email) > 1),
  display_name text NOT NULL DEFAULT '',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE otp_challenges (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email       citext NOT NULL,
  code_hmac   bytea NOT NULL,
  expires_at  timestamptz NOT NULL,
  attempts    integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
  consumed_at timestamptz,
  request_ip  inet,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX otp_challenges_email_created_idx ON otp_challenges (email, created_at DESC);
CREATE INDEX otp_challenges_ip_created_idx ON otp_challenges (request_ip, created_at DESC);

CREATE TABLE sessions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash   bytea NOT NULL UNIQUE,
  expires_at   timestamptz NOT NULL,
  revoked_at   timestamptz,
  last_used_at timestamptz,
  ip           inet,
  user_agent   text NOT NULL DEFAULT '',
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user_idx ON sessions (user_id);
CREATE INDEX sessions_expiry_idx ON sessions (expires_at) WHERE revoked_at IS NULL;

-- ---------------------------------------------------------------------------
-- Trips and access
-- ---------------------------------------------------------------------------

CREATE TABLE trips (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  title           text NOT NULL CHECK (length(title) BETWEEN 1 AND 160),
  destination     text NOT NULL CHECK (length(destination) BETWEEN 1 AND 200),
  start_date      date NOT NULL,
  end_date        date NOT NULL,
  timezone        text NOT NULL,
  currency        char(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  description     text NOT NULL DEFAULT '' CHECK (length(description) <= 4000),
  cover_image_url text NOT NULL DEFAULT '' CHECK (length(cover_image_url) <= 2048),
  status          text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  version         integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date)
);
CREATE INDEX trips_owner_idx ON trips (owner_id, status);
CREATE INDEX trips_dates_idx ON trips (start_date, end_date);

CREATE TABLE trip_members (
  trip_id   uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  user_id   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role      text NOT NULL CHECK (role IN ('owner', 'editor', 'viewer')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (trip_id, user_id)
);
CREATE INDEX trip_members_user_idx ON trip_members (user_id);
CREATE UNIQUE INDEX trip_members_single_owner_idx ON trip_members (trip_id) WHERE role = 'owner';

CREATE TABLE trip_invitations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id      uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  email        citext NOT NULL,
  role         text NOT NULL CHECK (role IN ('editor', 'viewer')),
  token_hash   bytea NOT NULL UNIQUE,
  invited_by   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at   timestamptz NOT NULL,
  accepted_at  timestamptz,
  revoked_at   timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_sent_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at > created_at)
);
CREATE UNIQUE INDEX trip_invitations_live_email_idx
  ON trip_invitations (trip_id, email)
  WHERE accepted_at IS NULL AND revoked_at IS NULL;
CREATE INDEX trip_invitations_trip_idx ON trip_invitations (trip_id, created_at DESC);

CREATE TABLE trip_groups (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id    uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  name       text NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
  color      text NOT NULL DEFAULT '#2f6f5e' CHECK (color ~ '^#[0-9a-fA-F]{6}$'),
  version    integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX trip_groups_name_idx ON trip_groups (trip_id, lower(name));

CREATE TABLE trip_group_members (
  group_id uuid NOT NULL REFERENCES trip_groups(id) ON DELETE CASCADE,
  trip_id  uuid NOT NULL,
  user_id  uuid NOT NULL,
  PRIMARY KEY (group_id, user_id),
  FOREIGN KEY (trip_id, user_id) REFERENCES trip_members (trip_id, user_id) ON DELETE CASCADE
);
CREATE INDEX trip_group_members_user_idx ON trip_group_members (trip_id, user_id);

-- ---------------------------------------------------------------------------
-- Itinerary graph
-- ---------------------------------------------------------------------------

CREATE TABLE itinerary_days (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id    uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  date       date NOT NULL,
  title      text NOT NULL DEFAULT '' CHECK (length(title) <= 160),
  position   integer NOT NULL DEFAULT 0,
  version    integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (trip_id, date),
  UNIQUE (id, trip_id)
);
CREATE INDEX itinerary_days_trip_idx ON itinerary_days (trip_id, position, date);

CREATE TABLE itinerary_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id       uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  day_id        uuid NOT NULL REFERENCES itinerary_days(id) ON DELETE CASCADE,
  group_id      uuid REFERENCES trip_groups(id) ON DELETE SET NULL,
  title         text NOT NULL CHECK (length(title) BETWEEN 1 AND 160),
  kind          text NOT NULL DEFAULT 'activity'
                CHECK (kind IN ('place', 'activity', 'meal', 'transport', 'stay', 'note')),
  location_name text NOT NULL DEFAULT '' CHECK (length(location_name) <= 200),
  address       text NOT NULL DEFAULT '' CHECK (length(address) <= 500),
  latitude      double precision CHECK (latitude BETWEEN -90 AND 90),
  longitude     double precision CHECK (longitude BETWEEN -180 AND 180),
  start_time    time,
  end_time      time,
  notes         text NOT NULL DEFAULT '' CHECK (length(notes) <= 4000),
  cost_minor    bigint CHECK (cost_minor >= 0),
  currency      char(3) CHECK (currency ~ '^[A-Z]{3}$'),
  link          text NOT NULL DEFAULT '' CHECK (length(link) <= 2048),
  pos_x         double precision NOT NULL DEFAULT 0,
  pos_y         double precision NOT NULL DEFAULT 0,
  sort_order    integer NOT NULL DEFAULT 0,
  version       integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_by    uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CHECK ((latitude IS NULL) = (longitude IS NULL)),
  CHECK (end_time IS NULL OR start_time IS NULL OR end_time >= start_time),
  UNIQUE (id, trip_id)
);
CREATE INDEX itinerary_items_day_idx ON itinerary_items (day_id, sort_order, start_time);
CREATE INDEX itinerary_items_trip_idx ON itinerary_items (trip_id);
CREATE INDEX itinerary_items_group_idx ON itinerary_items (group_id) WHERE group_id IS NOT NULL;

CREATE TABLE itinerary_edges (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id          uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  day_id           uuid NOT NULL REFERENCES itinerary_days(id) ON DELETE CASCADE,
  group_id         uuid REFERENCES trip_groups(id) ON DELETE SET NULL,
  from_item_id     uuid NOT NULL,
  to_item_id       uuid NOT NULL,
  mode             text NOT NULL DEFAULT 'walk'
                   CHECK (mode IN ('walk', 'transit', 'car', 'flight', 'ferry', 'other')),
  duration_minutes integer CHECK (duration_minutes BETWEEN 0 AND 10080),
  distance_km      numeric(8,2) CHECK (distance_km >= 0),
  depart_time      time,
  arrive_time      time,
  notes            text NOT NULL DEFAULT '' CHECK (length(notes) <= 2000),
  version          integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CHECK (from_item_id <> to_item_id),
  FOREIGN KEY (from_item_id, trip_id) REFERENCES itinerary_items (id, trip_id) ON DELETE CASCADE,
  FOREIGN KEY (to_item_id, trip_id) REFERENCES itinerary_items (id, trip_id) ON DELETE CASCADE,
  UNIQUE NULLS NOT DISTINCT (day_id, from_item_id, to_item_id, group_id)
);
CREATE INDEX itinerary_edges_day_idx ON itinerary_edges (day_id);
CREATE INDEX itinerary_edges_from_idx ON itinerary_edges (from_item_id);
CREATE INDEX itinerary_edges_to_idx ON itinerary_edges (to_item_id);

-- ---------------------------------------------------------------------------
-- Notes
-- ---------------------------------------------------------------------------

CREATE TABLE trip_notes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id       uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  title         text NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  body_markdown text NOT NULL DEFAULT '' CHECK (length(body_markdown) <= 100000),
  pinned        boolean NOT NULL DEFAULT false,
  created_by    uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  updated_by    uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  version       integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX trip_notes_trip_idx ON trip_notes (trip_id, pinned DESC, updated_at DESC);

-- ---------------------------------------------------------------------------
-- Expenses and settlements
-- ---------------------------------------------------------------------------

CREATE TABLE expenses (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id      uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  group_id     uuid REFERENCES trip_groups(id) ON DELETE SET NULL,
  description  text NOT NULL CHECK (length(description) BETWEEN 1 AND 200),
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  currency     char(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  category     text NOT NULL DEFAULT 'other'
               CHECK (category IN ('food', 'transport', 'stay', 'activity', 'shopping', 'other')),
  expense_date date NOT NULL,
  payer_id     uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  note         text NOT NULL DEFAULT '' CHECK (length(note) <= 2000),
  version      integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_by   uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX expenses_trip_idx ON expenses (trip_id, expense_date DESC, created_at DESC);
CREATE INDEX expenses_currency_idx ON expenses (trip_id, currency);

CREATE TABLE expense_splits (
  expense_id   uuid NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  amount_minor bigint NOT NULL CHECK (amount_minor >= 0),
  PRIMARY KEY (expense_id, user_id)
);
CREATE INDEX expense_splits_user_idx ON expense_splits (user_id);

CREATE TABLE settlements (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id      uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  from_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  to_user_id   uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  currency     char(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  settled_on   date NOT NULL DEFAULT CURRENT_DATE,
  note         text NOT NULL DEFAULT '' CHECK (length(note) <= 1000),
  created_by   uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CHECK (from_user_id <> to_user_id)
);
CREATE INDEX settlements_trip_idx ON settlements (trip_id, currency, settled_on DESC);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

CREATE TRIGGER users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trips_updated_at BEFORE UPDATE ON trips FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trip_groups_updated_at BEFORE UPDATE ON trip_groups FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER itinerary_days_updated_at BEFORE UPDATE ON itinerary_days FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER itinerary_items_updated_at BEFORE UPDATE ON itinerary_items FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER itinerary_edges_updated_at BEFORE UPDATE ON itinerary_edges FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trip_notes_updated_at BEFORE UPDATE ON trip_notes FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER expenses_updated_at BEFORE UPDATE ON expenses FOR EACH ROW EXECUTE FUNCTION set_updated_at();
