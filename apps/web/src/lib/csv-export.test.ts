import { describe, expect, it } from "vitest";
import { exportExpensesToCSV } from "./csv-export";
import type { Expense } from "./types";

describe("exportExpensesToCSV", () => {
  it("escapes fields and formats headers correctly", () => {
    const expenses: Expense[] = [
      {
        id: "exp-1",
        trip_id: "trip-1",
        description: 'Dinner at "Le Gourmet", Paris',
        amount_minor: 12550,
        currency: "EUR",
        category: "food",
        expense_date: "2026-11-12",
        payer_id: "user-1",
        payer_name: "Friday",
        group_id: "",
        note: "Delicious food, paid with card\nSecond line",
        splits: [
          { user_id: "user-1", display_name: "Friday", amount_minor: 6275 },
          { user_id: "user-2", display_name: "Chips", amount_minor: 6275 },
        ],
        version: 1,
        created_at: "2026-11-12T20:00:00Z",
        updated_at: "2026-11-12T20:00:00Z",
      },
      {
        id: "exp-2",
        trip_id: "trip-1",
        description: "Metro Tickets",
        amount_minor: 840,
        currency: "EUR",
        category: "transport",
        expense_date: "2026-11-13",
        payer_id: "user-2",
        payer_name: "Chips",
        group_id: "",
        note: "",
        splits: [{ user_id: "user-2", display_name: "Chips", amount_minor: 840 }],
        version: 1,
        created_at: "2026-11-13T10:00:00Z",
        updated_at: "2026-11-13T10:00:00Z",
      },
    ];

    const csv = exportExpensesToCSV(expenses);
    const lines = csv.split("\r\n");

    expect(lines[0]).toBe(
      "Date,Description,Category,Payer,Currency,Amount Minor,Formatted Amount,Split Count,Note",
    );
    // Line 1 should have escaped quotes around Dinner
    expect(lines[1]).toContain('"Dinner at ""Le Gourmet"", Paris"');
    expect(lines[1]).toContain("12550,125.50,2");
    expect(csv).toContain("Metro Tickets,transport,Chips,EUR,840,8.40,1");
  });
});
