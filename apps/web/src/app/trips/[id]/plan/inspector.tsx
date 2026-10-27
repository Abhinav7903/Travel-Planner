"use client";

import { useState } from "react";
import { ArrowRight, Clock3, MapPin, Trash2, X } from "lucide-react";
import { browserApi, BrowserApiError } from "@/lib/client-api";
import type { EdgeMode, ItineraryEdge, ItineraryItem, ItemKind, MapResolution, TripGroup } from "@/lib/types";
import { Button, Spinner } from "@/components/ui/button";
import { FieldError, FormError, Input, Label, Select, Textarea } from "@/components/ui/input";
import { isShortGoogleMapsLink, parseGoogleMapsLink } from "@/lib/geo";
import { modeLabel, parseMoneyInput, timeLabel } from "@/lib/utils";

export type ItemDraft = {
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
};

type MapLinkResolution =
  | { ok: true; latitude: number; longitude: number; link: string }
  | { ok: false; message: string };

async function resolveMapLink(raw: string): Promise<MapLinkResolution> {
  const parsed = parseGoogleMapsLink(raw);
  if (parsed.ok || !isShortGoogleMapsLink(raw)) return parsed;
  try {
    const resolved = await browserApi<MapResolution>("/api/v1/maps/resolve", {
      method: "POST",
      body: JSON.stringify({ url: raw.trim() }),
    });
    return { ok: true, latitude: resolved.latitude, longitude: resolved.longitude, link: resolved.link };
  } catch (error) {
    if (error instanceof BrowserApiError) return { ok: false, message: error.message };
    return { ok: false, message: "This short link could not be resolved. Open it and paste the full Maps URL." };
  }
}

export type EdgeDraft = {
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
};

export function Inspector({
  item,
  edge,
  isNew,
  groups,
  currency,
  canEdit,
  itemNames,
  busy,
  onSaveItem,
  onSaveEdge,
  onDelete,
  onClose,
}: {
  item?: ItineraryItem;
  edge?: ItineraryEdge;
  isNew?: boolean;
  groups: TripGroup[];
  currency: string;
  canEdit: boolean;
  itemNames: Map<string, string>;
  busy: boolean;
  onSaveItem?: (draft: ItemDraft) => Promise<boolean>;
  onSaveEdge?: (draft: EdgeDraft) => Promise<boolean>;
  onDelete?: () => Promise<void>;
  onClose: () => void;
}) {
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});

  if (edge) {
    return (
      <EdgeForm
        key={edge.id}
        edge={edge}
        groups={groups}
        itemNames={itemNames}
        canEdit={canEdit}
        busy={busy}
        error={error}
        setError={setError}
        onSave={onSaveEdge}
        onDelete={onDelete}
        onClose={onClose}
      />
    );
  }

  if (!item) return null;

  return (
    <ItemForm
      key={`${item.id}-${isNew ? "new" : "edit"}`}
      item={item}
      isNew={Boolean(isNew)}
      groups={groups}
      currency={currency}
      canEdit={canEdit}
      busy={busy}
      onSave={async (draft) => {
        setError("");
        setFields({});
        if (!draft.title.trim()) {
          setFields({ title: "Give this stop a name." });
          return false;
        }
        if (draft.start_time && draft.end_time && draft.end_time < draft.start_time) {
          setFields({ end_time: "The end time must be after the start time." });
          return false;
        }
        const okay = await onSaveItem?.(draft);
        if (!okay) setError("This stop could not be saved. Check the details and try again.");
        return Boolean(okay);
      }}
      onDelete={onDelete}
      onClose={onClose}
      error={error}
      fields={fields}
      setFields={setFields}
      confirmDelete={confirmDelete}
      setConfirmDelete={setConfirmDelete}
    />
  );
}

