import { notFound } from "next/navigation";
import { ApiError, serverApi } from "@/lib/api";
import type { Invitation, ItineraryDay, Member, Trip, TripGroup } from "@/lib/types";
import { PeopleWorkspace } from "./people-workspace";

export const metadata = { title: "People" };
export const dynamic = "force-dynamic";

export default async function PeoplePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let trip: Trip;
  let members: { items: Member[] };
  let groups: { items: TripGroup[] };
  let itinerary: { days: ItineraryDay[] };

  try {
    [trip, members, groups, itinerary] = await Promise.all([
      serverApi<Trip>(`/v1/trips/${id}/`),
      serverApi<{ items: Member[] }>(`/v1/trips/${id}/members`),
      serverApi<{ items: TripGroup[] }>(`/v1/trips/${id}/groups`),
      serverApi<{ days: ItineraryDay[] }>(`/v1/trips/${id}/itinerary`),
    ]);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  let invitations: Invitation[] = [];
  if (trip.role === "owner" || trip.role === "editor") {
    try {
      const result = await serverApi<{ items: Invitation[] }>(`/v1/trips/${id}/invitations`);
      invitations = result.items ?? [];
    } catch (error) {
      if (!(error instanceof ApiError && (error.status === 403 || error.status === 404))) throw error;
    }
  }

  return (
    <PeopleWorkspace
      trip={trip}
      initialMembers={members.items ?? []}
      initialGroups={groups.items ?? []}
      initialInvitations={invitations}
      days={itinerary.days ?? []}
      canInvite={trip.role === "owner" || trip.role === "editor"}
      canManageMembers={trip.role === "owner"}
      canManageGroups={trip.role === "owner" || trip.role === "editor"}
    />
  );
}
