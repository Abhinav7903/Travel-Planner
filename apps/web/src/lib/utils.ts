import { clsx, type ClassValue } from "clsx";
import { format, parseISO } from "date-fns";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function currencyDigits(currency: string): number {
  try {
    const digits = new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits;
    return typeof digits === "number" ? digits : 2;
  } catch {
    return 2;
  }
}

export function formatMoney(minor: number, currency: string, compact = false): string {
  const digits = currencyDigits(currency);
  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency,
      maximumFractionDigits: digits,
      notation: compact ? "compact" : "standard",
    }).format(minor / 10 ** digits);
  } catch {
    return `${currency} ${(minor / 10 ** digits).toFixed(digits)}`;
  }
}

export function parseMoneyInput(value: string, currency: string): number | null {
  const trimmed = value.trim().replace(/,/g, "");
  if (!trimmed) return null;
  const digits = currencyDigits(currency);
  const pattern = digits === 0 ? /^\d+$/ : new RegExp(`^\\d+(\\.\\d{0,${digits}})?$`);
  if (!pattern.test(trimmed)) return null;
  const [whole = "0", fraction = ""] = trimmed.split(".");
  const minor = Number(whole) * 10 ** digits + Number(fraction.padEnd(digits, "0"));
  return Number.isSafeInteger(minor) ? minor : null;
}

export function formatDay(date: string, pattern = "EEE, MMM d"): string {
  try {
    return format(parseISO(date), pattern);
  } catch {
    return date;
  }
}

export function formatDateRange(start: string, end: string): string {
  const from = parseISO(start);
  const to = parseISO(end);
  if (from.getFullYear() === to.getFullYear()) {
    if (from.getMonth() === to.getMonth()) {
      return `${format(from, "MMM d")} – ${format(to, "d, yyyy")}`;
    }
    return `${format(from, "MMM d")} – ${format(to, "MMM d, yyyy")}`;
  }
  return `${format(from, "MMM d, yyyy")} – ${format(to, "MMM d, yyyy")}`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}

export const roleLabel: Record<string, string> = {
  owner: "Owner",
  editor: "Editor",
  viewer: "Viewer",
};

export const kindLabel: Record<string, string> = {
  place: "Place",
  activity: "Activity",
  meal: "Meal",
  transport: "Transport",
  stay: "Stay",
  note: "Note",
};

export const modeLabel: Record<string, string> = {
  walk: "Walk",
  transit: "Transit",
  train: "Train",
  bus: "Bus",
  bike: "Bike",
  car: "Car",
  flight: "Flight",
  ferry: "Ferry",
  other: "Other",
};

export function timeLabel(value: string): string {
  if (!value) return "Time open";
  const [hourText, minute] = value.split(":");
  const hour = Number(hourText);
  if (Number.isNaN(hour)) return value;
  const suffix = hour >= 12 ? "PM" : "AM";
  const display = hour % 12 || 12;
  return `${display}:${minute ?? "00"} ${suffix}`;
}

export function canEdit(role: string | undefined): boolean {
  return role === "owner" || role === "editor";
}

export function canManage(role: string | undefined): boolean {
  return role === "owner";
}

export function uid(): string {
  return crypto.randomUUID();
}
