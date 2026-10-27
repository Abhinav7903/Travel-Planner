"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Check, Info, ShieldCheck } from "lucide-react";
import type { Trip } from "@/lib/types";
import { browserApi } from "@/lib/client-api";
import { errorMessage, formatDateRange } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { CoverImage } from "@/components/cover-image";
import { Button, Spinner } from "@/components/ui/button";
import { FieldError, FormError, Input, Label, Select, Textarea } from "@/components/ui/input";

const zones = [
  "UTC",
  "Europe/London",
  "Europe/Paris",
  "Europe/Lisbon",
  "Europe/Istanbul",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Mexico_City",
  "America/Sao_Paulo",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Bangkok",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Australia/Sydney",
  "Pacific/Auckland",
];

const currencies = ["USD", "EUR", "GBP", "JPY", "INR", "AUD", "CAD", "CHF", "SEK", "NOK", "DKK", "SGD", "HKD", "NZD", "KRW", "THB", "AED", "BRL", "MXN", "ZAR"];

export function TripSettings({ trip, canManage }: { trip: Trip; canManage: boolean }) {
  const router = useRouter();
  const [form, setForm] = useState({
    title: trip.title,
    destination: trip.destination,
    start_date: trip.start_date,
    end_date: trip.end_date,
    timezone: trip.timezone,
    currency: trip.currency,
    description: trip.description,
    cover_image_url: trip.cover_image_url,
    status: trip.status,
  });
  const [version, setVersion] = useState(trip.version);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setFields((current) => ({ ...current, [key]: "" }));
    setSaved(false);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!canManage || busy) return;
    const local: Record<string, string> = {};
    if (!form.title.trim()) local.title = "Give the trip a title.";
    if (!form.destination.trim()) local.destination = "Where are you going?";
    if (!form.start_date) local.start_date = "Choose a start date.";
    if (!form.end_date) local.end_date = "Choose an end date.";
    if (form.start_date && form.end_date && form.end_date < form.start_date) local.end_date = "End date must be after the start.";
    setFields(local);
    if (Object.keys(local).length) return;

    setBusy(true);
    setError("");
    try {
      const updated = await browserApi<Trip>(`/api/v1/trips/${trip.id}/`, {
        method: "PATCH",
        body: JSON.stringify({ ...form, title: form.title.trim(), destination: form.destination.trim(), version }),
      });
      setVersion(updated.version);
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function setArchived(archived: boolean) {
    if (!canManage || busy) return;
    if (archived && !window.confirm("Archive this trip? It stays readable and can be restored later.")) return;
    setBusy(true);
    setError("");
    try {
      const updated = await browserApi<Trip>(`/api/v1/trips/${trip.id}/`, {
        method: "PATCH",
        body: JSON.stringify({ ...form, status: archived ? "archived" : "active", version }),
      });
      setVersion(updated.version);
      setForm((current) => ({ ...current, status: updated.status }));
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 py-7 sm:px-6 lg:px-8">
      <div>
        <p className="eyebrow">Trip settings</p>
        <h2 className="display mt-1.5 text-[2rem] leading-none">The shape of the journey.</h2>
        <p className="mt-2 text-[13px] text-ink-soft">
          {formatDateRange(trip.start_date, trip.end_date)} · {trip.timezone} · {trip.currency}
        </p>
      </div>

      {!canManage ? (
        <div className="mt-6 flex items-start gap-2.5 rounded-2xl border border-line bg-paper px-4 py-3.5 text-[12px] leading-relaxed text-ink-soft">
          <ShieldCheck size={15} className="mt-0.5 shrink-0 text-forest" />
          Only the trip owner can change dates, destination, timezone, currency, or archive the trip. You can still read everything.
        </div>
      ) : null}

      <div className="mt-6 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <form onSubmit={save} className="rounded-2xl border border-line bg-paper p-5 sm:p-6">
          {error ? <div className="mb-5"><FormError>{error}</FormError></div> : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="settings-title">Title</Label>
              <Input id="settings-title" value={form.title} disabled={!canManage} onChange={(event) => update("title", event.target.value)} />
              <FieldError>{fields.title}</FieldError>
            </div>
            <div>
              <Label htmlFor="settings-destination">Destination</Label>
              <Input id="settings-destination" value={form.destination} disabled={!canManage} onChange={(event) => update("destination", event.target.value)} />
              <FieldError>{fields.destination}</FieldError>
            </div>
            <div>
              <Label htmlFor="settings-currency">Currency</Label>
              <Select id="settings-currency" value={form.currency} disabled={!canManage} onChange={(event) => update("currency", event.target.value)}>
                {!currencies.includes(form.currency) ? <option value={form.currency}>{form.currency}</option> : null}
                {currencies.map((currency) => <option key={currency} value={currency}>{currency}</option>)}
              </Select>
            </div>
            <div>
              <Label htmlFor="settings-start">Start date</Label>
              <Input id="settings-start" type="date" value={form.start_date} disabled={!canManage} onChange={(event) => update("start_date", event.target.value)} />
              <FieldError>{fields.start_date}</FieldError>
            </div>
            <div>
              <Label htmlFor="settings-end">End date</Label>
              <Input id="settings-end" type="date" value={form.end_date} disabled={!canManage} onChange={(event) => update("end_date", event.target.value)} />
              <FieldError>{fields.end_date}</FieldError>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="settings-timezone" hint="IANA timezone">Trip timezone</Label>
              <Select id="settings-timezone" value={form.timezone} disabled={!canManage} onChange={(event) => update("timezone", event.target.value)}>
                {!zones.includes(form.timezone) ? <option value={form.timezone}>{form.timezone}</option> : null}
                {zones.map((zone) => <option key={zone} value={zone}>{zone}</option>)}
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="settings-description">Description <span className="font-normal text-ink-faint">optional</span></Label>
              <Textarea id="settings-description" rows={4} value={form.description} disabled={!canManage} onChange={(event) => update("description", event.target.value)} placeholder="What kind of journey is this?" />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="settings-cover">Cover image URL <span className="font-normal text-ink-faint">optional</span></Label>
              <Input id="settings-cover" type="url" value={form.cover_image_url} disabled={!canManage} onChange={(event) => update("cover_image_url", event.target.value)} placeholder="https://…" />
              <p className="mt-1.5 text-[10.5px] leading-relaxed text-ink-faint">
                Use a direct image URL (ending in .jpg, .png or .webp), not a search or gallery page.
              </p>
              {form.cover_image_url ? (
                <div className="mt-2 h-24 overflow-hidden rounded-xl border border-line bg-[#e9e7db]">
                  <CoverImage
                    src={form.cover_image_url}
                    alt="Cover preview"
                    className="h-full w-full object-cover"
                    fallback={
                      <div className="flex h-full items-center justify-center px-3 text-center text-[11px] text-ink-faint">
                        Preview unavailable. Use a direct image URL.
                      </div>
                    }
                  />
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
            <p className="flex items-center gap-1.5 text-[11px] text-ink-faint">
              <Info size={11} /> Changing trip dates adds or removes empty days, never deletes items.
            </p>
            {canManage ? (
              <div className="flex items-center gap-2">
                {saved ? <span className="flex items-center gap-1 text-[11.5px] text-forest"><Check size={12} /> Saved</span> : null}
                <Button type="submit" disabled={busy}>{busy ? <Spinner /> : <Check size={14} />} Save changes</Button>
              </div>
            ) : null}
          </div>
        </form>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-line bg-paper p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-[13px] font-semibold">Trip status</h3>
                <p className="mt-0.5 text-[11px] text-ink-faint">Archived trips stay readable.</p>
              </div>
              <Badge tone={form.status === "archived" ? "sand" : "forest"}>{form.status}</Badge>
            </div>
            {canManage ? (
              <Button
                variant="secondary"
                className="mt-3 w-full"
                disabled={busy}
                onClick={() => void setArchived(form.status !== "archived")}
              >
                {form.status === "archived" ? <ArchiveRestore size={14} /> : <Archive size={14} />}
                {form.status === "archived" ? "Restore trip" : "Archive trip"}
              </Button>
            ) : null}
          </div>
          <div className="rounded-2xl border border-line bg-[#fbf8f1] p-4">
            <h3 className="text-[12px] font-semibold">A note on time</h3>
            <p className="mt-1.5 text-[11px] leading-relaxed text-ink-soft">
              Day dates and local times belong to the trip timezone. Instants such as invitations and sessions are stored in UTC.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
