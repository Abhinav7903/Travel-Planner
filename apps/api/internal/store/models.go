package store

import (
	"time"

	"wayfarer/api/internal/money"
)

type User struct {
	ID          string    `json:"id"`
	Email       string    `json:"email"`
	DisplayName string    `json:"display_name"`
	CreatedAt   time.Time `json:"created_at"`
}

type Member struct {
	UserID      string    `json:"user_id"`
	Email       string    `json:"email"`
	DisplayName string    `json:"display_name"`
	Role        string    `json:"role"`
	JoinedAt    time.Time `json:"joined_at"`
}

type Trip struct {
	ID            string    `json:"id"`
	OwnerID       string    `json:"owner_id"`
	Title         string    `json:"title"`
	Destination   string    `json:"destination"`
	StartDate     string    `json:"start_date"`
	EndDate       string    `json:"end_date"`
	Timezone      string    `json:"timezone"`
	Currency      string    `json:"currency"`
	Description   string    `json:"description"`
	CoverImageURL string    `json:"cover_image_url"`
	Status        string    `json:"status"`
	Version       int       `json:"version"`
	Role          string    `json:"role"`
	MemberCount   int       `json:"member_count"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

type TripInput struct {
	Title         string `json:"title"`
	Destination   string `json:"destination"`
	StartDate     string `json:"start_date"`
	EndDate       string `json:"end_date"`
	Timezone      string `json:"timezone"`
	Currency      string `json:"currency"`
	Description   string `json:"description"`
	CoverImageURL string `json:"cover_image_url"`
	Status        string `json:"status,omitempty"`
	Version       int    `json:"version,omitempty"`
}

type Invitation struct {
	ID            string    `json:"id"`
	TripID        string    `json:"trip_id"`
	Email         string    `json:"email"`
	Role          string    `json:"role"`
	Status        string    `json:"status"`
	ExpiresAt     time.Time `json:"expires_at"`
	CreatedAt     time.Time `json:"created_at"`
	LastSentAt    time.Time `json:"last_sent_at"`
	InvitedByName string    `json:"invited_by_name"`
	InviteURL     string    `json:"invite_url,omitempty"`
	EmailSent     bool      `json:"email_sent,omitempty"`
	Warning       string    `json:"warning,omitempty"`
}

type InvitationPreview struct {
	TripID      string    `json:"trip_id"`
	TripTitle   string    `json:"trip_title"`
	Destination string    `json:"destination"`
	StartDate   string    `json:"start_date"`
	EndDate     string    `json:"end_date"`
	InviterName string    `json:"inviter_name"`
	MaskedEmail string    `json:"masked_email"`
	Role        string    `json:"role"`
	ExpiresAt   time.Time `json:"expires_at"`
	Status      string    `json:"status"`
}

type Group struct {
	ID        string    `json:"id"`
	TripID    string    `json:"trip_id"`
	Name      string    `json:"name"`
	Color     string    `json:"color"`
	Version   int       `json:"version"`
	MemberIDs []string  `json:"member_ids"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type GroupInput struct {
	Name      string   `json:"name"`
	Color     string   `json:"color"`
	MemberIDs []string `json:"member_ids"`
	Version   int      `json:"version,omitempty"`
}

type Item struct {
	ID             string    `json:"id"`
	TripID         string    `json:"trip_id"`
	DayID          string    `json:"day_id"`
	GroupID        string    `json:"group_id"`
	Title          string    `json:"title"`
	Kind           string    `json:"kind"`
	LocationName   string    `json:"location_name"`
	Address        string    `json:"address"`
	Latitude       float64   `json:"latitude"`
	Longitude      float64   `json:"longitude"`
	HasCoordinates bool      `json:"has_coordinates"`
	StartTime      string    `json:"start_time"`
	EndTime        string    `json:"end_time"`
	Notes          string    `json:"notes"`
	CostMinor      int64     `json:"cost_minor"`
	Currency       string    `json:"currency"`
	Link           string    `json:"link"`
	PosX           float64   `json:"pos_x"`
	PosY           float64   `json:"pos_y"`
	SortOrder      int       `json:"sort_order"`
	Version        int       `json:"version"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

type ItemInput struct {
	DayID          string  `json:"day_id"`
	GroupID        string  `json:"group_id"`
	Title          string  `json:"title"`
	Kind           string  `json:"kind"`
	LocationName   string  `json:"location_name"`
	Address        string  `json:"address"`
	Latitude       float64 `json:"latitude"`
	Longitude      float64 `json:"longitude"`
	HasCoordinates bool    `json:"has_coordinates"`
	StartTime      string  `json:"start_time"`
	EndTime        string  `json:"end_time"`
	Notes          string  `json:"notes"`
	CostMinor      int64   `json:"cost_minor"`
	Currency       string  `json:"currency"`
	Link           string  `json:"link"`
	PosX           float64 `json:"pos_x"`
	PosY           float64 `json:"pos_y"`
	SortOrder      int     `json:"sort_order"`
	Version        int     `json:"version,omitempty"`
}

type Edge struct {
	ID              string    `json:"id"`
	TripID          string    `json:"trip_id"`
	DayID           string    `json:"day_id"`
	GroupID         string    `json:"group_id"`
	FromItemID      string    `json:"from_item_id"`
	ToItemID        string    `json:"to_item_id"`
	Mode            string    `json:"mode"`
	DurationMinutes int       `json:"duration_minutes"`
	DistanceKM      float64   `json:"distance_km"`
	DepartTime      string    `json:"depart_time"`
	ArriveTime      string    `json:"arrive_time"`
	Notes           string    `json:"notes"`
	Version         int       `json:"version"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

type EdgeInput struct {
	DayID           string  `json:"day_id"`
	GroupID         string  `json:"group_id"`
	FromItemID      string  `json:"from_item_id"`
	ToItemID        string  `json:"to_item_id"`
	Mode            string  `json:"mode"`
	DurationMinutes int     `json:"duration_minutes"`
	DistanceKM      float64 `json:"distance_km"`
	DepartTime      string  `json:"depart_time"`
	ArriveTime      string  `json:"arrive_time"`
	Notes           string  `json:"notes"`
	Version         int     `json:"version,omitempty"`
}

type Day struct {
	ID        string    `json:"id"`
	TripID    string    `json:"trip_id"`
	Date      string    `json:"date"`
	Title     string    `json:"title"`
	Position  int       `json:"position"`
	Version   int       `json:"version"`
	Items     []Item    `json:"items"`
	Edges     []Edge    `json:"edges"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type Note struct {
	ID            string    `json:"id"`
	TripID        string    `json:"trip_id"`
	Title         string    `json:"title"`
	BodyMarkdown  string    `json:"body_markdown"`
	Pinned        bool      `json:"pinned"`
	AuthorName    string    `json:"author_name"`
	UpdatedByName string    `json:"updated_by_name"`
	Version       int       `json:"version"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

type NoteInput struct {
	Title        string `json:"title"`
	BodyMarkdown string `json:"body_markdown"`
	Pinned       bool   `json:"pinned"`
	Version      int    `json:"version,omitempty"`
}

type ExpenseSplit struct {
	UserID      string `json:"user_id"`
	DisplayName string `json:"display_name"`
	AmountMinor int64  `json:"amount_minor"`
}

type Expense struct {
	ID          string         `json:"id"`
	TripID      string         `json:"trip_id"`
	GroupID     string         `json:"group_id"`
	Description string         `json:"description"`
	AmountMinor int64          `json:"amount_minor"`
	Currency    string         `json:"currency"`
	Category    string         `json:"category"`
	ExpenseDate string         `json:"expense_date"`
	PayerID     string         `json:"payer_id"`
	PayerName   string         `json:"payer_name"`
	Note        string         `json:"note"`
	Version     int            `json:"version"`
	Splits      []ExpenseSplit `json:"splits"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
}

type ExpenseInput struct {
	GroupID      string         `json:"group_id"`
	Description  string         `json:"description"`
	AmountMinor  int64          `json:"amount_minor"`
	Currency     string         `json:"currency"`
	Category     string         `json:"category"`
	ExpenseDate  string         `json:"expense_date"`
	PayerID      string         `json:"payer_id"`
	Note         string         `json:"note"`
	SplitMode    string         `json:"split_mode"`
	Participants []string       `json:"participants"`
	CustomSplits []ExpenseSplit `json:"custom_splits"`
	Version      int            `json:"version,omitempty"`
}

type Settlement struct {
	ID          string    `json:"id"`
	TripID      string    `json:"trip_id"`
	FromUserID  string    `json:"from_user_id"`
	FromName    string    `json:"from_name"`
	ToUserID    string    `json:"to_user_id"`
	ToName      string    `json:"to_name"`
	AmountMinor int64     `json:"amount_minor"`
	Currency    string    `json:"currency"`
	SettledOn   string    `json:"settled_on"`
	Note        string    `json:"note"`
	CreatedAt   time.Time `json:"created_at"`
}

type SettlementInput struct {
	FromUserID  string `json:"from_user_id"`
	ToUserID    string `json:"to_user_id"`
	AmountMinor int64  `json:"amount_minor"`
	Currency    string `json:"currency"`
	SettledOn   string `json:"settled_on"`
	Note        string `json:"note"`
}

type CurrencyLedger struct {
	Currency    string           `json:"currency"`
	Balances    []money.Balance  `json:"balances"`
	Suggestions []money.Transfer `json:"suggestions"`
	TotalMinor  int64            `json:"total_minor"`
}

type OTPChallenge struct {
	ID        string
	Email     string
	CodeHMAC  []byte
	ExpiresAt time.Time
	Attempts  int
}

type AuthAuditEvent struct {
	Event     string
	Outcome   string
	Email     string
	UserID    string
	IP        string
	UserAgent string
	Reason    string
	RequestID string
}
