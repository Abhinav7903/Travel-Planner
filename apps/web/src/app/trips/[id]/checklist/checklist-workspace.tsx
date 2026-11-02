"use client";

import { useId, useMemo, useState } from "react";
import {
  Check,
  CheckSquare,
  Compass,
  FileText,
  HeartPulse,
  PackageCheck,
  Plus,
  RotateCcw,
  Shirt,
  Smartphone,
  Sparkles,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import type { Member, Trip } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";

export type ChecklistCategory = "clothing" | "documents" | "toiletries" | "electronics" | "misc";

export type ChecklistItem = {
  id: string;
  title: string;
  category: ChecklistCategory;
  packed: boolean;
  assignee?: string;
};

const categoryMeta: Record<ChecklistCategory, { label: string; icon: LucideIcon; color: string }> = {
  clothing: { label: "Clothing & Apparel", icon: Shirt, color: "#d97706" },
  documents: { label: "Documents & Money", icon: FileText, color: "#2563eb" },
  toiletries: { label: "Toiletries & Health", icon: HeartPulse, color: "#059669" },
  electronics: { label: "Tech & Gear", icon: Smartphone, color: "#7c3aed" },
  misc: { label: "Miscellaneous", icon: Compass, color: "#64748b" },
};

export type TemplateKey = "essentials" | "international" | "beach" | "winter";

const PRESET_TEMPLATES: Record<
  TemplateKey,
  { name: string; description: string; items: { title: string; category: ChecklistCategory }[] }
> = {
  essentials: {
    name: "Trip Essentials",
    description: "Must-haves for any general journey",
    items: [
      { title: "Passport / Government Photo ID", category: "documents" },
      { title: "Wallet, payment cards & emergency cash", category: "documents" },
      { title: "Phone charger & charging cable", category: "electronics" },
      { title: "Portable power bank", category: "electronics" },
      { title: "Toothbrush, paste & dental floss", category: "toiletries" },
      { title: "Personal prescriptions & daily medications", category: "toiletries" },
      { title: "Daily outfits & undergarments", category: "clothing" },
      { title: "Comfortable walking shoes", category: "clothing" },
      { title: "Reusable water bottle", category: "misc" },
    ],
  },
  international: {
    name: "International Travel",
    description: "Passports, adapters, and travel documentation",
    items: [
      { title: "Passport (valid for 6+ months) & visa", category: "documents" },
      { title: "Travel insurance policy & emergency contacts", category: "documents" },
      { title: "Universal plug adapter", category: "electronics" },
      { title: "Noise-cancelling headphones", category: "electronics" },
      { title: "Local currency / no-foreign-fee cards", category: "documents" },
      { title: "Luggage locks & luggage tags", category: "misc" },
      { title: "Neck pillow & eye mask", category: "misc" },
      { title: "Mini first aid kit & motion sickness pills", category: "toiletries" },
    ],
  },
  beach: {
    name: "Beach & Warm Weather",
    description: "Sun, swim, and warm sunny days",
    items: [
      { title: "Swimwear (2 pairs)", category: "clothing" },
      { title: "High-SPF sunscreen & soothing after-sun gel", category: "toiletries" },
      { title: "UV-blocking sunglasses & sun hat", category: "clothing" },
      { title: "Quick-dry beach towel", category: "misc" },
      { title: "Waterproof phone pouch / dry bag", category: "electronics" },
      { title: "Breathable linen shirts & shorts", category: "clothing" },
      { title: "Comfortable sandals or water shoes", category: "clothing" },
      { title: "Bug spray / mosquito repellent", category: "toiletries" },
    ],
  },
  winter: {
    name: "Cold & Winter",
    description: "Thermal layers, snow gear, and cold weather essentials",
    items: [
      { title: "Thermal base layers (tops & bottoms)", category: "clothing" },
      { title: "Insulated waterproof winter jacket", category: "clothing" },
      { title: "Warm beanie, wool scarf & thermal gloves", category: "clothing" },
      { title: "Merino wool socks & waterproof snow boots", category: "clothing" },
      { title: "Heavy-duty moisturizer & SPF lip balm", category: "toiletries" },
      { title: "Disposable hand & toe warmers", category: "misc" },
    ],
  },
};

export function ChecklistWorkspace({
  trip,
  members,
  canEdit,
}: {
  trip: Trip;
  members: Member[];
  canEdit: boolean;
}) {
  const storageKey = `wf_trip_checklist_${trip.id}`;

  const [items, setItems] = useState<ChecklistItem[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    // Default preset
    return PRESET_TEMPLATES.essentials.items.map((it, idx) => ({
      id: `item-${idx + 1}`,
      title: it.title,
      category: it.category,
      packed: false,
    }));
  });

  const [activeTab, setActiveTab] = useState<ChecklistCategory | "all">("all");
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState<ChecklistCategory>("clothing");
  const [newAssignee, setNewAssignee] = useState("");
  const [templateOpen, setTemplateOpen] = useState(false);

  const fallbackId = useId();

  function updateItems(newItems: ChecklistItem[]) {
    setItems(newItems);
    try {
      localStorage.setItem(storageKey, JSON.stringify(newItems));
    } catch {
      // ignore
    }
  }

  function handleToggle(id: string) {
    if (!canEdit) return;
    updateItems(
      items.map((item) => (item.id === id ? { ...item, packed: !item.packed } : item)),
    );
  }

  function handleDelete(id: string) {
    if (!canEdit) return;
    updateItems(items.filter((item) => item.id !== id));
  }

  function handleAddItem(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    const newItem: ChecklistItem = {
      id: `user-${Date.now()}-${fallbackId}`,
      title: newTitle.trim(),
      category: newCategory,
      packed: false,
      assignee: newAssignee || undefined,
    };
    updateItems([...items, newItem]);
    setNewTitle("");
  }

  function applyTemplate(key: TemplateKey, mode: "append" | "replace") {
    const tmpl = PRESET_TEMPLATES[key];
    if (!tmpl) return;
    const fresh = tmpl.items.map((it, idx) => ({
      id: `tmpl-${Date.now()}-${idx}`,
      title: it.title,
      category: it.category,
      packed: false,
    }));

    if (mode === "replace") {
      updateItems(fresh);
    } else {
      updateItems([...items, ...fresh]);
    }
    setTemplateOpen(false);
  }

  function resetAll() {
    if (!confirm("Uncheck all items?")) return;
    updateItems(items.map((i) => ({ ...i, packed: false })));
  }

  function clearPacked() {
    if (!confirm("Remove all packed items?")) return;
    updateItems(items.filter((i) => !i.packed));
  }

  const packedCount = useMemo(() => items.filter((i) => i.packed).length, [items]);
  const progressPct = items.length > 0 ? Math.round((packedCount / items.length) * 100) : 0;

  const filteredItems = useMemo(() => {
    if (activeTab === "all") return items;
    return items.filter((i) => i.category === activeTab);
  }, [items, activeTab]);

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-7 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="eyebrow">Packing & Prep</p>
          <h2 className="display mt-1.5 text-[2rem] leading-none">Pack light. Travel easy.</h2>
          <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-ink-soft">
            Keep track of essentials, gear, and documents so nothing gets left behind.
          </p>
        </div>

        {canEdit ? (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setTemplateOpen(!templateOpen)}
            >
              <Sparkles size={14} /> Templates
            </Button>
            {packedCount > 0 ? (
              <Button variant="ghost" size="sm" onClick={resetAll} title="Uncheck all items">
                <RotateCcw size={14} /> Uncheck all
              </Button>
            ) : null}
            {packedCount > 0 ? (
              <Button variant="ghost" size="sm" onClick={clearPacked} title="Remove packed items">
                <Trash2 size={14} /> Clear packed
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Template picker drawer / card */}
      {templateOpen ? (
        <div className="mt-6 rounded-2xl border border-line bg-paper p-5 sm:p-6">
          <div className="flex items-center justify-between border-b border-line pb-3">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-forest" />
              <h3 className="text-[13.5px] font-semibold">Packing List Templates</h3>
            </div>
            <button
              type="button"
              onClick={() => setTemplateOpen(false)}
              className="text-[12px] text-ink-faint hover:text-ink"
            >
              Close
            </button>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Object.entries(PRESET_TEMPLATES).map(([k, t]) => (
              <div
                key={k}
                className="flex flex-col justify-between rounded-xl border border-line bg-[#faf8f2] p-3.5"
              >
                <div>
                  <h4 className="text-[13px] font-semibold text-ink">{t.name}</h4>
                  <p className="mt-1 text-[11.5px] leading-relaxed text-ink-soft">
                    {t.description} ({t.items.length} items)
                  </p>
                </div>
                <div className="mt-3 flex gap-2 pt-2 border-t border-line/60">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-7 text-[11px] flex-1"
                    onClick={() => applyTemplate(k as TemplateKey, "append")}
                  >
                    + Add to list
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-[11px]"
                    onClick={() => applyTemplate(k as TemplateKey, "replace")}
                    title="Replace entire list with this template"
                  >
                    Replace
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Progress Card */}
      <div className="mt-6 rounded-2xl border border-line bg-paper p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-forest-soft text-forest">
              <PackageCheck size={18} />
            </span>
            <div>
              <p className="text-[14px] font-semibold">
                {packedCount} of {items.length} packed
              </p>
              <p className="text-[12px] text-ink-soft">
                {items.length === 0
                  ? "List is empty"
                  : progressPct === 100
                  ? "All packed and ready for departure!"
                  : `${progressPct}% complete`}
              </p>
            </div>
          </div>

          <span
            className={`rounded-full px-3 py-1 text-[12px] font-semibold tabular-nums ${
              progressPct === 100
                ? "bg-forest-soft text-forest"
                : "bg-sand text-ink-soft"
            }`}
          >
            {progressPct}%
          </span>
        </div>

        {items.length > 0 ? (
          <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-sand">
            <div
              className={`h-full transition-all duration-300 ${
                progressPct === 100 ? "bg-forest" : "bg-forest"
              }`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        ) : null}
      </div>

      {/* Category Tabs */}
      <div className="mt-6 flex flex-wrap items-center gap-1.5 border-b border-line pb-3">
        <button
          type="button"
          onClick={() => setActiveTab("all")}
          className={`rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
            activeTab === "all"
              ? "bg-forest text-white"
              : "bg-sand text-ink-soft hover:text-ink"
          }`}
        >
          All ({items.length})
        </button>
        {(Object.keys(categoryMeta) as ChecklistCategory[]).map((cat) => {
          const count = items.filter((i) => i.category === cat).length;
          const meta = categoryMeta[cat];
          const Icon = meta.icon;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveTab(cat)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
                activeTab === cat
                  ? "bg-forest text-white"
                  : "bg-sand text-ink-soft hover:text-ink"
              }`}
            >
              <Icon size={13} />
              {meta.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Add Item form */}
      {canEdit ? (
        <form
          onSubmit={handleAddItem}
          className="mt-4 flex flex-col gap-2 rounded-xl border border-line bg-paper p-3 sm:flex-row sm:items-center"
        >
          <Input
            type="text"
            placeholder="Add an item (e.g. Passport, Rain jacket, Camera charger...)"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="h-9 flex-1 text-[13px]"
          />
          <div className="flex gap-2">
            <Select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value as ChecklistCategory)}
              className="h-9 text-[12.5px]"
            >
              {(Object.keys(categoryMeta) as ChecklistCategory[]).map((cat) => (
                <option key={cat} value={cat}>
                  {categoryMeta[cat].label}
                </option>
              ))}
            </Select>

            {members.length > 0 ? (
              <Select
                value={newAssignee}
                onChange={(e) => setNewAssignee(e.target.value)}
                className="h-9 text-[12.5px]"
              >
                <option value="">Anyone</option>
                {members.map((m) => (
                  <option key={m.user_id} value={m.display_name}>
                    {m.display_name}
                  </option>
                ))}
              </Select>
            ) : null}

            <Button type="submit" size="sm" className="h-9 px-4">
              <Plus size={15} /> Add
            </Button>
          </div>
        </form>
      ) : null}

      {/* Items List */}
      <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-paper">
        {filteredItems.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={<CheckSquare size={20} />}
              title="No items in this section"
              description="Add an item above or load one of our ready-to-use packing templates."
              action={
                canEdit ? (
                  <Button size="sm" onClick={() => applyTemplate("essentials", "replace")}>
                    <Sparkles size={14} /> Load Essentials
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {filteredItems.map((item) => {
              const meta = categoryMeta[item.category];
              const Icon = meta.icon;
              return (
                <li
                  key={item.id}
                  className={`group flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-[#faf7f0] sm:px-5 ${
                    item.packed ? "bg-[#fbf9f4]" : ""
                  }`}
                >
                  <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={item.packed}
                      disabled={!canEdit}
                      onClick={() => handleToggle(item.id)}
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
                        item.packed
                          ? "border-forest bg-forest text-white"
                          : "border-line bg-paper hover:border-ink-soft"
                      }`}
                    >
                      {item.packed ? <Check size={13} strokeWidth={3} /> : null}
                    </button>

                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-[13.5px] transition-colors ${
                          item.packed
                            ? "text-ink-faint line-through"
                            : "font-medium text-ink"
                        }`}
                      >
                        {item.title}
                      </p>
                      <div className="mt-0.5 flex items-center gap-2 text-[11px] text-ink-faint">
                        <span className="inline-flex items-center gap-1">
                          <Icon size={11} /> {meta.label}
                        </span>
                        {item.assignee ? (
                          <>
                            <span>·</span>
                            <span className="rounded-full bg-sand px-1.5 py-0.2 text-[10px] text-ink-soft">
                              {item.assignee}
                            </span>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </label>

                  {canEdit ? (
                    <button
                      type="button"
                      onClick={() => handleDelete(item.id)}
                      title="Remove item"
                      className="opacity-0 transition-opacity hover:text-[#b91c1c] group-hover:opacity-100 p-1 text-ink-faint"
                    >
                      <Trash2 size={14} />
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
