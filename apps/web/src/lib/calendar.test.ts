import { describe, expect, it } from "vitest";
import { generateCalendarICS } from "./calendar";
import type { ItineraryDay, Trip } from "./types";

const mockTrip: Trip = {
  id: "trip-1",
  title: "Tokyo Autumn Adventure",
  destination: "Tokyo, Japan",
  start_date: "2026-11-10",
  end_date: "2026-11-15",
  timezone: "Asia/Tokyo",
  currency: "JPY",
  description: "Exploring temples and ramen",
  cover_image_url: "",
  status: "active",
  owner_id: "user-1",
  member_count: 1,
  version: 1,
  role: "owner",
  created_at: "2026-11-01T00:00:00Z",
  updated_at: "2026-11-01T00:00:00Z",
};

const mockDays: ItineraryDay[] = [
  {
    id: "day-1",
    trip_id: "trip-1",
    date: "2026-11-10",
    title: "Arrival and Shinjuku",
    position: 0,
    version: 1,
    created_at: "2026-11-01T00:00:00Z",
    updated_at: "2026-11-01T00:00:00Z",
    items: [
      {
        id: "item-1",
        trip_id: "trip-1",
        day_id: "day-1",
        group_id: "",
        title: "Check into Hotel",
        kind: "stay",
        location_name: "Park Hyatt Tokyo",
        address: "3-7-1-2 Nishi-Shinjuku, Shinjuku-ku, Tokyo",
        latitude: 35.6857,
        longitude: 139.6914,
        has_coordinates: true,
        start_time: "15:00",
        end_time: "16:00",
        notes: "Leave bags at front desk",
        cost_minor: 0,
        currency: "JPY",
        link: "https://www.google.com/maps?q=35.6857,139.6914",
        pos_x: 0,
        pos_y: 0,
        sort_order: 1,
        version: 1,
        created_at: "2026-11-01T00:00:00Z",
        updated_at: "2026-11-01T00:00:00Z",
      },
      {
        id: "item-2",
        trip_id: "trip-1",
        day_id: "day-1",
        group_id: "",
        title: "All-day Omoide Yokocho Stroll",
        kind: "meal",
        location_name: "Omoide Yokocho",
        address: "Shinjuku, Tokyo",
        latitude: 0,
        longitude: 0,
        has_coordinates: false,
        start_time: "",
        end_time: "",
        notes: "Try yakitori",
        cost_minor: 3000,
        currency: "JPY",
        link: "",
        pos_x: 0,
        pos_y: 100,
        sort_order: 2,
        version: 1,
        created_at: "2026-11-01T00:00:00Z",
        updated_at: "2026-11-01T00:00:00Z",
      },
    ],
    edges: [],
  },
];

describe("generateCalendarICS", () => {
  it("generates valid RFC 5545 iCalendar data", () => {
    const ics = generateCalendarICS(mockTrip, mockDays);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("VERSION:2.0");
    expect(ics).toContain("X-WR-CALNAME:Tokyo Autumn Adventure");
    expect(ics).toContain("X-WR-TIMEZONE:Asia/Tokyo");
    expect(ics).toContain("SUMMARY:Check into Hotel");
    expect(ics).toContain("DTSTART:20261110T150000");
    expect(ics).toContain("DTEND:20261110T160000");
    expect(ics).toContain("LOCATION:3-7-1-2 Nishi-Shinjuku\\, Shinjuku-ku\\, Tokyo");
    expect(ics).toContain("GEO:35.685700;139.691400");
    expect(ics).toContain("SUMMARY:All-day Omoide Yokocho Stroll");
    expect(ics).toContain("DTSTART;VALUE=DATE:20261110");
    expect(ics).toContain("DTEND;VALUE=DATE:20261111");
    expect(ics).toContain("END:VCALENDAR");
  });
});
