package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/jackc/pgx/v5"

	"wayfarer/api/internal/config"
)

type seedItem struct {
	day      int
	group    string
	title    string
	kind     string
	location string
	lat, lng float64
	start    string
	end      string
	notes    string
}

type seedEdge struct {
	day      int
	group    string
	from, to int
	mode     string
	duration int
	distance float64
	depart   string
	arrive   string
}

func main() {
	_ = config.LoadEnvFile(".env")
	if os.Getenv("APP_ENV") == "production" {
		log.Fatal("refusing to seed a production database")
	}
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		log.Fatal("DATABASE_URL is required")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()
	conn, err := pgx.Connect(ctx, dsn)
	if err != nil {
		log.Fatalf("connect: %v", err)
	}
	defer conn.Close(ctx)

	title := "Kyoto & Tokyo, Slowly"
	var existing string
	err = conn.QueryRow(ctx, `SELECT id FROM trips WHERE title=$1 LIMIT 1`, title).Scan(&existing)
	if err == nil {
		fmt.Printf("demo trip already exists: %s\n", existing)
		return
	}
	if err != pgx.ErrNoRows {
		log.Fatalf("check demo: %v", err)
	}

	tx, err := conn.Begin(ctx)
	if err != nil {
		log.Fatalf("begin: %v", err)
	}
	defer tx.Rollback(ctx)

	users := map[string]string{}
	for email, name := range map[string]string{
		"alex@example.com": "Alex Morgan",
		"maya@example.com": "Maya Chen",
		"sam@example.com":  "Sam Rivera",
	} {
		var id string
		if err := tx.QueryRow(ctx,
			`INSERT INTO users (email, display_name) VALUES ($1,$2)
			 ON CONFLICT (email) DO UPDATE SET display_name=EXCLUDED.display_name RETURNING id`,
			email, name).Scan(&id); err != nil {
			log.Fatalf("seed user: %v", err)
		}
		users[email] = id
	}
	alex, maya, sam := users["alex@example.com"], users["maya@example.com"], users["sam@example.com"]

	var tripID string
	err = tx.QueryRow(ctx,
		`INSERT INTO trips (owner_id, title, destination, start_date, end_date, timezone, currency, description, cover_image_url)
		 VALUES ($1,$2,'Kyoto & Tokyo','2026-11-12','2026-11-18','Asia/Tokyo','JPY',
		   'Seven unhurried days between temple gardens and late-night Tokyo. Built to leave room for wandering.',
		   'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=1600&q=80')
		 RETURNING id`, alex, title).Scan(&tripID)
	if err != nil {
		log.Fatalf("seed trip: %v", err)
	}
	for _, m := range []struct {
		id   string
		role string
	}{{alex, "owner"}, {maya, "editor"}, {sam, "viewer"}} {
		if _, err := tx.Exec(ctx, `INSERT INTO trip_members (trip_id,user_id,role) VALUES ($1,$2,$3)`, tripID, m.id, m.role); err != nil {
			log.Fatalf("seed member: %v", err)
		}
	}

	groups := map[string]string{}
	for _, g := range []struct {
		key, name, color string
		members          []string
	}{
		{"temples", "Temples & gardens", "#2f6f5e", []string{alex, maya}},
		{"food", "Food & city", "#b4532a", []string{alex, sam}},
	} {
		var id string
		if err := tx.QueryRow(ctx, `INSERT INTO trip_groups (trip_id,name,color) VALUES ($1,$2,$3) RETURNING id`,
			tripID, g.name, g.color).Scan(&id); err != nil {
			log.Fatalf("seed group: %v", err)
		}
		groups[g.key] = id
		for _, member := range g.members {
			if _, err := tx.Exec(ctx, `INSERT INTO trip_group_members (group_id,trip_id,user_id) VALUES ($1,$2,$3)`,
				id, tripID, member); err != nil {
				log.Fatalf("seed group member: %v", err)
			}
		}
	}

	dayTitles := []string{
		"Arrival, Gion lanterns",
		"Southern Higashiyama",
		"Arashiyama",
		"Shinkansen to Tokyo",
		"Tokyo icons",
		"Neighborhoods",
		"Departure",
	}
	days := make([]string, len(dayTitles))
	for i, dayTitle := range dayTitles {
		var id string
		if err := tx.QueryRow(ctx,
			`INSERT INTO itinerary_days (trip_id,date,title,position)
			 VALUES ($1, $2::date, $3, $4) RETURNING id`,
			tripID, fmt.Sprintf("2026-11-%02d", 12+i), dayTitle, i).Scan(&id); err != nil {
			log.Fatalf("seed day: %v", err)
		}
		days[i] = id
	}

	items := []seedItem{
		{0, "", "Kyoto Station", "place", "Kyoto Station", 34.9858, 135.7588, "09:10", "09:40", "IC cards and a locker for the bags."},
		{0, "", "Nishiki Market", "meal", "Nishiki Market", 35.0050, 135.7649, "12:00", "13:30", "Graze rather than commit to one stall."},
		{0, "", "Gion at dusk", "activity", "Gion", 35.0037, 135.7752, "17:30", "19:30", "Keep voices low on the private lanes."},

		{1, "", "Fushimi Inari Taisha", "place", "Fushimi Inari", 34.9671, 135.7727, "07:30", "10:00", "Go early; turn back at the Yotsutsuji viewpoint."},
		{1, "temples", "Philosopher's Path", "activity", "Philosopher's Path", 35.0260, 135.7947, "12:30", "14:00", "Slow walk north from Ginkaku-ji."},
		{1, "", "Nanzen-ji", "place", "Nanzen-ji", 35.0110, 135.7944, "15:00", "16:30", "The aqueduct and Hojo garden are the quiet highlights."},

		{2, "", "Arashiyama Bamboo Grove", "place", "Arashiyama", 35.0172, 135.6716, "08:00", "09:30", "Before the tour groups arrive."},
		{2, "temples", "Tenryu-ji", "place", "Tenryu-ji", 35.0156, 135.6738, "10:00", "11:30", "Sogenchi garden, then lunch by the river."},
		{2, "", "Okochi Sanso Garden", "activity", "Okochi Sanso", 35.0178, 135.6685, "13:00", "14:30", "Includes matcha with the garden ticket."},

		{3, "", "Kyoto Station", "transport", "Kyoto Station", 34.9858, 135.7588, "08:30", "09:00", "Reserved seats, carriage 7."},
		{3, "", "Tokyo Station", "transport", "Tokyo Station", 35.6812, 139.7671, "11:30", "12:00", "Leave luggage at the hotel first."},
		{3, "", "Shinjuku Gyoen", "place", "Shinjuku Gyoen", 35.6852, 139.7100, "15:00", "17:00", "A gentle first Tokyo afternoon."},

		{4, "food", "Tsukiji Outer Market", "meal", "Tsukiji", 35.6655, 139.7708, "08:30", "10:00", "Tamagoyaki, then a standing sushi counter."},
		{4, "", "teamLab Borderless", "activity", "teamLab Borderless", 35.6604, 139.7292, "12:00", "14:30", "Timed entry; wear something washable."},
		{4, "", "Shibuya Crossing", "place", "Shibuya", 35.6595, 139.7005, "18:00", "19:00", "Watch from the bookstore cafe, then cross once."},

		{5, "", "Meiji Jingu", "place", "Meiji Jingu", 35.6764, 139.6993, "09:00", "11:00", "Forest approach before the city wakes up."},
		{5, "", "Daikanyama T-Site", "activity", "Daikanyama", 35.6497, 139.6996, "13:00", "15:30", "Bookshop, coffee, no agenda."},
		{5, "food", "Soba dinner in Ebisu", "meal", "Ebisu", 35.6467, 139.7101, "18:30", "20:00", "Small counter; arrive early."},

		{6, "", "Hotel to Haneda", "transport", "Haneda Airport", 35.5494, 139.7798, "09:00", "10:00", "Allow buffer for the monorail transfer."},
		{6, "", "Haneda Airport", "place", "Haneda Airport", 35.5494, 139.7798, "10:30", "12:30", "Check bags, then a last coffee."},
	}
	itemIDs := make([]string, len(items))
	for i, it := range items {
		groupID := ""
		if it.group != "" {
			groupID = groups[it.group]
		}
		if err := tx.QueryRow(ctx,
			`INSERT INTO itinerary_items (trip_id,day_id,group_id,title,kind,location_name,latitude,longitude,
			   start_time,end_time,notes,pos_x,pos_y,sort_order,created_by)
			 VALUES ($1,$2,NULLIF($3,'')::uuid,$4,$5,$6,$7,$8,NULLIF($9,'')::time,NULLIF($10,'')::time,$11,$12,120,$13,$14)
			 RETURNING id`,
			tripID, days[it.day], groupID, it.title, it.kind, it.location, it.lat, it.lng,
			it.start, it.end, it.notes, 80+float64(i%3)*330, i+1, alex).Scan(&itemIDs[i]); err != nil {
			log.Fatalf("seed item: %v", err)
		}
	}

	edges := []seedEdge{
		{0, "", 0, 1, "transit", 15, 2.4, "10:00", "10:15"},
		{0, "", 1, 2, "walk", 20, 1.6, "16:30", "16:50"},
		{1, "", 3, 4, "train", 20, 6.2, "10:30", "10:50"},
		{1, "temples", 3, 4, "train", 20, 6.2, "10:35", "10:55"},
		{1, "", 4, 5, "walk", 35, 2.7, "14:10", "14:45"},
		{2, "", 6, 7, "walk", 10, 0.8, "09:40", "09:50"},
		{2, "", 7, 8, "walk", 8, 0.6, "11:40", "11:48"},
		{3, "", 9, 10, "train", 135, 513, "09:00", "11:15"},
		{3, "", 10, 11, "transit", 25, 8, "13:00", "13:25"},
		{4, "", 12, 13, "walk", 18, 1.3, "10:15", "10:33"},
		{4, "", 13, 14, "transit", 35, 9.5, "15:00", "15:35"},
		{5, "", 15, 16, "walk", 22, 1.7, "11:15", "11:37"},
		{5, "", 16, 17, "train", 12, 3.2, "17:45", "17:57"},
		{6, "", 18, 19, "train", 35, 20, "09:00", "09:35"},
	}
	for _, e := range edges {
		groupID := ""
		if e.group != "" {
			groupID = groups[e.group]
		}
		if _, err := tx.Exec(ctx,
			`INSERT INTO itinerary_edges (trip_id,day_id,group_id,from_item_id,to_item_id,mode,
			   duration_minutes,distance_km,depart_time,arrive_time,notes)
			 VALUES ($1,$2,NULLIF($3,'')::uuid,$4,$5,$6,$7,$8,NULLIF($9,'')::time,NULLIF($10,'')::time,'')`,
			tripID, days[e.day], groupID, itemIDs[e.from], itemIDs[e.to], e.mode,
			e.duration, e.distance, e.depart, e.arrive); err != nil {
			log.Fatalf("seed edge: %v", err)
		}
	}

	notes := []struct {
		title, body string
		pinned      bool
	}{
		{"Before you go", "# Before you go\n\n- [x] Buy a Suica card on arrival\n- [ ] Book teamLab for a weekday\n- [ ] Reserve the Shinkansen seats\n\n> Keep one afternoon completely unplanned.\n", true},
		{"Kyoto food map", "## Kyoto food map\n\n**Nishiki Market** is best before noon. For dinner, look north of Shijo on Kiyamachi for small counters.\n\n- Tofu kaiseki near Nanzen-ji\n- Standing sushi at the market\n- Matcha and wagashi in Gion\n", false},
	}
	for _, n := range notes {
		if _, err := tx.Exec(ctx,
			`INSERT INTO trip_notes (trip_id,title,body_markdown,pinned,created_by,updated_by) VALUES ($1,$2,$3,$4,$5,$5)`,
			tripID, n.title, n.body, n.pinned, alex); err != nil {
			log.Fatalf("seed note: %v", err)
		}
	}

	expenses := []struct {
		description string
		amount      int64
		category    string
		date        string
		payer       string
		note        string
		splits      map[string]int64
	}{
		{"Ryokan & hotels", 480000, "stay", "2026-11-12", alex, "Three nights Kyoto, four nights Tokyo", map[string]int64{alex: 160000, maya: 160000, sam: 160000}},
		{"Kaiseki dinner", 24600, "food", "2026-11-13", maya, "Gion counter, tasting menu", map[string]int64{alex: 8200, maya: 8200, sam: 8200}},
		{"teamLab tickets", 9600, "activity", "2026-11-16", sam, "Timed entry", map[string]int64{alex: 4800, maya: 2400, sam: 2400}},
		{"Shinkansen reserved seats", 42300, "transport", "2026-11-15", alex, "Kyoto to Tokyo", map[string]int64{alex: 14100, maya: 14100, sam: 14100}},
		{"Coffee & snacks", 5400, "food", "2026-11-17", sam, "Daikanyama and Ebisu", map[string]int64{alex: 1800, maya: 1800, sam: 1800}},
	}
	for _, e := range expenses {
		var expenseID string
		if err := tx.QueryRow(ctx,
			`INSERT INTO expenses (trip_id,description,amount_minor,currency,category,expense_date,payer_id,note,created_by)
			 VALUES ($1,$2,$3,'JPY',$4,$5::date,$6,$7,$8) RETURNING id`,
			tripID, e.description, e.amount, e.category, e.date, e.payer, e.note, alex).Scan(&expenseID); err != nil {
			log.Fatalf("seed expense: %v", err)
		}
		for userID, amount := range e.splits {
			if _, err := tx.Exec(ctx, `INSERT INTO expense_splits (expense_id,user_id,amount_minor) VALUES ($1,$2,$3)`,
				expenseID, userID, amount); err != nil {
				log.Fatalf("seed split: %v", err)
			}
		}
	}
	if _, err := tx.Exec(ctx,
		`INSERT INTO settlements (trip_id,from_user_id,to_user_id,amount_minor,currency,settled_on,note,created_by)
		 VALUES ($1,$2,$3,50000,'JPY','2026-11-18','Paid back part of the hotel', $2)`,
		tripID, maya, alex); err != nil {
		log.Fatalf("seed settlement: %v", err)
	}

	if err := tx.Commit(ctx); err != nil {
		log.Fatalf("commit: %v", err)
	}
	fmt.Println("Seeded demo trip:", title)
	fmt.Println("Login with alex@example.com, maya@example.com or sam@example.com")
	fmt.Println("Request a code; in MAIL_MODE=dev the six-digit code is returned by the API response.")
}
