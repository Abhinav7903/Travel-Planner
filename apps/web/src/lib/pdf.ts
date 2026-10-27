import type { ItineraryDay, ItineraryItem, Member, Trip, TripGroup } from "./types";
import { formatDateRange, formatDay, kindLabel, modeLabel, timeLabel } from "./utils";

const INK = [37, 39, 33] as const;
const SOFT = [100, 103, 94] as const;
const FOREST = [31, 77, 61] as const;
const LINE = [218, 212, 199] as const;
const PAPER = [253, 251, 247] as const;

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

export async function exportPlannerPDF({
  trip,
  days,
  groups,
  members,
}: {
  trip: Trip;
  days: ItineraryDay[];
  groups: TripGroup[];
  members: Member[];
}) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
  const width = 210;
  const height = 297;
  const margin = 18;
  let pageNumber = 0;

  const setFont = (style: "normal" | "bold" | "italic" = "normal") => doc.setFont("helvetica", style);
  const text = (value: string, x: number, y: number, options?: { size?: number; color?: readonly number[]; style?: "normal" | "bold" | "italic"; align?: "left" | "right" | "center" }) => {
    setFont(options?.style ?? "normal");
    doc.setFontSize(options?.size ?? 9);
    const color = options?.color ?? INK;
    doc.setTextColor(color[0] ?? 0, color[1] ?? 0, color[2] ?? 0);
    doc.text(value, x, y, { align: options?.align ?? "left" });
  };
  const line = (x1: number, y1: number, x2: number, y2: number, color: readonly number[] = LINE, lineWidth = 0.25) => {
    doc.setDrawColor(color[0] ?? 0, color[1] ?? 0, color[2] ?? 0);
    doc.setLineWidth(lineWidth);
    doc.line(x1, y1, x2, y2);
  };
  const fileSafe = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "trip";

  // Cover
  doc.setFillColor(246, 243, 236);
  doc.rect(0, 0, width, height, "F");
  doc.setFillColor(31, 77, 61);
  doc.rect(0, 0, 11, height, "F");
  doc.setFillColor(223, 231, 220);
  doc.circle(166, 53, 26, "F");
  doc.setFillColor(238, 227, 205);
  doc.circle(181, 85, 16, "F");

  text("WAYFARER", margin + 5, 31, { size: 8, style: "bold", color: FOREST });
  text("AN ITINERARY PLANNER", margin + 5, 36, { size: 6.5, color: SOFT });
  doc.setDrawColor(31, 77, 61);
  doc.setLineWidth(0.4);
  doc.line(margin + 5, 41, margin + 23, 41);

  setFont("italic");
  doc.setFontSize(11);
  doc.setTextColor(100, 103, 94);
  doc.text("A plan, gathered in one place.", margin + 5, 98);

  setFont("bold");
  doc.setFontSize(34);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  const titleLines = doc.splitTextToSize(trip.title, 150);
  doc.text(titleLines.slice(0, 3), margin + 5, 118);

  setFont("normal");
  doc.setFontSize(15);
  doc.setTextColor(31, 77, 61);
  doc.text(trip.destination, margin + 5, 141);

  setFont("normal");
  doc.setFontSize(9.5);
  doc.setTextColor(SOFT[0], SOFT[1], SOFT[2]);
  doc.text(formatDateRange(trip.start_date, trip.end_date), margin + 5, 150);
  if (trip.description) {
    doc.setFontSize(8.5);
    const lines = doc.splitTextToSize(trip.description, 130).slice(0, 4);
    doc.text(lines, margin + 5, 161);
  }

  // Index
  let indexY = 198;
  line(margin + 5, indexY - 7, margin + 165, indexY - 7);
  text("THE DAYS", margin + 5, indexY, { size: 7, style: "bold", color: FOREST });
  indexY += 8;
  for (const [index, day] of days.slice(0, 15).entries()) {
    text(`Day ${String(index + 1).padStart(2, "0")}`, margin + 5, indexY, { size: 8, style: "bold" });
    text(formatDay(day.date, "EEEE, MMMM d"), margin + 25, indexY, { size: 8, color: SOFT });
    text(truncate(day.title || day.date, 44), margin + 91, indexY, { size: 8, color: SOFT });
    indexY += 6.6;
  }

  line(margin + 5, 274, margin + 165, 274);
  text(`${members.length} ${members.length === 1 ? "traveller" : "travellers"} · ${members.map((member) => member.display_name).join(", ")}`, margin + 5, 281, {
    size: 7.5,
    color: SOFT,
  });
  text("Built with Wayfarer · Times are local to the trip", width - margin, 281, { size: 7, color: SOFT, align: "right" });

  // Day pages
  for (const [index, day] of days.entries()) {
    doc.addPage();
    pageNumber += 1;
    doc.setFillColor(253, 251, 247);
    doc.rect(0, 0, width, height, "F");
    doc.setFillColor(246, 243, 236);
    doc.rect(0, 0, width, 34, "F");
    doc.setFillColor(31, 77, 61);
    doc.rect(0, 0, 5, 34, "F");

    text(`DAY ${String(index + 1).padStart(2, "0")}`, margin, 13, { size: 7, style: "bold", color: FOREST });
    text(truncate(day.title || formatDay(day.date, "EEEE"), 58), margin, 22, { size: 17, style: "bold" });
    text(formatDay(day.date, "EEEE, MMMM d, yyyy"), width - margin, 13, { size: 8, color: SOFT, align: "right" });
    text(formatDateRange(trip.start_date, trip.end_date), width - margin, 22, { size: 7, color: SOFT, align: "right" });

    const items = [...day.items].sort((a, b) => {
      const timeA = a.start_time || "99:99";
      const timeB = b.start_time || "99:99";
      return timeA.localeCompare(timeB) || a.sort_order - b.sort_order;
    });

    let y = 47;
    if (items.length === 0) {
      text("No stops planned for this day yet.", margin, y, { size: 9, color: SOFT, style: "italic" });
      y += 14;
    }

    for (const [itemIndex, item] of items.entries()) {
      const group = groups.find((candidate) => candidate.id === item.group_id);
      if (y > 236) break;
      doc.setFillColor(PAPER[0], PAPER[1], PAPER[2]);
      doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
      doc.setLineWidth(0.25);
      doc.roundedRect(margin, y, 174, 16.5, 1.8, 1.8, "FD");
      const groupColor = hexToRGB(group?.color) ?? FOREST;
      doc.setFillColor(groupColor[0] ?? 0, groupColor[1] ?? 0, groupColor[2] ?? 0);
      doc.circle(margin + 5, y + 5.4, 1.2, "F");

      text(timeLabel(item.start_time), margin + 3.2, y + 11.9, { size: 6.6, color: SOFT, style: "bold" });
      text(truncate(item.title, 58), margin + 26, y + 7.4, { size: 9.5, style: "bold" });
      const detail = [item.location_name, item.address].filter(Boolean).join(" · ");
      text(truncate(detail || kindLabel[item.kind] || "Stop", 82), margin + 26, y + 12.6, { size: 7, color: SOFT });
      text(kindLabel[item.kind] ?? "Stop", width - margin - 3, y + 7.4, { size: 6.5, color: SOFT, align: "right" });
      if (group) text(truncate(group.name, 22), width - margin - 3, y + 12.6, { size: 6.5, color: SOFT, align: "right" });

      if (itemIndex < items.length - 1) {
        const next = items[itemIndex + 1];
        const edge = day.edges.find((candidate) => candidate.from_item_id === item.id && candidate.to_item_id === next?.id);
        line(margin + 5, y + 7, margin + 5, y + 16.5, LINE, 0.2);
        const legLabel = edge
          ? `${modeLabel[edge.mode] ?? edge.mode} · ${edge.duration_minutes > 0 ? `${edge.duration_minutes} min` : "time open"}${edge.distance_km > 0 ? ` · ${edge.distance_km} km` : ""}`
          : "No travel leg added";
        text(truncate(legLabel, 56), margin + 8, y + 20, { size: 6.4, color: SOFT, style: "italic" });
        y += 23.5;
      } else {
        y += 20;
      }
    }

    if (items.length > 0) {
      // Route sketch
      const sketchY = Math.min(Math.max(y + 3, 206), 236);
      const sketchH = 276 - sketchY;
      doc.setFillColor(249, 246, 239);
      doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
      doc.roundedRect(margin, sketchY, 174, sketchH, 2.2, 2.2, "FD");
      text("ROUTE SKETCH", margin + 4, sketchY + 6, { size: 6.5, style: "bold", color: FOREST });
      drawSketch(doc, day, items, groups, margin + 4, sketchY + 10, 166, sketchH - 15);
      text("Sketch reflects canvas positions and is not to scale.", width - margin - 3, sketchY + sketchH - 3, { size: 5.6, color: SOFT, align: "right" });
    }

    line(margin, height - 13, width - margin, height - 13);
    text("Wayfarer", margin, height - 8, { size: 6.5, color: SOFT });
    text(`${trip.title} · ${pageNumber + 1}`, width - margin, height - 8, { size: 6.5, color: SOFT, align: "right" });
  }

  doc.save(`${fileSafe(trip.title)}-planner.pdf`);
  return days.length;
}

