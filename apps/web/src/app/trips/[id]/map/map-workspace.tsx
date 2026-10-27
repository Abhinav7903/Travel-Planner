"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import type {
  LayerGroup as LeafletLayerGroup,
  Map as LeafletMap,
  Marker as LeafletMarker,
  TileLayer as LeafletTileLayer,
} from "leaflet";
import Link from "next/link";
import { AlertTriangle, CalendarDays, MapPin, Navigation, Route } from "lucide-react";
import type { ItineraryDay, ItineraryItem, Member, Trip, TripGroup } from "@/lib/types";
import { cn, formatDay, kindLabel, modeLabel, timeLabel } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

const modeColor: Record<string, string> = {
  walk: "#1f5a46",
  transit: "#2f5f8f",
  train: "#5b4a8a",
  bus: "#5e6f3a",
  bike: "#a8672e",
  car: "#7a5c3e",
  flight: "#4f6d9e",
  ferry: "#2f7f93",
  other: "#64675e",
};

export function MapWorkspace({
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
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<Map<string, LeafletMarker>>(new Map());
  const edgeLayerRef = useRef<LeafletLayerGroup | null>(null);
  const tileLayersRef = useRef<{ street: LeafletTileLayer; satellite: LeafletTileLayer } | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [basemap, setBasemap] = useState<"street" | "satellite">("street");
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState<string | null>(null);

  const groupByID = useMemo(() => new Map(groups.map((group) => [group.id, group])), [groups]);
  const located = useMemo(() => {
    return days.flatMap((day, index) =>
      day.items
        .filter((item) => item.has_coordinates)
        .map((item) => ({ item, day, dayNumber: index + 1 })),
    );
  }, [days]);

  const visible = useMemo(
    () => (filter === "all" ? located : located.filter((entry) => entry.day.id === filter)),
    [located, filter],
  );

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const markers = markersRef.current;
    let cancelled = false;
    let map: LeafletMap | undefined;

    void (async () => {
      try {
        const L = await import("leaflet");
        if (cancelled || !containerRef.current) return;
        map = L.map(containerRef.current, { center: [48.86, 2.35], zoom: 2.2, zoomControl: true });
        edgeLayerRef.current = L.layerGroup().addTo(map);
        const street = L.tileLayer("https://tile.openstreetmap.de/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }).addTo(map);
        const satellite = L.tileLayer(
          "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
          {
            maxZoom: 19,
            attribution:
              'Imagery &copy; <a href="https://www.esri.com/">Esri</a>, Maxar, Earthstar Geographics, and the GIS User Community',
          },
        );
        street.on("tileerror", () => setFailed(true));
        satellite.on("tileerror", () => setFailed(true));
        tileLayersRef.current = { street, satellite };
        map.whenReady(() => {
          if (!cancelled) setLoaded(true);
        });
        mapRef.current = map;
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      for (const marker of markers.values()) marker.remove();
      markers.clear();
      map?.remove();
      mapRef.current = null;
      edgeLayerRef.current = null;
      tileLayersRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layers = tileLayersRef.current;
    if (!map || !layers) return;
    const active = basemap === "satellite" ? layers.satellite : layers.street;
    const inactive = basemap === "satellite" ? layers.street : layers.satellite;
    if (map.hasLayer(inactive)) map.removeLayer(inactive);
    if (!map.hasLayer(active)) active.addTo(map);
  }, [basemap, loaded]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;
    let cancelled = false;

    void (async () => {
      const L = await import("leaflet");
      if (cancelled || !mapRef.current) return;
      for (const marker of markersRef.current.values()) marker.remove();
      markersRef.current.clear();

      for (const entry of visible) {
        const group = groupByID.get(entry.item.group_id);
        const color = group?.color ?? "#1f4d3d";
        const element = document.createElement("button");
        element.type = "button";
        element.className = "group relative flex h-7 w-7 items-center justify-center rounded-full border-2 border-paper text-[10px] font-semibold text-white shadow-[0_2px_10px_rgba(37,39,33,.28)] transition-transform hover:scale-110 focus-visible:scale-110";
        element.style.background = color;
        element.textContent = String(entry.dayNumber);
        element.setAttribute("aria-label", `${entry.item.title}, day ${entry.dayNumber}, ${timeLabel(entry.item.start_time)}`);

        const marker = L.marker([entry.item.latitude, entry.item.longitude], {
          icon: L.divIcon({ html: element, className: "", iconSize: [28, 28], iconAnchor: [14, 14] }),
          title: entry.item.title,
          riseOnHover: true,
        })
          .bindPopup(popupContent(entry.item, entry.day, entry.dayNumber), {
            offset: [0, -14],
            maxWidth: 260,
            closeButton: true,
          })
          .addTo(map);
        markersRef.current.set(entry.item.id, marker);
      }

      if (visible.length === 1 && visible[0]) {
        map.flyTo([visible[0].item.latitude, visible[0].item.longitude], 13, { duration: 0.55 });
      } else if (visible.length > 1) {
        const bounds = L.latLngBounds(
          visible.map((entry) => [entry.item.latitude, entry.item.longitude] as [number, number]),
        );
        map.fitBounds(bounds, { padding: [70, 70], maxZoom: 13 });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [visible, groupByID, loaded]);

  useEffect(() => {
    const map = mapRef.current;
    const layer = edgeLayerRef.current;
    if (!map || !layer || !loaded) return;
    let cancelled = false;

    void (async () => {
      const L = await import("leaflet");
      if (cancelled || !mapRef.current) return;
      layer.clearLayers();

      const itemByID = new Map(located.map((entry) => [entry.item.id, entry.item]));
      const edges = days.flatMap((day) => (filter === "all" || day.id === filter ? day.edges : []));

      for (const edge of edges) {
        const from = itemByID.get(edge.from_item_id);
        const to = itemByID.get(edge.to_item_id);
        if (!from || !to) continue;

        const group = groupByID.get(edge.group_id);
        const color = group?.color ?? modeColor[edge.mode] ?? "#1f4d3d";
        const duration = edge.duration_minutes > 0 ? `${edge.duration_minutes} min` : "time open";
        const distance = edge.distance_km > 0 ? ` · ${edge.distance_km.toFixed(1)} km` : "";
        const label = document.createElement("span");
        label.textContent = `${from.title} → ${to.title} · ${modeLabel[edge.mode] ?? edge.mode} · ${duration}${distance}`;

        L.polyline(
          [
            [from.latitude, from.longitude],
            [to.latitude, to.longitude],
          ],
          {
            color,
            weight: 3,
            opacity: 0.82,
            dashArray: edge.duration_minutes > 0 ? undefined : "6 7",
            lineCap: "round",
          },
        )
          .bindTooltip(label, { sticky: true })
          .addTo(layer);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [days, filter, groupByID, loaded, located]);

  async function focusItem(item: ItineraryItem, dayNumber: number) {
    const map = mapRef.current;
    setSelected(item.id);
    if (!map) return;
    const entry = markersRef.current.get(item.id);
    if (entry) {
      map.flyTo([item.latitude, item.longitude], Math.max(map.getZoom(), 12), { duration: 0.5 });
      entry.openPopup();
      return;
    }
    const L = await import("leaflet");
    if (!mapRef.current) return;
    const popup = L.popup({ offset: [0, -12], maxWidth: 260, closeButton: true })
      .setLatLng([item.latitude, item.longitude])
      .setContent(popupContent(item, days.find((day) => day.items.some((candidate) => candidate.id === item.id)) ?? days[0]!, dayNumber))
      .openOn(map);
    popup.on("remove", () => setSelected(null));
  }

  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="eyebrow">The map</p>
          <h2 className="display mt-1.5 text-[1.9rem] leading-none">Places, in context.</h2>
          <p className="mt-2 text-[12.5px] text-ink-soft">
            Only stops with saved coordinates appear. Lines follow the itinerary graph and are schematic, not road directions.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-full border border-line-strong bg-paper p-0.5" role="group" aria-label="Basemap">
            <button
              type="button"
              onClick={() => {
                setFailed(false);
                setBasemap("street");
              }}
              aria-pressed={basemap === "street"}
              className={cn(
                "rounded-full px-2.5 py-1 text-[10.5px] font-medium transition-colors",
                basemap === "street" ? "bg-forest text-paper" : "text-ink-soft hover:text-ink",
              )}
            >
              Map
            </button>
            <button
              type="button"
              onClick={() => {
                setFailed(false);
                setBasemap("satellite");
              }}
              aria-pressed={basemap === "satellite"}
              className={cn(
                "rounded-full px-2.5 py-1 text-[10.5px] font-medium transition-colors",
                basemap === "satellite" ? "bg-forest text-paper" : "text-ink-soft hover:text-ink",
              )}
            >
              Satellite
            </button>
          </div>
          <Badge tone="outline"><MapPin size={10} /> {located.length} located</Badge>
          <Badge tone={located.length === days.reduce((sum, day) => sum + day.items.length, 0) ? "forest" : "clay"}>
            {days.reduce((sum, day) => sum + day.items.length, 0) - located.length} without a pin
          </Badge>
        </div>
      </div>

      <div className="mt-5 scroll-thin flex gap-1.5 overflow-x-auto pb-1">
        <FilterPill active={filter === "all"} onClick={() => setFilter("all")}>All days</FilterPill>
        {days.map((day, index) => (
          <FilterPill key={day.id} active={filter === day.id} onClick={() => setFilter(day.id)}>
            Day {index + 1} · {formatDay(day.date, "EEE d")}
          </FilterPill>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_330px]">
        <div className="relative h-[420px] overflow-hidden rounded-2xl border border-line bg-[#e9e7db] sm:h-[calc(100dvh_-_320px)] sm:max-h-[580px] sm:min-h-[420px]">
          <div ref={containerRef} className="absolute inset-0" aria-label="Trip map" />
          {!loaded && !failed ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[#e9e7db]">
              <div className="rounded-xl border border-line bg-paper px-4 py-3 text-[12px] text-ink-soft shadow-sm">Preparing the map…</div>
            </div>
          ) : null}
          {failed ? (
            <div className="absolute inset-x-4 bottom-4 z-10 flex items-start gap-3 rounded-xl border border-[#dfc4b7] bg-[#fbf3ef] px-4 py-3 text-[11.5px] leading-relaxed text-[#8f4529] shadow-lg">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">Map tiles are unavailable.</p>
                <p className="mt-0.5">The plan is unaffected. Use the itinerary list, timeline or graph while the map is offline.</p>
              </div>
            </div>
          ) : null}
          <div className="pointer-events-none absolute left-3 top-3 z-10 rounded-lg border border-line bg-paper/90 px-2.5 py-1.5 text-[10px] text-ink-soft backdrop-blur">
            <span className="font-semibold text-ink">{trip.destination}</span> · {basemap === "satellite" ? "Imagery © Esri, Maxar" : "Map tiles © OpenStreetMap"}
          </div>
        </div>

        <aside className="overflow-hidden rounded-2xl border border-line bg-paper">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="text-[12px] font-semibold">Located stops</p>
            <span className="text-[10.5px] text-ink-faint">{visible.length}</span>
          </div>
          <div className="scroll-thin max-h-[520px] overflow-y-auto">
            {visible.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <MapPin size={18} className="mx-auto text-ink-faint" />
                <p className="mt-3 text-[12.5px] font-medium">No pins in this view</p>
                <p className="mt-1 text-[11px] leading-relaxed text-ink-faint">
                  Open a stop in the itinerary and paste a Google Maps link or coordinates to place it here.
                </p>
                <Link href={`/trips/${trip.id}/plan`} className="mt-3 inline-flex items-center gap-1 text-[11.5px] font-medium text-forest">
                  Go to itinerary <Route size={12} />
                </Link>
              </div>
            ) : (
              visible.map((entry) => {
                const group = groupByID.get(entry.item.group_id);
                return (
                  <div key={entry.item.id} className="border-b border-line last:border-b-0">
                    <button
                      type="button"
                      onClick={() => focusItem(entry.item, entry.dayNumber)}
                      className={cn(
                        "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-[#f7f3ea]",
                        selected === entry.item.id && "bg-forest-soft/50",
                      )}
                    >
                      <span
                        className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold text-white"
                        style={{ background: group?.color ?? "#1f4d3d" }}
                      >
                        {entry.dayNumber}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12.5px] font-medium">{entry.item.title}</span>
                        <span className="mt-0.5 block truncate text-[10.5px] text-ink-soft">
                          {entry.item.location_name || kindLabel[entry.item.kind]}
                        </span>
                        <span className="mt-1 flex items-center gap-1.5 text-[9.5px] text-ink-faint">
                          <CalendarDays size={9} /> {formatDay(entry.day.date, "MMM d")}
                          {entry.item.start_time ? ` · ${timeLabel(entry.item.start_time)}` : ""}
                        </span>
                      </span>
                      <Navigation size={12} className="mt-1.5 shrink-0 text-ink-faint" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
          <div className="border-t border-line bg-[#f9f6ef] px-4 py-2.5 text-[9.5px] leading-relaxed text-ink-faint">
            {members.length} {members.length === 1 ? "traveller" : "travellers"} · Map provider is replaceable; the graph and schedule work without it.
          </div>
        </aside>
      </div>
    </div>
  );
}

function FilterPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors",
        active ? "border-forest bg-forest text-paper" : "border-line-strong bg-paper text-ink-soft hover:border-ink-faint",
      )}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}

function popupContent(item: ItineraryItem, day: ItineraryDay, dayNumber: number): HTMLElement {
  const root = document.createElement("div");
  const kicker = document.createElement("p");
  kicker.style.cssText = "font-size:9px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#92958a;margin:0";
  kicker.textContent = `Day ${dayNumber} · ${kindLabel[item.kind] ?? "Stop"}`;
  const title = document.createElement("p");
  title.style.cssText = "font-size:13px;font-weight:600;margin:4px 0 0;color:#252721";
  title.textContent = item.title;
  const meta = document.createElement("p");
  meta.style.cssText = "font-size:10px;margin:4px 0 0;color:#64675e;line-height:1.5";
  meta.textContent = [item.location_name, formatDay(day.date, "MMM d"), timeLabel(item.start_time)].filter(Boolean).join(" · ");
  const mapLink = document.createElement("a");
  mapLink.href = /^https?:\/\//i.test(item.link) ? item.link : `https://www.google.com/maps?q=${item.latitude},${item.longitude}`;
  mapLink.target = "_blank";
  mapLink.rel = "noopener noreferrer";
  mapLink.textContent = "Open in Google Maps";
  mapLink.style.cssText = "display:inline-block;margin-top:7px;font-size:10px;font-weight:600;color:#1f5a46;text-decoration:none";
  root.append(kicker, title, meta, mapLink);
  return root;
}
