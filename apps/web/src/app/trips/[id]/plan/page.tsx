import { notFound } from "next/navigation";
import { ApiError, serverApi } from "@/lib/api";
import type { ItineraryDay, Member, Trip, TripGroup } from "@/lib/types";
import { Planner } from "./planner";

export const dynamic = "force-dynamic";

export default async function PlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let trip: Trip;
  let itinerary: { days: ItineraryDay[] };
  let groupResult: { items: TripGroup[] };
  let memberResult: { items: Member[] };

  try {
    [trip, itinerary, groupResult, memberResult] = await Promise.all([
      serverApi<Trip>(`/v1/trips/${id}/`),
      serverApi<{ days: ItineraryDay[] }>(`/v1/trips/${id}/itinerary`),
      serverApi<{ items: TripGroup[] }>(`/v1/trips/${id}/groups`),
      serverApi<{ items: Member[] }>(`/v1/trips/${id}/members`),
    ]);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  return (
    <Planner
      trip={trip}
      initialDays={itinerary.days ?? []}
      groups={groupResult.items ?? []}
      members={memberResult.items ?? []}
      canEdit={trip.role === "owner" || trip.role === "editor"}
    />
  );
}
