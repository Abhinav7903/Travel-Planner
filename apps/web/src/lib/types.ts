export type Role = "owner" | "editor" | "viewer";

export type User = {
  id: string;
  email: string;
  display_name: string;
  created_at: string;
};

export type MapResolution = {
  latitude: number;
  longitude: number;
  link: string;
};

export type Trip = {
  id: string;
  owner_id: string;
  title: string;
  destination: string;
  start_date: string;
  end_date: string;
  timezone: string;
  currency: string;
  description: string;
  cover_image_url: string;
  status: "active" | "archived";
  version: number;
  role: Role;
  member_count: number;
  created_at: string;
  updated_at: string;
};

export type Member = {
  user_id: string;
  email: string;
  display_name: string;
  role: Role;
  joined_at: string;
};

export type Invitation = {
  id: string;
  trip_id: string;
  email: string;
  role: "editor" | "viewer";
  status: "pending" | "accepted" | "revoked" | "expired";
  expires_at: string;
  created_at: string;
  last_sent_at: string;
  invited_by_name: string;
  invite_url?: string;
  email_sent?: boolean;
  warning?: string;
};

export type InvitationPreview = {
  trip_id: string;
  trip_title: string;
  destination: string;
  start_date: string;
  end_date: string;
  inviter_name: string;
  masked_email: string;
  role: "editor" | "viewer";
  expires_at: string;
  status: string;
};

export type TripGroup = {
  id: string;
  trip_id: string;
  name: string;
  color: string;
  version: number;
  member_ids: string[];
  created_at: string;
  updated_at: string;
};

export type ItemKind = "place" | "activity" | "meal" | "transport" | "stay" | "note";

export type ItineraryItem = {
  id: string;
  trip_id: string;
  day_id: string;
  group_id: string;
  title: string;
  kind: ItemKind;
  location_name: string;
  address: string;
  latitude: number;
  longitude: number;
  has_coordinates: boolean;
  start_time: string;
  end_time: string;
  notes: string;
  cost_minor: number;
  currency: string;
  link: string;
  pos_x: number;
  pos_y: number;
  sort_order: number;
  version: number;
  created_at: string;
  updated_at: string;
};

export type EdgeMode =
  | "walk"
  | "transit"
  | "train"
  | "bus"
  | "bike"
  | "car"
  | "flight"
  | "ferry"
  | "other";

export type ItineraryEdge = {
  id: string;
  trip_id: string;
  day_id: string;
  group_id: string;
  from_item_id: string;
  to_item_id: string;
  mode: EdgeMode;
  duration_minutes: number;
  distance_km: number;
  depart_time: string;
  arrive_time: string;
  notes: string;
  version: number;
  created_at: string;
  updated_at: string;
};

export type ItineraryDay = {
  id: string;
  trip_id: string;
  date: string;
  title: string;
  position: number;
  version: number;
  items: ItineraryItem[];
  edges: ItineraryEdge[];
  created_at: string;
  updated_at: string;
};

export type Note = {
  id: string;
  trip_id: string;
  title: string;
  body_markdown: string;
  pinned: boolean;
  author_name: string;
  updated_by_name: string;
  version: number;
  created_at: string;
  updated_at: string;
};

export type ExpenseSplit = {
  user_id: string;
  display_name: string;
  amount_minor: number;
};

export type Expense = {
  id: string;
  trip_id: string;
  group_id: string;
  description: string;
  amount_minor: number;
  currency: string;
  category: "food" | "transport" | "stay" | "activity" | "shopping" | "other";
  expense_date: string;
  payer_id: string;
  payer_name: string;
  note: string;
  version: number;
  splits: ExpenseSplit[];
  created_at: string;
  updated_at: string;
};

export type Balance = { user_id: string; net_minor: number };
export type Transfer = { from_user_id: string; to_user_id: string; amount_minor: number };

export type Ledger = {
  currency: string;
  balances: Balance[];
  suggestions: Transfer[];
  total_minor: number;
};

export type Settlement = {
  id: string;
  trip_id: string;
  from_user_id: string;
  from_name: string;
  to_user_id: string;
  to_name: string;
  amount_minor: number;
  currency: string;
  settled_on: string;
  note: string;
  created_at: string;
};

export type ExpenseLedger = {
  currencies: Ledger[];
};

export type TripBundle = {
  trip: Trip;
  members: Member[];
  days: ItineraryDay[];
  groups: TripGroup[];
};

export type ApiEnvelope<T> = { data: T };
export type ApiFailure = {
  error?: { code?: string; message?: string; fields?: Record<string, string>; request_id?: string };
};
