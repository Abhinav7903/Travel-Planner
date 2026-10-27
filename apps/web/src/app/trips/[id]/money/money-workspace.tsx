"use client";

import { useMemo, useState } from "react";
import {
  ArrowRight,
  BedDouble,
  CalendarDays,
  Check,
  HandCoins,
  MoreHorizontal,
  Pencil,
  Plus,
  ReceiptText,
  Scale,
  ShoppingBag,
  Ticket,
  TrainFront,
  Trash2,
  Users,
  Utensils,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { Expense, Ledger, Member, Settlement, Trip, TripGroup } from "@/lib/types";
import { browserApi } from "@/lib/client-api";
import {
  cn,
  currencyDigits,
  errorMessage,
  formatDay,
  formatMoney,
  parseMoneyInput,
} from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button, Spinner } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { FieldError, FormError, Input, Label, Select, Textarea } from "@/components/ui/input";

type Category = Expense["category"];

const categories: Record<Category, { label: string; icon: LucideIcon }> = {
  food: { label: "Food", icon: Utensils },
  transport: { label: "Transport", icon: TrainFront },
  stay: { label: "Stay", icon: BedDouble },
  activity: { label: "Activity", icon: Ticket },
  shopping: { label: "Shopping", icon: ShoppingBag },
  other: { label: "Other", icon: MoreHorizontal },
};

type ExpenseForm = {
  description: string;
  amount: string;
  currency: string;
  category: Category;
  expense_date: string;
  payer_id: string;
  group_id: string;
  note: string;
  split_mode: "equal" | "custom";
  participant_ids: string[];
  custom_amounts: Record<string, string>;
};

type SettlementForm = {
  from_user_id: string;
  to_user_id: string;
  amount: string;
  currency: string;
  settled_on: string;
  note: string;
};

function minorToInput(minor: number, currency: string): string {
  const digits = currencyDigits(currency);
  if (digits === 0) return String(minor);
  return (minor / 10 ** digits).toFixed(digits).replace(/0+$/, "").replace(/\.$/, "");
}

function equalShares(amount: number, payer: string, participants: string[]): Map<string, number> {
  const ordered = [payer, ...participants.filter((id) => id !== payer).sort()].filter((id) =>
    participants.includes(id),
  );
  const result = new Map<string, number>();
  if (!ordered.length || amount <= 0) return result;
  const base = Math.floor(amount / ordered.length);
  let remainder = amount - base * ordered.length;
  ordered.forEach((id) => {
    const extra = remainder > 0 ? 1 : 0;
    if (remainder > 0) remainder -= 1;
    result.set(id, base + extra);
  });
  return result;
}

