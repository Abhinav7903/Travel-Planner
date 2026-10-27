import { notFound } from "next/navigation";
import { ApiError, serverApi } from "@/lib/api";
import type { Expense, Ledger, Member, Settlement, Trip, TripGroup } from "@/lib/types";
import { MoneyWorkspace } from "./money-workspace";

export const metadata = { title: "Money" };
export const dynamic = "force-dynamic";

export default async function MoneyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let trip: Trip;
  let expenses: { items: Expense[] };
  let ledger: { ledgers: Ledger[]; settlements: Settlement[] };
  let members: { items: Member[] };
  let groups: { items: TripGroup[] };

  try {
    [trip, expenses, ledger, members, groups] = await Promise.all([
      serverApi<Trip>(`/v1/trips/${id}/`),
      serverApi<{ items: Expense[] }>(`/v1/trips/${id}/expenses`),
      serverApi<{ ledgers: Ledger[]; settlements: Settlement[] }>(`/v1/trips/${id}/ledger`),
      serverApi<{ items: Member[] }>(`/v1/trips/${id}/members`),
      serverApi<{ items: TripGroup[] }>(`/v1/trips/${id}/groups`),
    ]);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  return (
    <MoneyWorkspace
      trip={trip}
      initialExpenses={expenses.items ?? []}
      initialLedgers={ledger.ledgers ?? []}
      initialSettlements={ledger.settlements ?? []}
      members={members.items ?? []}
      groups={groups.items ?? []}
      canEdit={trip.role === "owner" || trip.role === "editor"}
    />
  );
}
