import { notFound } from "next/navigation";
import { ApiError, serverApi } from "@/lib/api";
import type { Note, Trip } from "@/lib/types";
import { NotesWorkspace } from "./notes-workspace";

export const metadata = { title: "Notes" };
export const dynamic = "force-dynamic";

export default async function NotesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let trip: Trip;
  let result: { items: Note[] };
  try {
    [trip, result] = await Promise.all([
      serverApi<Trip>(`/v1/trips/${id}/`),
      serverApi<{ items: Note[] }>(`/v1/trips/${id}/notes`),
    ]);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  return <NotesWorkspace trip={trip} initialNotes={result.items ?? []} canEdit={trip.role !== "viewer"} />;
}
