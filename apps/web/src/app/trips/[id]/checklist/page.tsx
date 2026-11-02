import { notFound } from "next/navigation";
import { ApiError, serverApi } from "@/lib/api";
import type { Member, Trip } from "@/lib/types";
import { ChecklistWorkspace } from "./checklist-workspace";

export const metadata = { title: "Checklist & Packing" };
export const dynamic = "force-dynamic";

export default async function ChecklistPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let trip: Trip;
  let members: { items: Member[] };

  try {
    [trip, members] = await Promise.all([
      serverApi<Trip>(`/v1/trips/${id}/`),
      serverApi<{ items: Member[] }>(`/v1/trips/${id}/members`),
    ]);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  return (
    <ChecklistWorkspace
      trip={trip}
      members={members.items ?? []}
      canEdit={trip.role !== "viewer"}
    />
  );
}