function drawSketch(
  doc: import("jspdf").jsPDF,
  day: ItineraryDay,
  items: ItineraryItem[],
  groups: TripGroup[],
  x: number,
  y: number,
  width: number,
  height: number,
) {
  if (items.length === 0) return;
  const xs = items.map((item) => item.pos_x);
  const ys = items.map((item) => item.pos_y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;
  const nodeW = Math.min(34, Math.max(24, width / Math.max(items.length, 3)));
  const nodeH = 11;
  const position = new Map<string, { x: number; y: number }>();
  items.forEach((item) => {
    const px = x + 2 + ((item.pos_x - minX) / spanX) * (width - nodeW - 4);
    const py = y + 2 + ((item.pos_y - minY) / spanY) * (height - nodeH - 4);
    position.set(item.id, { x: px, y: py });
  });

  for (const edge of day.edges) {
    const from = position.get(edge.from_item_id);
    const to = position.get(edge.to_item_id);
    if (!from || !to) continue;
    const x1 = from.x + nodeW / 2;
    const y1 = from.y + nodeH / 2;
    const x2 = to.x + nodeW / 2;
    const y2 = to.y + nodeH / 2;
    doc.setDrawColor(174, 178, 164);
    doc.setLineWidth(0.25);
    doc.line(x1, y1, x2, y2);
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const arrow = 1.4;
    doc.setFillColor(174, 178, 164);
    doc.triangle(
      x2,
      y2,
      x2 - arrow * Math.cos(angle - Math.PI / 6),
      y2 - arrow * Math.sin(angle - Math.PI / 6),
      x2 - arrow * Math.cos(angle + Math.PI / 6),
      y2 - arrow * Math.sin(angle + Math.PI / 6),
      "F",
    );
  }

  for (const item of items) {
    const pos = position.get(item.id);
    if (!pos) continue;
    const group = groups.find((candidate) => candidate.id === item.group_id);
    const color = hexToRGB(group?.color) ?? FOREST;
    doc.setFillColor(253, 251, 247);
    doc.setDrawColor(color[0] ?? 31, color[1] ?? 77, color[2] ?? 61);
    doc.setLineWidth(0.35);
    doc.roundedRect(pos.x, pos.y, nodeW, nodeH, 1.2, 1.2, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(5.8);
    doc.setTextColor(INK[0], INK[1], INK[2]);
    doc.text(truncate(item.title, 24), pos.x + 2, pos.y + 4.6);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(5.2);
    doc.setTextColor(SOFT[0], SOFT[1], SOFT[2]);
    doc.text(item.start_time || kindLabel[item.kind] || "", pos.x + 2, pos.y + 8.2);
  }
}

function hexToRGB(value?: string): readonly number[] | null {
  if (!value) return null;
  const match = /^#?([0-9a-f]{6})$/i.exec(value.trim());
  if (!match?.[1]) return null;
  const hex = match[1];
  return [Number.parseInt(hex.slice(0, 2), 16), Number.parseInt(hex.slice(2, 4), 16), Number.parseInt(hex.slice(4, 6), 16)];
}
