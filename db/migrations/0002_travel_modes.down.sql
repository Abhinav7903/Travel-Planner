ALTER TABLE itinerary_edges DROP CONSTRAINT IF EXISTS itinerary_edges_mode_check;
ALTER TABLE itinerary_edges ADD CONSTRAINT itinerary_edges_mode_check
  CHECK (mode IN ('walk', 'transit', 'car', 'flight', 'ferry', 'other'));
