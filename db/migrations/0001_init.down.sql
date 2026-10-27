-- Development-only rollback for 0001_init. Never run against production.

DROP TABLE IF EXISTS settlements;
DROP TABLE IF EXISTS expense_splits;
DROP TABLE IF EXISTS expenses;
DROP TABLE IF EXISTS trip_notes;
DROP TABLE IF EXISTS itinerary_edges;
DROP TABLE IF EXISTS itinerary_items;
DROP TABLE IF EXISTS itinerary_days;
DROP TABLE IF EXISTS trip_group_members;
DROP TABLE IF EXISTS trip_groups;
DROP TABLE IF EXISTS trip_invitations;
DROP TABLE IF EXISTS trip_members;
DROP TABLE IF EXISTS trips;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS otp_challenges;
DROP TABLE IF EXISTS users;
DROP FUNCTION IF EXISTS set_updated_at();
