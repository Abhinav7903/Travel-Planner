import { notFound } from "next/navigation";
import { ApiError, serverApi } from "@/lib/api";
import type { ItineraryDay, Member, Trip, TripGroup } from "@/lib/types";
import { MapWorkspace } from "./map-workspace";

export const metadata = { title: "Map" };
export const dynamic = "force-dynamic";

export default async function MapPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let trip: Trip;
  let itinerary: { days: ItineraryDay[] };
  let groups: { items: TripGroup[] };
  let members: { items: Member[] };

  try {
    [trip, itinerary, groups, members] = await Promise.all([
      serverApi<Trip>(`/v1/trips/${id}/`),
      serverApi<{ days: ItineraryDay[] }>(`/v1/trips/${id}/itinerary`),
      serverApi<{ items: TripGroup[] }>(`/v1/trips/${id}/groups`),
      serverApi<{ items: Member[] }>(`/v1/trips/${id}/members`),
    ]);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  return <MapWorkspace trip={trip} days={itinerary.days ?? []} groups={groups.items ?? []} members={members.items ?? []} />;
}
