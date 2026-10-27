"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { addDays, format } from "date-fns";
import { ArrowRight, Plus } from "lucide-react";
import { browserApi, BrowserApiError } from "@/lib/client-api";
import type { Trip } from "@/lib/types";
import { Button, Spinner } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FieldError, FormError, Input, Label, Select, Textarea } from "@/components/ui/input";

const currencies = ["USD", "EUR", "GBP", "JPY", "INR", "AUD", "CAD", "CHF", "SGD", "KRW", "THB", "AED", "NZD", "SEK", "NOK", "DKK", "BRL", "MXN", "ZAR"];

function timezoneOptions(): string[] {
  let zones: string[] = [];
  try {
    const supported = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf?.("timeZone");
    if (supported?.length) zones = supported;
  } catch {
    zones = [];
  }
  const local = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const common = ["UTC", "Europe/London", "Europe/Paris", "Europe/Lisbon", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "America/Sao_Paulo", "Asia/Tokyo", "Asia/Seoul", "Asia/Singapore", "Asia/Bangkok", "Asia/Kolkata", "Asia/Dubai", "Australia/Sydney", "Pacific/Auckland"];
  return Array.from(new Set([local, ...common, ...zones].filter(Boolean)));
}

export function CreateTripButton({ label = "New trip" }: { label?: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [form, setForm] = useState(() => {
    const start = format(addDays(new Date(), 14), "yyyy-MM-dd");
    return {
      title: "",
      destination: "",
      start_date: start,
      end_date: format(addDays(new Date(), 19), "yyyy-MM-dd"),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      currency: "USD",
      description: "",
      cover_image_url: "",
    };
  });
  const zones = useMemo(timezoneOptions, []);

  function update(key: keyof typeof form, value: string) {
    setForm((current) => {
      const next = { ...current, [key]: value };
      if (key === "start_date" && next.end_date < value) {
        next.end_date = value;
      }
      return next;
    });
    setFields((current) => ({ ...current, [key]: "" }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setFields({});
    if (!form.title.trim()) {
      setFields({ title: "Give the trip a name." });
      return;
    }
    if (!form.destination.trim()) {
      setFields({ destination: "Where are you going?" });
      return;
    }
    setBusy(true);
    try {
      const trip = await browserApi<Trip>("/api/v1/trips", {
        method: "POST",
        body: JSON.stringify({ ...form, status: "active" }),
      });
      router.push(`/trips/${trip.id}/plan`);
      router.refresh();
    } catch (err) {
      if (err instanceof BrowserApiError) {
        setError(err.message);
        setFields(err.fields ?? {});
      } else {
        setError("The trip could not be created. Please try again.");
      }
      setBusy(false);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} size="lg" className="reveal">
        <Plus size={16} /> {label}
      </Button>
      <Dialog open={open} onClose={() => !busy && setOpen(false)} title="A new trip" description="Start with the essentials. Everything can change later." wide>
        <form onSubmit={submit} noValidate className="space-y-4">
          <FormError>{error}</FormError>
          <div>
            <Label htmlFor="trip-title">Trip name</Label>
            <Input
              id="trip-title"
              autoFocus
              placeholder="Kyoto in the rain"
              value={form.title}
              maxLength={120}
              onChange={(event) => update("title", event.target.value)}
              aria-invalid={Boolean(fields.title)}
            />
            <FieldError>{fields.title}</FieldError>
          </div>
          <div>
            <Label htmlFor="trip-destination">Destination</Label>
            <Input
              id="trip-destination"
              placeholder="Kyoto, Japan"
              value={form.destination}
              maxLength={160}
              onChange={(event) => update("destination", event.target.value)}
              aria-invalid={Boolean(fields.destination)}
            />
            <FieldError>{fields.destination}</FieldError>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="trip-start">Start date</Label>
              <Input id="trip-start" type="date" value={form.start_date} onChange={(event) => update("start_date", event.target.value)} />
              <FieldError>{fields.start_date}</FieldError>
            </div>
            <div>
              <Label htmlFor="trip-end">End date</Label>
              <Input id="trip-end" type="date" min={form.start_date} value={form.end_date} onChange={(event) => update("end_date", event.target.value)} />
              <FieldError>{fields.end_date}</FieldError>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="trip-currency" hint="Ledger currency">
                Currency
              </Label>
              <Select id="trip-currency" value={form.currency} onChange={(event) => update("currency", event.target.value)}>
                {currencies.map((code) => (
                  <option key={code} value={code}>{code}</option>
                ))}
              </Select>
              <FieldError>{fields.currency}</FieldError>
            </div>
            <div>
              <Label htmlFor="trip-timezone">Time zone</Label>
              <Select id="trip-timezone" value={form.timezone} onChange={(event) => update("timezone", event.target.value)}>
                {zones.map((zone) => (
                  <option key={zone} value={zone}>{zone.replaceAll("_", " ")}</option>
                ))}
              </Select>
              <FieldError>{fields.timezone}</FieldError>
            </div>
          </div>
          <div>
            <Label htmlFor="trip-description" hint="Optional">
              A sentence about the trip
            </Label>
            <Textarea
              id="trip-description"
              rows={3}
              maxLength={1000}
              placeholder="Slow mornings, long walks, one very good noodle shop."
              value={form.description}
              onChange={(event) => update("description", event.target.value)}
            />
            <FieldError>{fields.description}</FieldError>
          </div>
          <div>
            <Label htmlFor="trip-cover" hint="Optional image URL">
              Cover
            </Label>
            <Input
              id="trip-cover"
              type="url"
              placeholder="https://…"
              value={form.cover_image_url}
              onChange={(event) => update("cover_image_url", event.target.value)}
            />
            <p className="mt-1.5 text-[10.5px] leading-relaxed text-ink-faint">
              Use a direct image URL, not a search or gallery page.
            </p>
            <FieldError>{fields.cover_image_url}</FieldError>
          </div>
          <div className="flex items-center justify-end gap-2 border-t border-line pt-4">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Creating" : "Create trip"} {busy ? <Spinner /> : <ArrowRight size={15} />}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
