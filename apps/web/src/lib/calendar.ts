import type { ItineraryDay, Trip } from "./types";

function escapeICS(str: string): string {
  return str
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function pad(num: number): string {
  return num < 10 ? `0${num}` : `${num}`;
}

function formatDateToICS(dateStr: string): string {
  return dateStr.replace(/-/g, "");
}

function formatTimeToICS(timeStr: string): string {
  const parts = timeStr.split(":");
  const h = parts[0] || "00";
  const m = parts[1] || "00";
  const s = parts[2] || "00";
  return `${h.padStart(2, "0")}${m.padStart(2, "0")}${s.padStart(2, "0")}`;
}

function addHours(timeStr: string, hours: number): string {
  const parts = timeStr.split(":");
  let h = parseInt(parts[0] || "0", 10) + hours;
  const m = parts[1] || "00";
  const s = parts[2] || "00";
  if (h >= 24) h = 23;
  return `${pad(h)}${m}${s}`;
}

function getNextDateStr(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

export function generateCalendarICS(trip: Trip, days: ItineraryDay[]): string {
  const now = new Date();
  const dtstamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Wayfarer//Travel Planner//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeICS(trip.title)}`,
    `X-WR-CALDESC:${escapeICS(trip.description || `Trip to ${trip.destination}`)}`,
  ];

  if (trip.timezone) {
    lines.push(`X-WR-TIMEZONE:${trip.timezone}`);
  }

  for (const day of days) {
    const dateFormatted = formatDateToICS(day.date);

    for (const item of day.items) {
      lines.push("BEGIN:VEVENT");
      lines.push(`UID:${item.id}@wayfarer.app`);
      lines.push(`DTSTAMP:${dtstamp}`);

      if (item.start_time) {
        const startFormatted = formatTimeToICS(item.start_time);
        lines.push(`DTSTART:${dateFormatted}T${startFormatted}`);

        if (item.end_time) {
          const endFormatted = formatTimeToICS(item.end_time);
          lines.push(`DTEND:${dateFormatted}T${endFormatted}`);
        } else {
          lines.push(`DTEND:${dateFormatted}T${addHours(item.start_time, 1)}`);
        }
      } else {
        // All day event
        lines.push(`DTSTART;VALUE=DATE:${dateFormatted}`);
        lines.push(`DTEND;VALUE=DATE:${getNextDateStr(day.date)}`);
      }

      lines.push(`SUMMARY:${escapeICS(item.title)}`);

      const descParts: string[] = [];
      if (item.kind) descParts.push(`Type: ${item.kind.toUpperCase()}`);
      if (item.notes) descParts.push(item.notes);
      if (item.link) descParts.push(`Link: ${item.link}`);
      if (descParts.length > 0) {
        lines.push(`DESCRIPTION:${escapeICS(descParts.join("\n\n"))}`);
      }

      const location = item.address || item.location_name;
      if (location) {
        lines.push(`LOCATION:${escapeICS(location)}`);
      }

      if (item.has_coordinates && item.latitude && item.longitude) {
        lines.push(`GEO:${item.latitude.toFixed(6)};${item.longitude.toFixed(6)}`);
      }

      lines.push("STATUS:CONFIRMED");
      lines.push("END:VEVENT");
    }
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export function downloadCalendarICS(trip: Trip, days: ItineraryDay[]): void {
  const content = generateCalendarICS(trip, days);
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const filename = `${trip.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-itinerary.ics`;

  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
