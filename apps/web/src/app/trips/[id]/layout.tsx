import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Archive, CalendarDays, MapPin, Users } from "lucide-react";
import { ApiError, getSessionUser, serverApi } from "@/lib/api";
import type { Trip } from "@/lib/types";
import { AppShell } from "@/components/app-shell";
import { AvatarStack } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { CoverImage } from "@/components/cover-image";
import { formatDateRange } from "@/lib/utils";
import { TripTabs } from "./trip-tabs";

export default async function TripLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=/trips/${id}`);

  let trip: Trip;
  try {
    trip = await serverApi<Trip>(`/v1/trips/${id}/`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  const cover = trip.cover_image_url;
  const people = Array.from({ length: Math.min(trip.member_count, 5) }, (_, index) => ({
    id: `${trip.id}-member-${index}`,
    name: ["Alex", "Maya", "Sam", "June", "Noah"][index] ?? "Traveller",
  }));

  return (
    <AppShell user={user}>
      <div className="border-b border-line bg-paper">
        <div className="relative h-[184px] overflow-hidden bg-[#dfe6da] sm:h-[220px]">
          <CoverImage src={cover} className="absolute inset-0 h-full w-full object-cover" fallback={<TripCover />} />
          <div className="absolute inset-0 bg-gradient-to-t from-[#1c2a23]/75 via-[#1c2a23]/10 to-transparent" />
          <div className="absolute inset-x-0 top-0 flex items-center justify-between px-5 pt-4 sm:px-8">
            <Link
              href="/trips"
              className="inline-flex items-center gap-1.5 rounded-full bg-[#fdfbf7]/85 px-3 py-1.5 text-[11.5px] font-medium text-ink backdrop-blur transition-colors hover:bg-paper"
            >
              <ArrowLeft size={13} /> All trips
            </Link>
            {trip.status === "archived" ? (
              <Badge tone="sand">
                <Archive size={10} /> Archived
              </Badge>
            ) : null}
          </div>
          <div className="absolute inset-x-0 bottom-0 px-5 pb-4 sm:px-8 sm:pb-5">
            <div className="flex items-end justify-between gap-4">
              <div className="min-w-0 text-[#fdfbf7]">
                <p className="flex items-center gap-1.5 text-[11px] font-medium tracking-wide text-white/75">
                  <MapPin size={11} /> {trip.destination}
                </p>
                <h1 className="display mt-1 truncate text-[2.1rem] leading-[1.05] sm:text-[2.7rem]">{trip.title}</h1>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-white/80">
                  <span className="flex items-center gap-1.5">
                    <CalendarDays size={12} /> {formatDateRange(trip.start_date, trip.end_date)}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Users size={12} /> {trip.member_count} {trip.member_count === 1 ? "traveller" : "travellers"}
                  </span>
                  <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold capitalize backdrop-blur">
                    {trip.role}
                  </span>
                </div>
              </div>
              <div className="hidden sm:block">
                <AvatarStack people={people} max={4} />
              </div>
            </div>
          </div>
        </div>
        <TripTabs tripID={trip.id} role={trip.role} />
      </div>
      {children}
    </AppShell>
  );
}

function TripCover() {
  return (
    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1200 260" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <rect width="1200" height="260" fill="#e7e9df" />
      <circle cx="930" cy="70" r="42" fill="#f3eedd" />
      <path d="M0 205 L 150 118 L 290 188 L 460 96 L 630 184 L 790 106 L 980 180 L 1120 122 L 1200 166 L 1200 260 L0 260Z" fill="#b8c5af" opacity=".75" />
      <path d="M0 232 L 190 172 L 340 218 L 520 152 L 720 224 L 900 166 L 1080 218 L 1200 190 L 1200 260 L0 260Z" fill="#849a80" opacity=".7" />
      <path d="M0 246 C 240 228, 420 252, 640 236 S 1010 224, 1200 240" stroke="#f4f1e5" strokeWidth="2" fill="none" opacity=".55" />
    </svg>
  );
}
