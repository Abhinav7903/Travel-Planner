"use client";

import { ExternalLink, Navigation } from "lucide-react";
import { cn } from "@/lib/utils";

type NavigationLinksProps = {
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
  locationName?: string | null;
  className?: string;
  size?: "sm" | "default";
};

export function getNavigationUrls({
  latitude,
  longitude,
  address,
  locationName,
}: {
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
  locationName?: string | null;
}) {
  const hasCoords =
    latitude !== null &&
    latitude !== undefined &&
    longitude !== null &&
    longitude !== undefined &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    (latitude !== 0 || longitude !== 0);

  const query = hasCoords
    ? `${latitude},${longitude}`
    : encodeURIComponent((address || locationName || "").trim());

  if (!hasCoords && !query) return null;

  return {
    google: hasCoords
      ? `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`
      : `https://www.google.com/maps/dir/?api=1&destination=${query}`,
    apple: hasCoords
      ? `https://maps.apple.com/?daddr=${latitude},${longitude}`
      : `https://maps.apple.com/?daddr=${query}`,
    osm: hasCoords
      ? `https://www.openstreetmap.org/directions?to=${latitude}%2C${longitude}`
      : `https://www.openstreetmap.org/search?query=${query}`,
  };
}

export function NavigationLinks({
  latitude,
  longitude,
  address,
  locationName,
  className,
  size = "default",
}: NavigationLinksProps) {
  const urls = getNavigationUrls({ latitude, longitude, address, locationName });
  if (!urls) return null;

  const isSmall = size === "sm";

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      <span className={cn("flex items-center gap-1 font-medium text-ink-faint", isSmall ? "text-[10px]" : "text-[11px]")}>
        <Navigation size={isSmall ? 10 : 12} className="text-forest" /> Navigate:
      </span>
      <a
        href={urls.google}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "inline-flex items-center gap-1 rounded-md border border-line bg-paper font-medium text-ink-soft transition-colors hover:border-line-strong hover:bg-[#f2ece0] hover:text-ink",
          isSmall ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-[11px]",
        )}
      >
        Google Maps
        <ExternalLink size={isSmall ? 8 : 10} className="text-ink-faint" />
      </a>
      <a
        href={urls.apple}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "inline-flex items-center gap-1 rounded-md border border-line bg-paper font-medium text-ink-soft transition-colors hover:border-line-strong hover:bg-[#f2ece0] hover:text-ink",
          isSmall ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-[11px]",
        )}
      >
        Apple Maps
        <ExternalLink size={isSmall ? 8 : 10} className="text-ink-faint" />
      </a>
      <a
        href={urls.osm}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "inline-flex items-center gap-1 rounded-md border border-line bg-paper font-medium text-ink-soft transition-colors hover:border-line-strong hover:bg-[#f2ece0] hover:text-ink",
          isSmall ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-[11px]",
        )}
      >
        OSM
        <ExternalLink size={isSmall ? 8 : 10} className="text-ink-faint" />
      </a>
    </div>
  );
}
