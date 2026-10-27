export type ParsedMapLink =
  | { ok: true; latitude: number; longitude: number; link: string }
  | { ok: false; message: string };

const NUMBER = String.raw`-?\d{1,3}(?:\.\d+)?`;
const PAIR = new RegExp(`(${NUMBER})\\s*,\\s*(${NUMBER})`);
const DIRECT_PAIR = new RegExp(`^${NUMBER}\\s*,\\s*${NUMBER}$`);

function coordinates(latitude: number, longitude: number) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { latitude, longitude };
}

function pair(value: string) {
  const match = value.match(PAIR);
  if (!match) return null;
  return coordinates(Number(match[1]), Number(match[2]));
}

function mapsLink(latitude: number, longitude: number) {
  return `https://www.google.com/maps?q=${latitude},${longitude}`;
}

function decode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function isShortGoogleMapsLink(raw: string): boolean {
  try {
    const parsed = new URL(raw.trim());
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    return parsed.hostname === "maps.app.goo.gl" || parsed.hostname === "goo.gl";
  } catch {
    return false;
  }
}

export function parseGoogleMapsLink(raw: string): ParsedMapLink {
  const value = raw.trim();
  if (!value) {
    return { ok: false, message: "Paste a Google Maps link or latitude, longitude." };
  }

  if (DIRECT_PAIR.test(value)) {
    const found = pair(value);
    if (!found) {
      return { ok: false, message: "Latitude must be between -90 and 90, and longitude between -180 and 180." };
    }
    return { ok: true, ...found, link: mapsLink(found.latitude, found.longitude) };
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { ok: false, message: "Paste a full Google Maps URL or coordinates like 35.0116, 135.7681." };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, message: "Use an http or https Google Maps link." };
  }

  const decoded = decode(url.href);

  const place = decoded.match(new RegExp(String.raw`!3d(${NUMBER})!4d(${NUMBER})`));
  const viewport = decoded.match(new RegExp(String.raw`@(${NUMBER}),(${NUMBER})`));

  let found = place ? coordinates(Number(place[1]), Number(place[2])) : null;

  if (!found && viewport) {
    found = coordinates(Number(viewport[1]), Number(viewport[2]));
  }

  if (!found) {
    for (const key of ["q", "query", "ll", "center", "latlng", "destination", "daddr", "saddr"]) {
      const parameter = url.searchParams.get(key);
      if (!parameter) continue;
      found = pair(decode(parameter));
      if (found) break;
    }
  }

  if (found) {
    return { ok: true, ...found, link: url.toString() };
  }

  if (isShortGoogleMapsLink(value)) {
    return {
      ok: false,
      message: "This short link hides its coordinates. Open it, then copy the full Maps URL from your browser.",
    };
  }

  if (url.hostname.includes("google.") || url.hostname === "maps.google.com") {
    return {
      ok: false,
      message: "This Maps link does not include coordinates. Open it, copy the full URL after selecting the place, or paste latitude, longitude.",
    };
  }

  return { ok: false, message: "No coordinates found. Paste a Google Maps link that contains a place pin, or enter latitude and longitude." };
}
