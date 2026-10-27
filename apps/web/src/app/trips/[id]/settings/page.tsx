import { notFound } from "next/navigation";
import { ApiError, serverApi } from "@/lib/api";
import type { Trip } from "@/lib/types";
import { TripSettings } from "./trip-settings";

export const metadata = { title: "Trip settings" };
export const dynamic = "force-dynamic";

export default async function TripSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let trip: Trip;
  try {
    trip = await serverApi<Trip>(`/v1/trips/${id}/`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
  return <TripSettings trip={trip} canManage={trip.role === "owner"} />;
}