function ItemForm({
  item,
  isNew,
  groups,
  currency,
  canEdit,
  busy,
  onSave,
  onDelete,
  onClose,
  error,
  fields,
  setFields,
  confirmDelete,
  setConfirmDelete,
}: {
  item: ItineraryItem;
  isNew: boolean;
  groups: TripGroup[];
  currency: string;
  canEdit: boolean;
  busy: boolean;
  onSave: (draft: ItemDraft) => Promise<boolean>;
  onDelete?: () => Promise<void>;
  onClose: () => void;
  error: string;
  fields: Record<string, string>;
  setFields: (value: Record<string, string>) => void;
  confirmDelete: boolean;
  setConfirmDelete: (value: boolean) => void;
}) {
  const [form, setForm] = useState({
    title: item.title,
    kind: item.kind,
    location_name: item.location_name,
    address: item.address,
    start_time: item.start_time,
    end_time: item.end_time,
    notes: item.notes,
    cost: item.cost_minor > 0 ? (item.cost_minor / 100).toFixed(2) : "",
    currency: item.currency || currency,
    link: item.link,
    group_id: item.group_id,
    lat: item.has_coordinates ? String(item.latitude) : "",
    lng: item.has_coordinates ? String(item.longitude) : "",
    has_coordinates: item.has_coordinates,
  });
  const [deleting, setDeleting] = useState(false);
  const [resolvingLink, setResolvingLink] = useState(false);
  const [localError, setLocalError] = useState("");
  const [linkFeedback, setLinkFeedback] = useState<{ tone: "success" | "error"; message: string } | null>(null);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setFields({ ...fields, [key]: "" });
  }

  async function applyLink() {
    const raw = form.link.trim();
    if (!raw) return;
    setResolvingLink(true);
    setLinkFeedback(null);
    try {
      const resolved = await resolveMapLink(raw);
      if (!resolved.ok) {
        setLinkFeedback({ tone: "error", message: resolved.message });
        return;
      }
      setForm((current) => ({
        ...current,
        link: resolved.link,
        lat: String(resolved.latitude),
        lng: String(resolved.longitude),
        has_coordinates: true,
      }));
      setFields({ ...fields, link: "", lat: "", lng: "", has_coordinates: "" });
      setLinkFeedback({ tone: "success", message: "Coordinates found. This stop will appear on the map." });
    } finally {
      setResolvingLink(false);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLocalError("");
    const costMinor = form.cost.trim() ? parseMoneyInput(form.cost, currency) : 0;
    if (costMinor === null) {
      setLocalError("Enter a cost like 12.50, or leave it blank.");
      return;
    }
    const latText = form.lat.trim();
    const lngText = form.lng.trim();
    const manualCoordinates = form.has_coordinates && Boolean(latText) && Boolean(lngText);
    let link = form.link.trim();
    let hasCoordinates = manualCoordinates;
    let lat = manualCoordinates ? Number(latText) : 0;
    let lng = manualCoordinates ? Number(lngText) : 0;

    if (link) {
      const parsed = parseGoogleMapsLink(link);
      if (!/^https?:\/\//i.test(link)) {
        if (!parsed.ok) {
          setLocalError(parsed.message);
          return;
        }
        link = parsed.link;
        if (!hasCoordinates) {
          lat = parsed.latitude;
          lng = parsed.longitude;
          hasCoordinates = true;
        }
      } else if (parsed.ok && !hasCoordinates) {
        lat = parsed.latitude;
        lng = parsed.longitude;
        hasCoordinates = true;
      } else if (!parsed.ok && isShortGoogleMapsLink(link) && !hasCoordinates) {
        setResolvingLink(true);
        const resolved = await resolveMapLink(link);
        setResolvingLink(false);
        if (!resolved.ok) {
          setLinkFeedback({ tone: "error", message: resolved.message });
          setLocalError(resolved.message);
          return;
        }
        link = resolved.link;
        lat = resolved.latitude;
        lng = resolved.longitude;
        hasCoordinates = true;
        setForm((current) => ({
          ...current,
          link: resolved.link,
          lat: String(resolved.latitude),
          lng: String(resolved.longitude),
          has_coordinates: true,
        }));
        setLinkFeedback({ tone: "success", message: "Coordinates found. This stop will appear on the map." });
      }
    }

    if (form.has_coordinates && !hasCoordinates) {
      setLocalError("Enter both latitude and longitude, or paste a Google Maps link.");
      return;
    }
    if (hasCoordinates && (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180)) {
      setLocalError("Enter a valid latitude and longitude.");
      return;
    }
    await onSave({
      day_id: item.day_id,
      group_id: form.group_id,
      title: form.title,
      kind: form.kind,
      location_name: form.location_name,
      address: form.address,
      latitude: lat,
      longitude: lng,
      has_coordinates: hasCoordinates,
      start_time: form.start_time,
      end_time: form.end_time,
      notes: form.notes,
      cost_minor: costMinor,
      currency: costMinor > 0 ? form.currency : "",
      link,
      pos_x: item.pos_x,
      pos_y: item.pos_y,
      sort_order: item.sort_order,
    });
  }

  return (
    <form onSubmit={submit} className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-3.5">
        <div>
          <p className="eyebrow">{isNew ? "New stop" : "Stop details"}</p>
          <h2 className="display mt-1 text-[1.3rem] leading-tight">{isNew ? "Add to the day" : item.title}</h2>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close inspector">
          <X size={16} />
        </Button>
      </div>

      <div className="scroll-thin flex-1 overflow-y-auto px-4 py-4">
        <div className="space-y-3.5">
          <FormError>{localError || error}</FormError>
          <fieldset disabled={!canEdit} className="space-y-3.5 disabled:opacity-75">
            <div>
              <Label htmlFor="item-title">Title</Label>
              <Input
                id="item-title"
                autoFocus={isNew}
                value={form.title}
                maxLength={160}
                onChange={(event) => update("title", event.target.value)}
                aria-invalid={Boolean(fields.title)}
              />
              <FieldError>{fields.title}</FieldError>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="item-kind">Kind</Label>
                <Select id="item-kind" value={form.kind} onChange={(event) => update("kind", event.target.value as ItemKind)}>
                  {Object.entries({ place: "Place", activity: "Activity", meal: "Meal", transport: "Transport", stay: "Stay", note: "Note" }).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="item-group">Group</Label>
                <Select id="item-group" value={form.group_id} onChange={(event) => update("group_id", event.target.value)}>
                  <option value="">Everyone</option>
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>{group.name}</option>
                  ))}
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="item-location">Place name</Label>
              <div className="relative">
                <MapPin size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
                <Input id="item-location" className="pl-8" value={form.location_name} maxLength={200} onChange={(event) => update("location_name", event.target.value)} />
              </div>
            </div>
            <div>
              <Label htmlFor="item-address" hint="Optional">Address</Label>
              <Input id="item-address" value={form.address} maxLength={500} onChange={(event) => update("address", event.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="item-start">Start</Label>
                <Input id="item-start" type="time" value={form.start_time} onChange={(event) => update("start_time", event.target.value)} />
              </div>
              <div>
                <Label htmlFor="item-end">End</Label>
                <Input id="item-end" type="time" value={form.end_time} onChange={(event) => update("end_time", event.target.value)} aria-invalid={Boolean(fields.end_time)} />
              </div>
            </div>
            <FieldError>{fields.end_time}</FieldError>

            <div className="rounded-xl border border-line bg-[#f9f6ef] p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[12px] font-semibold">Pin on the map</p>
                  <p className="mt-0.5 text-[10.5px] text-ink-faint">Coordinates are optional and never guessed.</p>
                </div>
                <label className="relative inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    className="peer sr-only"
                    checked={form.has_coordinates}
                    onChange={(event) => update("has_coordinates", event.target.checked)}
                  />
                  <span className="h-5 w-9 rounded-full bg-[#d9d4c7] transition-colors peer-checked:bg-forest peer-focus-visible:ring-2 peer-focus-visible:ring-forest/40" />
                  <span className="absolute left-0.5 h-4 w-4 rounded-full bg-paper transition-transform peer-checked:translate-x-4" />
                </label>
              </div>
              <div className="mt-3">
                <Label htmlFor="item-map-link" hint="Optional">Google Maps link</Label>
                <div className="flex gap-2">
                  <Input
                    id="item-map-link"
                    type="text"
                    inputMode="url"
                    placeholder="Paste a Maps link or 35.0116, 135.7681"
                    value={form.link}
                    onChange={(event) => {
                      update("link", event.target.value);
                      setLinkFeedback(null);
                    }}
                    disabled={resolvingLink}
                    aria-describedby="item-map-link-help"
                    className="min-w-0"
                  />
                  <Button type="button" variant="secondary" size="sm" className="h-10" onClick={applyLink} disabled={!form.link.trim() || resolvingLink}>
                    {resolvingLink ? <Spinner /> : null}
                    {resolvingLink ? "Resolving" : "Use link"}
                  </Button>
                </div>
                <p id="item-map-link-help" className="mt-1.5 text-[10.5px] leading-relaxed text-ink-faint">
                  Paste a full Maps URL, a short link, or latitude, longitude. Short links are resolved securely; coordinates are never guessed.
                </p>
                {linkFeedback ? (
                  <p role="status" aria-live="polite" className={linkFeedback.tone === "error" ? "mt-1 text-[10.5px] text-[#9a4a2b]" : "mt-1 text-[10.5px] text-forest"}>
                    {linkFeedback.message}
                  </p>
                ) : null}
              </div>
              {form.has_coordinates ? (
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="item-lat">Latitude</Label>
                    <Input id="item-lat" inputMode="decimal" placeholder="35.0116" value={form.lat} onChange={(event) => update("lat", event.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="item-lng">Longitude</Label>
                    <Input id="item-lng" inputMode="decimal" placeholder="135.7681" value={form.lng} onChange={(event) => update("lng", event.target.value)} />
                  </div>
                </div>
              ) : null}
            </div>

            <div className="grid grid-cols-[1fr_92px] gap-3">
              <div>
                <Label htmlFor="item-cost" hint="Optional">Cost</Label>
                <Input id="item-cost" inputMode="decimal" placeholder="0.00" value={form.cost} onChange={(event) => update("cost", event.target.value)} />
              </div>
              <div>
                <Label htmlFor="item-currency">Currency</Label>
                <Select id="item-currency" value={form.currency} onChange={(event) => update("currency", event.target.value)} disabled={!form.cost}>
                  {["USD", "EUR", "GBP", "JPY", "INR", "AUD", "CAD", "CHF", "SGD", "KRW", "THB", "AED", "NZD"].map((code) => (
                    <option key={code} value={code}>{code}</option>
                  ))}
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="item-notes" hint="Optional">Notes</Label>
              <Textarea id="item-notes" rows={3} maxLength={4000} value={form.notes} onChange={(event) => update("notes", event.target.value)} />
            </div>
          </fieldset>
        </div>
      </div>

      <div className="border-t border-line px-4 py-3">
        {canEdit ? (
          <div className="flex items-center gap-2">
            {!isNew && onDelete ? (
              <Button
                variant={confirmDelete ? "danger" : "ghost"}
                size="sm"
                onClick={async () => {
                  if (!confirmDelete) {
                    setConfirmDelete(true);
                    return;
                  }
                  setDeleting(true);
                  try {
                    await onDelete();
                  } finally {
                    setDeleting(false);
                  }
                }}
                disabled={busy || deleting}
              >
                {deleting ? <Spinner /> : <Trash2 size={13} />}
                {confirmDelete ? "Confirm delete" : "Delete"}
              </Button>
            ) : null}
            <Button type="submit" size="sm" className="ml-auto" disabled={busy || deleting || resolvingLink}>
              {busy || resolvingLink ? <Spinner /> : null}
              {resolvingLink ? "Resolving link" : isNew ? "Add stop" : "Save changes"}
            </Button>
          </div>
        ) : (
          <p className="text-[11px] text-ink-faint">You have view-only access to this trip.</p>
        )}
      </div>
    </form>
  );
}

function EdgeForm({
  edge,
  groups,
  itemNames,
  canEdit,
  busy,
  error,
  setError,
  onSave,
  onDelete,
  onClose,
}: {
  edge: ItineraryEdge;
  groups: TripGroup[];
  itemNames: Map<string, string>;
  canEdit: boolean;
  busy: boolean;
  error: string;
  setError: (value: string) => void;
  onSave?: (draft: EdgeDraft) => Promise<boolean>;
  onDelete?: () => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    mode: edge.mode,
    duration: edge.duration_minutes ? String(edge.duration_minutes) : "",
    distance: edge.distance_km ? String(edge.distance_km) : "",
    depart_time: edge.depart_time,
    arrive_time: edge.arrive_time,
    notes: edge.notes,
    group_id: edge.group_id,
  });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [localError, setLocalError] = useState("");
  const from = itemNames.get(edge.from_item_id) ?? "Stop";
  const to = itemNames.get(edge.to_item_id) ?? "Stop";

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setError("");
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLocalError("");
    const duration = form.duration.trim() === "" ? 0 : Number(form.duration);
    const distance = form.distance.trim() === "" ? 0 : Number(form.distance);
    if (!Number.isInteger(duration) || duration < 0) {
      setLocalError("Duration must be a whole number of minutes, or left open.");
      return;
    }
    if (!Number.isFinite(distance) || distance < 0) {
      setLocalError("Distance must be a positive number, or left open.");
      return;
    }
    if (form.depart_time && form.arrive_time && form.arrive_time < form.depart_time) {
      setLocalError("Arrival must come after departure.");
      return;
    }
    await onSave?.({
      day_id: edge.day_id,
      group_id: form.group_id,
      from_item_id: edge.from_item_id,
      to_item_id: edge.to_item_id,
      mode: form.mode,
      duration_minutes: duration,
      distance_km: distance,
      depart_time: form.depart_time,
      arrive_time: form.arrive_time,
      notes: form.notes,
    });
  }

  return (
    <form onSubmit={submit} className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-3.5">
        <div>
          <p className="eyebrow">Travel leg</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[13px] font-semibold">
            <span className="max-w-[105px] truncate">{from}</span>
            <ArrowRight size={12} className="text-ink-faint" />
            <span className="max-w-[105px] truncate">{to}</span>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close inspector">
          <X size={16} />
        </Button>
      </div>
      <div className="scroll-thin flex-1 space-y-3.5 overflow-y-auto px-4 py-4">
        <FormError>{localError || error}</FormError>
        <fieldset disabled={!canEdit} className="space-y-3.5 disabled:opacity-75">
          <div>
            <Label htmlFor="edge-mode">Mode</Label>
            <Select id="edge-mode" value={form.mode} onChange={(event) => update("mode", event.target.value as EdgeMode)}>
              {Object.entries(modeLabel).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="edge-duration" hint="Leave blank if unknown">
              Duration (minutes)
            </Label>
            <div className="relative">
              <Clock3 size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
              <Input id="edge-duration" inputMode="numeric" className="pl-8" placeholder="Unknown" value={form.duration} onChange={(event) => update("duration", event.target.value.replace(/[^\d]/g, ""))} />
            </div>
            <p className="mt-1 text-[10.5px] text-ink-faint">Wayfarer never invents travel times. Unknown stays openly unknown.</p>
          </div>
          <div>
            <Label htmlFor="edge-distance" hint="Optional, km">Distance</Label>
            <Input id="edge-distance" inputMode="decimal" placeholder="—" value={form.distance} onChange={(event) => update("distance", event.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="edge-depart">Depart</Label>
              <Input id="edge-depart" type="time" value={form.depart_time} onChange={(event) => update("depart_time", event.target.value)} />
            </div>
            <div>
              <Label htmlFor="edge-arrive">Arrive</Label>
              <Input id="edge-arrive" type="time" value={form.arrive_time} onChange={(event) => update("arrive_time", event.target.value)} />
            </div>
          </div>
          <div>
            <Label htmlFor="edge-group">Group</Label>
            <Select id="edge-group" value={form.group_id} onChange={(event) => update("group_id", event.target.value)}>
              <option value="">Everyone</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>{group.name}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="edge-notes" hint="Optional">Notes</Label>
            <Textarea id="edge-notes" rows={3} maxLength={2000} value={form.notes} onChange={(event) => update("notes", event.target.value)} placeholder="Platform 4, buy tickets the day before." />
          </div>
        </fieldset>
        <p className="rounded-lg bg-[#f5f1e7] px-2.5 py-2 text-[10.5px] text-ink-soft">
          {form.duration ? `${timeLabel(form.depart_time) || "Departure open"} · ${form.duration} min` : "Travel time not set"}
        </p>
      </div>
      <div className="border-t border-line px-4 py-3">
        {canEdit ? (
          <div className="flex items-center gap-2">
            {onDelete ? (
              <Button
                variant={confirmDelete ? "danger" : "ghost"}
                size="sm"
                onClick={async () => {
                  if (!confirmDelete) {
                    setConfirmDelete(true);
                    return;
                  }
                  await onDelete();
                }}
                disabled={busy}
              >
                <Trash2 size={13} /> {confirmDelete ? "Confirm" : "Delete leg"}
              </Button>
            ) : null}
            <Button type="submit" size="sm" className="ml-auto" disabled={busy}>
              {busy ? <Spinner /> : null} Save leg
            </Button>
          </div>
        ) : (
          <p className="text-[11px] text-ink-faint">View-only access.</p>
        )}
      </div>
    </form>
  );
}