export function MoneyWorkspace({
  trip,
  initialExpenses,
  initialLedgers,
  initialSettlements,
  members,
  groups,
  canEdit,
}: {
  trip: Trip;
  initialExpenses: Expense[];
  initialLedgers: Ledger[];
  initialSettlements: Settlement[];
  members: Member[];
  groups: TripGroup[];
  canEdit: boolean;
}) {
  const [expenses, setExpenses] = useState(initialExpenses);
  const [ledgers, setLedgers] = useState(initialLedgers);
  const [settlements, setSettlements] = useState(initialSettlements);
  const [expenseDialog, setExpenseDialog] = useState(false);
  const [settlementDialog, setSettlementDialog] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [form, setForm] = useState<ExpenseForm>(() => blankExpense(trip, members));
  const [settlementForm, setSettlementForm] = useState<SettlementForm>(() => blankSettlement(trip, members));
  const [busy, setBusy] = useState(false);
  const [deletingID, setDeletingID] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const nameByID = useMemo(() => new Map(members.map((member) => [member.user_id, member.display_name])), [members]);
  const groupByID = useMemo(() => new Map(groups.map((group) => [group.id, group])), [groups]);
  const currencies = useMemo(
    () => Array.from(new Set([trip.currency, ...ledgers.map((ledger) => ledger.currency)])),
    [trip.currency, ledgers],
  );
  const totalByCurrency = useMemo(() => {
    const totals = new Map<string, number>();
    expenses.forEach((expense) => {
      totals.set(expense.currency, (totals.get(expense.currency) ?? 0) + expense.amount_minor);
    });
    return Array.from(totals.entries());
  }, [expenses]);
  const sortedExpenses = useMemo(
    () =>
      [...expenses].sort(
        (a, b) => b.expense_date.localeCompare(a.expense_date) || b.created_at.localeCompare(a.created_at),
      ),
    [expenses],
  );

  const parsedAmount = parseMoneyInput(form.amount, form.currency);
  const previewShares = parsedAmount && form.split_mode === "equal"
    ? equalShares(parsedAmount, form.payer_id, form.participant_ids)
    : new Map<string, number>();
  const customTotal = form.participant_ids.reduce(
    (sum, id) => sum + (parseMoneyInput(form.custom_amounts[id] ?? "", form.currency) ?? 0),
    0,
  );
  const customRemaining = parsedAmount === null ? null : parsedAmount - customTotal;

  async function refresh() {
    const [expenseResult, ledgerResult] = await Promise.all([
      browserApi<{ items: Expense[] }>(`/api/v1/trips/${trip.id}/expenses`),
      browserApi<{ ledgers: Ledger[]; settlements: Settlement[] }>(`/api/v1/trips/${trip.id}/ledger`),
    ]);
    setExpenses(expenseResult.items ?? []);
    setLedgers(ledgerResult.ledgers ?? []);
    setSettlements(ledgerResult.settlements ?? []);
  }

  function openNewExpense() {
    setEditing(null);
    setForm(blankExpense(trip, members));
    setFieldErrors({});
    setError("");
    setExpenseDialog(true);
  }

  function openEditExpense(expense: Expense) {
    setEditing(expense);
    const splitMap: Record<string, string> = {};
    expense.splits.forEach((split) => {
      splitMap[split.user_id] = minorToInput(split.amount_minor, expense.currency);
    });
    setForm({
      description: expense.description,
      amount: minorToInput(expense.amount_minor, expense.currency),
      currency: expense.currency,
      category: expense.category,
      expense_date: expense.expense_date,
      payer_id: expense.payer_id,
      group_id: expense.group_id,
      note: expense.note,
      split_mode: "custom",
      participant_ids: members.map((member) => member.user_id),
      custom_amounts: splitMap,
    });
    setFieldErrors({});
    setError("");
    setExpenseDialog(true);
  }

  function openSettlement(prefill?: { from: string; to: string; amount: number; currency: string }) {
    if (prefill) {
      setSettlementForm({
        from_user_id: prefill.from,
        to_user_id: prefill.to,
        amount: minorToInput(prefill.amount, prefill.currency),
        currency: prefill.currency,
        settled_on: trip.start_date,
        note: "",
      });
    } else {
      setSettlementForm(blankSettlement(trip, members));
    }
    setFieldErrors({});
    setError("");
    setSettlementDialog(true);
  }

  function update<K extends keyof ExpenseForm>(key: K, value: ExpenseForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => ({ ...current, [key]: "" }));
  }

  function toggleParticipant(id: string) {
    setForm((current) => {
      const selected = current.participant_ids.includes(id);
      return {
        ...current,
        participant_ids: selected
          ? current.participant_ids.filter((participant) => participant !== id)
          : [...current.participant_ids, id],
      };
    });
  }

  async function saveExpense(event: React.FormEvent) {
    event.preventDefault();
    if (!canEdit || busy) return;
    const fields: Record<string, string> = {};
    if (!form.description.trim()) fields.description = "Give the expense a name.";
    if (parsedAmount === null || parsedAmount <= 0) fields.amount = "Enter an amount greater than zero.";
    if (!form.payer_id) fields.payer = "Choose who paid.";
    if (!form.participant_ids.length) fields.participants = "Choose at least one person.";
    if (form.split_mode === "custom" && customRemaining !== 0) {
      fields.custom = "Custom shares must add up exactly to the total.";
    }
    if (form.participant_ids.some((id) => form.split_mode === "custom" && parseMoneyInput(form.custom_amounts[id] ?? "", form.currency) === null)) {
      fields.custom = "Enter a share for every selected person, including 0.";
    }
    setFieldErrors(fields);
    if (Object.keys(fields).length) return;

    setBusy(true);
    setError("");
    const payload = {
      description: form.description.trim(),
      amount_minor: parsedAmount,
      currency: form.currency,
      category: form.category,
      expense_date: form.expense_date,
      payer_id: form.payer_id,
      group_id: form.group_id,
      note: form.note.trim(),
      split_mode: form.split_mode,
      participants: form.split_mode === "equal" ? form.participant_ids : [],
      custom_splits: form.split_mode === "custom"
        ? form.participant_ids.map((id) => ({
            user_id: id,
            amount_minor: parseMoneyInput(form.custom_amounts[id] ?? "", form.currency) ?? 0,
          }))
        : [],
      version: editing?.version ?? 0,
    };
    try {
      await browserApi<Expense>(
        editing ? `/api/v1/trips/${trip.id}/expenses/${editing.id}` : `/api/v1/trips/${trip.id}/expenses`,
        { method: editing ? "PATCH" : "POST", body: JSON.stringify(payload) },
      );
      await refresh();
      setExpenseDialog(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function deleteExpense(expense: Expense) {
    if (!canEdit || deletingID) return;
    if (!window.confirm(`Delete “${expense.description}”? This cannot be undone.`)) return;
    setDeletingID(expense.id);
    setError("");
    try {
      await browserApi(`/api/v1/trips/${trip.id}/expenses/${expense.id}?version=${expense.version}`, {
        method: "DELETE",
      });
      await refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setDeletingID(null);
    }
  }

  async function saveSettlement(event: React.FormEvent) {
    event.preventDefault();
    if (!canEdit || busy) return;
    const fields: Record<string, string> = {};
    if (!settlementForm.from_user_id) fields.from = "Choose who paid.";
    if (!settlementForm.to_user_id) fields.to = "Choose who received it.";
    if (settlementForm.from_user_id === settlementForm.to_user_id) fields.to = "Choose two different people.";
    const amount = parseMoneyInput(settlementForm.amount, settlementForm.currency);
    if (amount === null || amount <= 0) fields.amount = "Enter an amount greater than zero.";
    setFieldErrors(fields);
    if (Object.keys(fields).length) return;

    setBusy(true);
    setError("");
    try {
      await browserApi<Settlement>(`/api/v1/trips/${trip.id}/settlements`, {
        method: "POST",
        body: JSON.stringify({
          from_user_id: settlementForm.from_user_id,
          to_user_id: settlementForm.to_user_id,
          amount_minor: amount,
          currency: settlementForm.currency,
          settled_on: settlementForm.settled_on,
          note: settlementForm.note.trim(),
        }),
      });
      await refresh();
      setSettlementDialog(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 py-7 sm:px-6 lg:px-8">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="eyebrow">Shared expenses</p>
          <h2 className="display mt-1.5 text-[2rem] leading-none">Keep the ledger kind.</h2>
          <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-ink-soft">
            Every split is stored in exact minor units. Currencies stay separate — no invented exchange rates.
          </p>
        </div>
        {canEdit ? (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => openSettlement()}>
              <HandCoins size={15} /> Record repayment
            </Button>
            <Button onClick={openNewExpense}>
              <Plus size={15} /> Add expense
            </Button>
          </div>
        ) : null}
      </div>

      {error && !expenseDialog && !settlementDialog ? (
        <div className="mt-4">
          <FormError>{error}</FormError>
        </div>
      ) : null}

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <SummaryCard
          icon={Wallet}
          label="Trip spending"
          value={totalByCurrency.length ? formatMoney(totalByCurrency[0]![1], totalByCurrency[0]![0]) : "—"}
          detail={totalByCurrency.length > 1 ? totalByCurrency.slice(1).map(([currency, total]) => formatMoney(total, currency)).join(" · ") : "Across all recorded expenses"}
        />
        <SummaryCard
          icon={ReceiptText}
          label="Expenses"
          value={String(expenses.length)}
          detail={expenses.length === 1 ? "One shared entry" : `${expenses.length} shared entries`}
        />
        <SummaryCard
          icon={Scale}
          label="Open balances"
          value={String(ledgers.reduce((sum, ledger) => sum + ledger.suggestions.length, 0))}
          detail="Suggested repayments, settled as you go"
        />
      </div>

      <div className="mt-6 grid items-start gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(340px,.85fr)]">
        <section className="overflow-hidden rounded-2xl border border-line bg-paper">
          <div className="flex items-center justify-between gap-4 border-b border-line px-4 py-3.5 sm:px-5">
            <div>
              <h3 className="text-[13.5px] font-semibold">Expenses</h3>
              <p className="mt-0.5 text-[11.5px] text-ink-faint">Newest trip day first</p>
            </div>
            <Badge tone="sand">{expenses.length}</Badge>
          </div>
          {sortedExpenses.length === 0 ? (
            <div className="p-5">
              <EmptyState
                icon={<ReceiptText size={18} />}
                title="No expenses yet"
                description={canEdit ? "Add the first shared cost and Wayfarer will work out who owes whom." : "Nothing has been recorded for this trip yet."}
                action={canEdit ? <Button size="sm" onClick={openNewExpense}><Plus size={14} /> Add expense</Button> : undefined}
              />
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {sortedExpenses.map((expense) => {
                const meta = categories[expense.category] ?? categories.other;
                const Icon = meta.icon;
                const group = groupByID.get(expense.group_id);
                return (
                  <li key={expense.id} className="group flex items-start gap-3.5 px-4 py-4 transition-colors hover:bg-[#faf7f0] sm:px-5">
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sand text-ink-soft">
                      <Icon size={16} strokeWidth={1.7} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <p className="truncate text-[14px] font-semibold">{expense.description}</p>
                        {group ? (
                          <span className="inline-flex items-center gap-1 text-[10.5px] text-ink-faint">
                            <span className="h-1.5 w-1.5 rounded-full" style={{ background: group.color }} />
                            {group.name}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-ink-soft">
                        <span>{meta.label}</span>
                        <span className="text-ink-faint">·</span>
                        <span>{formatDay(expense.expense_date, "MMM d")}</span>
                        <span className="text-ink-faint">·</span>
                        <span className="inline-flex items-center gap-1">
                          <Avatar name={expense.payer_name} size="xs" /> {expense.payer_name} paid
                        </span>
                      </p>
                      <p className="mt-1.5 flex flex-wrap items-center gap-1 text-[11px] text-ink-faint">
                        <Users size={10} /> Split between {expense.splits.length}
                        {expense.splits.slice(0, 3).map((split) => (
                          <span key={split.user_id} className="rounded-full bg-sand px-1.5 py-0.5 text-[10px] text-ink-soft">
                            {split.display_name.split(" ")[0]} {formatMoney(split.amount_minor, expense.currency)}
                          </span>
                        ))}
                        {expense.splits.length > 3 ? <span>+{expense.splits.length - 3}</span> : null}
                      </p>
                      {expense.note ? <p className="mt-1.5 line-clamp-2 text-[11.5px] leading-relaxed text-ink-soft">{expense.note}</p> : null}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <span className="text-[14px] font-semibold tabular-nums">{formatMoney(expense.amount_minor, expense.currency)}</span>
                      {canEdit ? (
                        <div className="flex gap-0.5 opacity-60 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                          <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={`Edit ${expense.description}`} onClick={() => openEditExpense(expense)}>
                            <Pencil size={12} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-[#9a4a2b]"
                            aria-label={`Delete ${expense.description}`}
                            disabled={deletingID === expense.id}
                            onClick={() => void deleteExpense(expense)}
                          >
                            {deletingID === expense.id ? <Spinner /> : <Trash2 size={12} />}
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <aside className="space-y-5">
          <section className="rounded-2xl border border-line bg-paper p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-[13.5px] font-semibold">Balances</h3>
                <p className="mt-0.5 text-[11.5px] text-ink-faint">Paid minus owed, plus repayments</p>
              </div>
              <Scale size={17} className="text-ink-faint" />
            </div>
            {ledgers.length === 0 ? (
              <p className="mt-5 rounded-xl border border-dashed border-line-strong px-4 py-6 text-center text-[12px] leading-relaxed text-ink-faint">
                Balances appear after the first expense.
              </p>
            ) : (
              <div className="mt-4 space-y-6">
                {ledgers.map((ledger) => (
                  <div key={ledger.currency}>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-faint">{ledger.currency} ledger</span>
                      <span className="text-[11.5px] tabular-nums text-ink-soft">{formatMoney(ledger.total_minor, ledger.currency)}</span>
                    </div>
                    <ul className="mt-2.5 space-y-1.5">
                      {ledger.balances.map((balance) => {
                        const name = nameByID.get(balance.user_id) ?? "Traveller";
                        return (
                          <li key={balance.user_id} className="flex items-center justify-between gap-3 rounded-lg px-1 py-1">
                            <span className="flex min-w-0 items-center gap-2 text-[12.5px]">
                              <Avatar name={name} size="xs" />
                              <span className="truncate">{name}</span>
                            </span>
                            <span className={cn(
                              "text-[12px] font-semibold tabular-nums",
                              balance.net_minor > 0 ? "text-forest" : balance.net_minor < 0 ? "text-[#9a4a2b]" : "text-ink-faint",
                            )}>
                              {balance.net_minor === 0 ? "Settled" : `${balance.net_minor > 0 ? "+" : "−"}${formatMoney(Math.abs(balance.net_minor), ledger.currency)}`}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                    {ledger.suggestions.length ? (
                      <div className="mt-3 rounded-xl bg-[#f7f4ec] p-3">
                        <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-faint">Suggested repayments</p>
                        <div className="mt-2 space-y-2">
                          {ledger.suggestions.map((suggestion, index) => (
                            <div key={`${suggestion.from_user_id}-${suggestion.to_user_id}-${index}`} className="flex items-center justify-between gap-2">
                              <p className="min-w-0 flex-1 truncate text-[11.5px] text-ink-soft">
                                {nameByID.get(suggestion.from_user_id) ?? "Someone"}
                                <ArrowRight size={10} className="mx-1 inline" />
                                {nameByID.get(suggestion.to_user_id) ?? "Someone"}
                                <span className="ml-1 font-semibold text-ink">{formatMoney(suggestion.amount_minor, ledger.currency)}</span>
                              </p>
                              {canEdit ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-[10.5px]"
                                  onClick={() => openSettlement({
                                    from: suggestion.from_user_id,
                                    to: suggestion.to_user_id,
                                    amount: suggestion.amount_minor,
                                    currency: ledger.currency,
                                  })}
                                >
                                  Record
                                </Button>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-forest-soft px-3 py-2 text-[11.5px] text-forest">
                        <Check size={12} /> All square
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-line bg-paper p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-[13.5px] font-semibold">Repayments</h3>
              <HandCoins size={16} className="text-ink-faint" />
            </div>
            {settlements.length === 0 ? (
              <p className="mt-4 text-[11.5px] leading-relaxed text-ink-faint">No repayments recorded. Suggested settlements above already include everything paid.</p>
            ) : (
              <ul className="mt-3 divide-y divide-line">
                {settlements.map((settlement) => (
                  <li key={settlement.id} className="flex items-start justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-[12px]">
                        <span className="font-medium">{settlement.from_name}</span>
                        <ArrowRight size={10} className="mx-1 inline text-ink-faint" />
                        <span className="font-medium">{settlement.to_name}</span>
                      </p>
                      <p className="mt-0.5 flex items-center gap-1 text-[10.5px] text-ink-faint">
                        <CalendarDays size={9} /> {formatDay(settlement.settled_on, "MMM d, yyyy")}
                        {settlement.note ? <span className="truncate"> · {settlement.note}</span> : null}
                      </p>
                    </div>
                    <span className="shrink-0 text-[12px] font-semibold tabular-nums">{formatMoney(settlement.amount_minor, settlement.currency)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>

      <Dialog
        open={expenseDialog}
        onClose={() => {
          if (!busy) setExpenseDialog(false);
        }}
        title={editing ? "Edit expense" : "Add an expense"}
        description="Amounts are recorded exactly. Nothing is converted between currencies."
        wide
      >
        <form onSubmit={saveExpense} className="space-y-5">
          {error ? <FormError>{error}</FormError> : null}
          <div className="grid gap-4 sm:grid-cols-[1fr_150px]">
            <div>
              <Label htmlFor="expense-description">Description</Label>
              <Input
                id="expense-description"
                value={form.description}
                onChange={(event) => update("description", event.target.value)}
                placeholder="Kaiseki dinner"
                autoFocus
              />
              <FieldError>{fieldErrors.description}</FieldError>
            </div>
            <div>
              <Label htmlFor="expense-amount">Amount</Label>
              <Input
                id="expense-amount"
                inputMode="decimal"
                value={form.amount}
                onChange={(event) => update("amount", event.target.value)}
                placeholder={currencyDigits(form.currency) ? "0.00" : "0"}
              />
              <FieldError>{fieldErrors.amount}</FieldError>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="expense-currency">Currency</Label>
              <Select id="expense-currency" value={form.currency} onChange={(event) => update("currency", event.target.value)}>
                {currencies.map((currency) => <option key={currency} value={currency}>{currency}</option>)}
              </Select>
            </div>
            <div>
              <Label htmlFor="expense-category">Category</Label>
              <Select id="expense-category" value={form.category} onChange={(event) => update("category", event.target.value as Category)}>
                {Object.entries(categories).map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}
              </Select>
            </div>
            <div>
              <Label htmlFor="expense-date">Date</Label>
              <Input id="expense-date" type="date" value={form.expense_date} onChange={(event) => update("expense_date", event.target.value)} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="expense-payer">Paid by</Label>
              <Select id="expense-payer" value={form.payer_id} onChange={(event) => update("payer_id", event.target.value)}>
                {members.map((member) => <option key={member.user_id} value={member.user_id}>{member.display_name}</option>)}
              </Select>
              <FieldError>{fieldErrors.payer}</FieldError>
            </div>
            <div>
              <Label htmlFor="expense-group">Group <span className="font-normal text-ink-faint">optional</span></Label>
              <Select id="expense-group" value={form.group_id} onChange={(event) => update("group_id", event.target.value)}>
                <option value="">Everyone on the trip</option>
                {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
              </Select>
            </div>
          </div>

          <div className="rounded-xl border border-line bg-[#fbf8f1] p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[12px] font-semibold">Split between</p>
              <div className="inline-flex rounded-lg border border-line bg-paper p-0.5">
                {(["equal", "custom"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => update("split_mode", mode)}
                    className={cn(
                      "rounded-md px-2.5 py-1 text-[11px] font-medium capitalize transition-colors",
                      form.split_mode === mode ? "bg-forest text-[#fbf9f3]" : "text-ink-soft hover:text-ink",
                    )}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {members.map((member) => {
                const selected = form.participant_ids.includes(member.user_id);
                return (
                  <div
                    key={member.user_id}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border px-2.5 py-2 transition-colors",
                      selected ? "border-[#c7d4c7] bg-paper" : "border-transparent",
                    )}
                  >
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={selected}
                      aria-label={`Include ${member.display_name}`}
                      onClick={() => toggleParticipant(member.user_id)}
                      className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
                        selected ? "border-forest bg-forest text-white" : "border-line-strong bg-paper",
                      )}
                    >
                      {selected ? <Check size={10} /> : null}
                    </button>
                    <Avatar name={member.display_name} size="xs" />
                    <span className="min-w-0 flex-1 truncate text-[12px]">{member.display_name}</span>
                    {form.split_mode === "custom" && selected ? (
                      <input
                        aria-label={`${member.display_name} share`}
                        inputMode="decimal"
                        value={form.custom_amounts[member.user_id] ?? ""}
                        onChange={(event) => {
                          const value = event.target.value;
                          setForm((current) => ({ ...current, custom_amounts: { ...current.custom_amounts, [member.user_id]: value } }));
                          setFieldErrors((current) => ({ ...current, custom: "" }));
                        }}
                        placeholder="0"
                        className="h-7 w-20 rounded-md border border-line-strong bg-paper px-2 text-right text-[11.5px] tabular-nums focus:border-forest focus:outline-none"
                      />
                    ) : selected && form.split_mode === "equal" ? (
                      <span className="text-[11px] tabular-nums text-ink-faint">
                        {previewShares.get(member.user_id) !== undefined ? formatMoney(previewShares.get(member.user_id)!, form.currency) : "—"}
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>
            <FieldError>{fieldErrors.participants}</FieldError>
            <FieldError>{fieldErrors.custom}</FieldError>
            {form.split_mode === "custom" && parsedAmount !== null ? (
              <p className={cn("mt-2.5 text-[11px]", customRemaining === 0 ? "text-forest" : "text-[#9a4a2b]")}>
                {customRemaining === 0
                  ? "Shares match the total exactly."
                  : `Shares are ${formatMoney(Math.abs(customRemaining ?? 0), form.currency)} ${(customRemaining ?? 0) > 0 ? "under" : "over"} the total.`}
              </p>
            ) : null}
          </div>

          <div>
            <Label htmlFor="expense-note">Note <span className="font-normal text-ink-faint">optional</span></Label>
            <Textarea id="expense-note" rows={2} value={form.note} onChange={(event) => update("note", event.target.value)} placeholder="What was this for?" />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => setExpenseDialog(false)} disabled={busy}>Cancel</Button>
            <Button type="submit" disabled={busy}>
              {busy ? <Spinner /> : <Check size={14} />} {editing ? "Save changes" : "Add expense"}
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={settlementDialog}
        onClose={() => {
          if (!busy) setSettlementDialog(false);
        }}
        title="Record a repayment"
        description="This adjusts balances without creating a new expense."
      >
        <form onSubmit={saveSettlement} className="space-y-4">
          {error ? <FormError>{error}</FormError> : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="settlement-from">From</Label>
              <Select id="settlement-from" value={settlementForm.from_user_id} onChange={(event) => setSettlementForm((current) => ({ ...current, from_user_id: event.target.value }))}>
                <option value="">Choose person</option>
                {members.map((member) => <option key={member.user_id} value={member.user_id}>{member.display_name}</option>)}
              </Select>
              <FieldError>{fieldErrors.from}</FieldError>
            </div>
            <div>
              <Label htmlFor="settlement-to">To</Label>
              <Select id="settlement-to" value={settlementForm.to_user_id} onChange={(event) => setSettlementForm((current) => ({ ...current, to_user_id: event.target.value }))}>
                <option value="">Choose person</option>
                {members.map((member) => <option key={member.user_id} value={member.user_id}>{member.display_name}</option>)}
              </Select>
              <FieldError>{fieldErrors.to}</FieldError>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
            <div>
              <Label htmlFor="settlement-amount">Amount</Label>
              <Input id="settlement-amount" inputMode="decimal" value={settlementForm.amount} onChange={(event) => setSettlementForm((current) => ({ ...current, amount: event.target.value }))} placeholder={currencyDigits(settlementForm.currency) ? "0.00" : "0"} />
              <FieldError>{fieldErrors.amount}</FieldError>
            </div>
            <div>
              <Label htmlFor="settlement-currency">Currency</Label>
              <Select id="settlement-currency" value={settlementForm.currency} onChange={(event) => setSettlementForm((current) => ({ ...current, currency: event.target.value }))}>
                {currencies.map((currency) => <option key={currency} value={currency}>{currency}</option>)}
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="settlement-date">Date</Label>
            <Input id="settlement-date" type="date" value={settlementForm.settled_on} onChange={(event) => setSettlementForm((current) => ({ ...current, settled_on: event.target.value }))} />
          </div>
          <div>
            <Label htmlFor="settlement-note">Note <span className="font-normal text-ink-faint">optional</span></Label>
            <Input id="settlement-note" value={settlementForm.note} onChange={(event) => setSettlementForm((current) => ({ ...current, note: event.target.value }))} placeholder="Cash, bank transfer…" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setSettlementDialog(false)} disabled={busy}>Cancel</Button>
            <Button type="submit" disabled={busy}>{busy ? <Spinner /> : <HandCoins size={14} />} Record repayment</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, detail }: { icon: LucideIcon; label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-line bg-paper px-4 py-3.5">
      <div className="flex items-center gap-2 text-ink-faint">
        <Icon size={14} />
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.13em]">{label}</span>
      </div>
      <p className="mt-2 text-[1.45rem] font-semibold leading-none tabular-nums">{value}</p>
      <p className="mt-1.5 truncate text-[11px] text-ink-faint">{detail}</p>
    </div>
  );
}

function blankExpense(trip: Trip, members: Member[]): ExpenseForm {
  return {
    description: "",
    amount: "",
    currency: trip.currency,
    category: "food",
    expense_date: trip.start_date,
    payer_id: members[0]?.user_id ?? "",
    group_id: "",
    note: "",
    split_mode: "equal",
    participant_ids: members.map((member) => member.user_id),
    custom_amounts: {},
  };
}

function blankSettlement(trip: Trip, members: Member[]): SettlementForm {
  return {
    from_user_id: members[0]?.user_id ?? "",
    to_user_id: members[1]?.user_id ?? "",
    amount: "",
    currency: trip.currency,
    settled_on: trip.start_date,
    note: "",
  };
}
