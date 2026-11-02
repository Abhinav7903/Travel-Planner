import type { Expense } from "./types";

function escapeCSV(val: string | number): string {
  const str = String(val ?? "");
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportExpensesToCSV(expenses: Expense[]): string {
  const headers = [
    "Date",
    "Description",
    "Category",
    "Payer",
    "Currency",
    "Amount Minor",
    "Formatted Amount",
    "Split Count",
    "Note",
  ];

  const rows = expenses.map((exp) => [
    escapeCSV(exp.expense_date),
    escapeCSV(exp.description),
    escapeCSV(exp.category),
    escapeCSV(exp.payer_name),
    escapeCSV(exp.currency),
    escapeCSV(exp.amount_minor),
    escapeCSV((exp.amount_minor / 100).toFixed(2)),
    escapeCSV(exp.splits?.length ?? 0),
    escapeCSV(exp.note ?? ""),
  ]);

  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
}

export function downloadCSV(filename: string, content: string): void {
  if (typeof window === "undefined") return;
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
