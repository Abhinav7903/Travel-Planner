"use client";

import { useMemo, useState } from "react";
import {
  BedDouble,
  CircleDollarSign,
  Download,
  MoreHorizontal,
  Pencil,
  PieChart,
  ShoppingBag,
  Ticket,
  TrainFront,
  Utensils,
  type LucideIcon,
} from "lucide-react";
import type { Expense, Trip } from "@/lib/types";
import { formatMoney, parseMoneyInput } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { downloadCSV, exportExpensesToCSV } from "@/lib/csv-export";

type Category = Expense["category"];

const categoryMeta: Record<Category, { label: string; icon: LucideIcon; color: string }> = {
  food: { label: "Food & Dining", icon: Utensils, color: "#d97706" },
  transport: { label: "Transit & Travel", icon: TrainFront, color: "#2563eb" },
  stay: { label: "Accommodation", icon: BedDouble, color: "#059669" },
  activity: { label: "Activities & Sights", icon: Ticket, color: "#7c3aed" },
  shopping: { label: "Shopping", icon: ShoppingBag, color: "#db2777" },
  other: { label: "Other", icon: MoreHorizontal, color: "#64748b" },
};

export function BudgetAnalytics({
  trip,
  expenses,
  canEdit,
}: {
  trip: Trip;
  expenses: Expense[];
  canEdit: boolean;
}) {
  const storageKey = `wf_trip_budget_${trip.id}`;

  const [targetBudgetMinor, setTargetBudgetMinor] = useState<number | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const val = parseInt(saved, 10);
        if (!isNaN(val) && val > 0) return val;
      }
    } catch {
      // ignore
    }
    return null;
  });

  const [budgetInput, setBudgetInput] = useState<string>(() =>
    targetBudgetMinor ? (targetBudgetMinor / 100).toFixed(0) : "",
  );
  const [editingBudget, setEditingBudget] = useState(false);

  function saveBudget() {
    const minor = parseMoneyInput(budgetInput, trip.currency);
    if (minor !== null && minor > 0) {
      setTargetBudgetMinor(minor);
      try {
        localStorage.setItem(storageKey, String(minor));
      } catch {
        // ignore
      }
    } else {
      setTargetBudgetMinor(null);
      try {
        localStorage.removeItem(storageKey);
      } catch {
        // ignore
      }
    }
    setEditingBudget(false);
  }

  // Calculate spending in trip primary currency
  const totalSpentMinor = useMemo(() => {
    return expenses
      .filter((e) => e.currency === trip.currency)
      .reduce((sum, e) => sum + e.amount_minor, 0);
  }, [expenses, trip.currency]);

  // Breakdown by category
  const categoryTotals = useMemo(() => {
    const map = new Map<Category, number>();
    expenses
      .filter((e) => e.currency === trip.currency)
      .forEach((e) => {
        map.set(e.category, (map.get(e.category) ?? 0) + e.amount_minor);
      });

    return Array.from(map.entries())
      .map(([cat, amount]) => ({
        category: cat,
        amount,
        percentage: totalSpentMinor > 0 ? (amount / totalSpentMinor) * 100 : 0,
        meta: categoryMeta[cat] ?? categoryMeta.other,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [expenses, trip.currency, totalSpentMinor]);

  const budgetProgress = targetBudgetMinor && targetBudgetMinor > 0
    ? Math.min(Math.round((totalSpentMinor / targetBudgetMinor) * 100), 999)
    : null;

  return (
    <div className="rounded-2xl border border-line bg-paper p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-forest-soft text-forest">
            <PieChart size={17} />
          </span>
          <div>
            <h3 className="text-[14px] font-semibold">Budget & Analytics</h3>
            <p className="text-[12px] text-ink-soft">
              {trip.currency} spending breakdown and target tracking
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {expenses.length > 0 ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                const csv = exportExpensesToCSV(expenses);
                const filename = `${trip.title.toLowerCase().replace(/[^a-z0-9]/g, "-")}-expenses`;
                downloadCSV(filename, csv);
              }}
              title="Download CSV of all expenses and splits"
            >
              <Download size={14} /> Export CSV
            </Button>
          ) : null}
        </div>
      </div>

      {/* Target budget progress */}
      <div className="mt-4 rounded-xl bg-[#f7f5ee] p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CircleDollarSign size={16} className="text-forest" />
            <span className="text-[13px] font-medium">Target Trip Budget:</span>
            {targetBudgetMinor ? (
              <span className="font-semibold text-ink">
                {formatMoney(targetBudgetMinor, trip.currency)}
              </span>
            ) : (
              <span className="text-[12.5px] italic text-ink-faint">None set</span>
            )}
          </div>

          {canEdit && !editingBudget ? (
            <button
              type="button"
              onClick={() => setEditingBudget(true)}
              className="inline-flex items-center gap-1 text-[12px] font-medium text-forest hover:underline"
            >
              <Pencil size={12} /> {targetBudgetMinor ? "Change" : "Set budget"}
            </button>
          ) : null}
        </div>

        {editingBudget ? (
          <div className="mt-3 flex items-center gap-2">
            <Input
              type="text"
              placeholder={`e.g. 1500`}
              value={budgetInput}
              onChange={(e) => setBudgetInput(e.target.value)}
              className="h-8 max-w-[140px] text-[12.5px]"
            />
            <Button size="sm" onClick={saveBudget} className="h-8 text-[12px]">
              Save
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEditingBudget(false)}
              className="h-8 text-[12px]"
            >
              Cancel
            </Button>
          </div>
        ) : null}

        {targetBudgetMinor && targetBudgetMinor > 0 ? (
          <div className="mt-3 space-y-1.5">
            <div className="flex justify-between text-[11.5px] text-ink-soft">
              <span>
                {formatMoney(totalSpentMinor, trip.currency)} spent ({budgetProgress}%)
              </span>
              <span>
                {totalSpentMinor > targetBudgetMinor
                  ? `${formatMoney(totalSpentMinor - targetBudgetMinor, trip.currency)} over budget`
                  : `${formatMoney(targetBudgetMinor - totalSpentMinor, trip.currency)} remaining`}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-sand">
              <div
                className={`h-full transition-all duration-300 ${
                  budgetProgress && budgetProgress > 100
                    ? "bg-[#b91c1c]"
                    : budgetProgress && budgetProgress > 85
                    ? "bg-[#d97706]"
                    : "bg-forest"
                }`}
                style={{ width: `${Math.min(budgetProgress ?? 0, 100)}%` }}
              />
            </div>
          </div>
        ) : null}
      </div>

      {/* Category breakdown bar & list */}
      {categoryTotals.length > 0 ? (
        <div className="mt-5 space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-faint">
            Spending by Category
          </p>

          {/* Proportional multi-segment bar */}
          <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-sand">
            {categoryTotals.map((item) => (
              <div
                key={item.category}
                title={`${item.meta.label}: ${formatMoney(item.amount, trip.currency)} (${item.percentage.toFixed(1)}%)`}
                style={{
                  width: `${item.percentage}%`,
                  backgroundColor: item.meta.color,
                }}
                className="h-full transition-all duration-200"
              />
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2.5 pt-1 sm:grid-cols-3">
            {categoryTotals.map((item) => {
              const Icon = item.meta.icon;
              return (
                <div
                  key={item.category}
                  className="flex items-center gap-2 rounded-lg border border-line bg-paper px-2.5 py-1.5"
                >
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-white"
                    style={{ backgroundColor: item.meta.color }}
                  >
                    <Icon size={13} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] text-ink-soft">{item.meta.label}</p>
                    <p className="text-[12px] font-semibold tabular-nums text-ink">
                      {formatMoney(item.amount, trip.currency)}
                      <span className="ml-1 text-[10px] font-normal text-ink-faint">
                        ({item.percentage.toFixed(0)}%)
                      </span>
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
