import { redirect } from "next/navigation";
import Link from "next/link";
import { Archive, CalendarDays, MapPin, Users } from "lucide-react";
import { ApiError, getSessionUser, serverApi } from "@/lib/api";
import type { Trip } from "@/lib/types";
import { AppShell } from "@/components/app-shell";
import { AvatarStack } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { CoverImage } from "@/components/cover-image";
import { EmptyState } from "@/components/ui/empty-state";
import { cn, formatDateRange, roleLabel } from "@/lib/utils";
import { CreateTripButton } from "./create-trip";

export const metadata = { title: "Trips" };
export const dynamic = "force-dynamic";

export default async function TripsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/trips");

  let owned: Trip[] = [];
  let shared: Trip[] = [];
  let archived: Trip[] = [];
  try {
    const [ownedResult, sharedResult, archivedResult] = await Promise.all([
      serverApi<{ items: Trip[] }>("/v1/trips?scope=owned"),
      serverApi<{ items: Trip[] }>("/v1/trips?scope=shared"),
      serverApi<{ items: Trip[] }>("/v1/trips?scope=archived"),
    ]);
    owned = ownedResult.items ?? [];
    shared = sharedResult.items ?? [];
    archived = archivedResult.items ?? [];
  } catch (error) {
    const message = error instanceof ApiError ? error.message : "Trips could not be loaded.";
    return (
      <AppShell user={user}>
        <div className="mx-auto max-w-5xl px-5 py-16 sm:px-8">
          <EmptyState
            icon={<MapPin size={19} />}
            title="The trips are out of reach"
            description={message}
            action={
              <Link href="/trips" className="rounded-xl border border-line-strong bg-paper px-4 py-2 text-[13px] font-medium">
                Try again
              </Link>
            }
          />
        </div>
      </AppShell>
    );
  }

  const active = [...owned, ...shared].sort((a, b) => a.start_date.localeCompare(b.start_date));
  const firstName = (user.display_name?.trim() || user.email.split("@")[0] || "there").split(" ")[0];

  return (
    <AppShell user={user}>
      <div className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 lg:py-12">
        <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div className="reveal">
            <p className="eyebrow">Your collection</p>
            <h1 className="display mt-2 text-[2.6rem] leading-none sm:text-[3rem]">Trips, {firstName}.</h1>
            <p className="mt-3 text-[14px] text-ink-soft">
              {active.length === 0
                ? "Every memorable route begins with a name and a few dates."
                : `${active.length} ${active.length === 1 ? "journey" : "journeys"} in motion${shared.length > 0 ? `, ${shared.length} shared with you` : ""}.`}
            </p>
          </div>
          <CreateTripButton />
        </header>

        {active.length === 0 ? (
          <div className="mt-10 reveal-delay">
            <EmptyState
              icon={<CalendarDays size={19} />}
              title="No trips on the horizon"
              description="Start with the shape of the journey. You can add places, routes and people once the dates exist."
              action={<CreateTripButton label="Plan your first trip" />}
            />
          </div>
        ) : (
          <div className="mt-9 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {active.map((trip, index) => (
              <TripCard key={trip.id} trip={trip} delay={index} />
            ))}
          </div>
        )}

        {archived.length > 0 ? (
          <section className="mt-14">
            <div className="flex items-center gap-2.5">
              <Archive size={15} className="text-ink-faint" />
              <h2 className="text-[13px] font-semibold text-ink-soft">Archived</h2>
              <span className="text-[11px] text-ink-faint">{archived.length}</span>
            </div>
            <div className="mt-4 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-paper/70">
              {archived.map((trip) => (
                <Link
                  key={trip.id}
                  href={`/trips/${trip.id}`}
                  className="flex items-center justify-between gap-4 px-4 py-3.5 transition-colors hover:bg-[#f7f3ea]"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[13.5px] font-medium">{trip.title}</p>
                    <p className="mt-0.5 truncate text-[11.5px] text-ink-faint">
                      {trip.destination} · {formatDateRange(trip.start_date, trip.end_date)}
                    </p>
                  </div>
                  <Badge tone="outline">{roleLabel[trip.role]}</Badge>
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}

function TripCard({ trip, delay }: { trip: Trip; delay: number }) {
  const palettes = [
    "from-[#dce7dc] via-[#eef0e4] to-[#e9dfcd]",
    "from-[#e9dfd1] via-[#f1eadd] to-[#dce3d9]",
    "from-[#e2e4ec] via-[#efede7] to-[#e7ddcd]",
    "from-[#dfe7ea] via-[#edf0ea] to-[#ebe3d6]",
  ];
  const palette = palettes[delay % palettes.length];
  const members = Array.from({ length: Math.min(trip.member_count, 4) }, (_, index) => ({
    id: `${trip.id}-${index}`,
    name: ["Alex", "Maya", "Sam", "June"][index] ?? "Traveller",
  }));

  return (
    <Link
      href={`/trips/${trip.id}`}
      className="group reveal block overflow-hidden rounded-2xl border border-line bg-paper shadow-[0_1px_2px_rgba(37,39,33,.03)] transition-all duration-300 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-[0_16px_40px_rgba(37,39,33,.09)]"
      style={{ animationDelay: `${delay * 45}ms` }}
    >
      <div className={cn("relative h-[154px] overflow-hidden bg-gradient-to-br", palette)}>
        <CoverImage
          src={trip.cover_image_url}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
          fallback={<TripIllustration seed={trip.id} />}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#252721]/24 via-transparent to-transparent" />
        <div className="absolute left-4 top-4 flex gap-1.5">
          {trip.role !== "owner" ? <Badge tone="forest">Shared · {roleLabel[trip.role]}</Badge> : null}
        </div>
        <div className="absolute inset-x-4 bottom-3.5 flex items-end justify-between gap-3">
          <div className="flex items-center gap-1.5 rounded-full bg-paper/85 px-2.5 py-1 text-[10.5px] font-medium text-ink-soft backdrop-blur">
            <CalendarDays size={11} /> {formatDateRange(trip.start_date, trip.end_date)}
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-paper/85 px-2 py-1 text-[10.5px] font-medium text-ink-soft backdrop-blur">
            <Users size={11} /> {trip.member_count}
          </div>
        </div>
      </div>
      <div className="p-4.5 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="display truncate text-[1.35rem] leading-tight">{trip.title}</h3>
            <p className="mt-1 flex items-center gap-1 truncate text-[12px] text-ink-soft">
              <MapPin size={11} className="shrink-0" /> {trip.destination}
            </p>
          </div>
          <AvatarStack people={members} max={3} />
        </div>
        {trip.description ? (
          <p className="mt-3 line-clamp-2 text-[12px] leading-relaxed text-ink-soft">{trip.description}</p>
        ) : null}
        <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-[11px] text-ink-faint">
          <span>{trip.currency} · {trip.timezone.split("/").at(-1)?.replaceAll("_", " ")}</span>
          <span className="flex items-center gap-1 font-medium text-forest opacity-0 transition-opacity group-hover:opacity-100">
            Open workspace
          </span>
        </div>
      </div>
    </Link>
  );
}

function TripIllustration({ seed }: { seed: string }) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  const shift = hash % 40;
  return (
    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 400 180" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <circle cx={320 - shift} cy="42" r="24" fill="#f6f0df" opacity=".8" />
      <path d={`M-20 140 L 75 ${84 + (shift % 12)} L 130 122 L 210 ${70 + (shift % 20)} L 300 118 L 430 76 L 430 190 L -20 190 Z`} fill="#b7c2ae" opacity=".6" />
      <path d={`M-20 160 L 90 ${120 + (shift % 10)} L 160 148 L 250 ${112 + (shift % 14)} L 350 146 L 430 120 L 430 190 L -20 190 Z`} fill="#8fa18c" opacity=".55" />
      <path d="M-20 175 C 90 164, 170 180, 260 166 S 380 158, 430 170" stroke="#f6f3ec" strokeWidth="1.5" fill="none" opacity=".6" />
      <circle cx="118" cy="58" r="2.6" fill="#1f4d3d" opacity=".7" />
      <path d="M118 58 C 150 54, 164 74, 196 66" stroke="#7d8878" strokeWidth=".9" strokeDasharray="2 3" fill="none" opacity=".7" />
    </svg>
  );
}
