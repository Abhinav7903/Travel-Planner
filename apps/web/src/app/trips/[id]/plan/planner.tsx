"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Background,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeChange,
  type OnNodeDrag,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  ArrowRight,
  CalendarDays,
  FileDown,
  LayoutList,
  MapPin,
  Plus,
  Route,
  Rows3,
  Sparkles,
  X,
} from "lucide-react";
import type { ItineraryDay, ItineraryEdge, ItineraryItem, Member, Trip, TripGroup } from "@/lib/types";
import { browserApi, BrowserApiError } from "@/lib/client-api";
import { exportPlannerPDF } from "@/lib/pdf";
import { cn, errorMessage, formatDay, kindLabel, modeLabel, timeLabel } from "@/lib/utils";
import { Button, Spinner } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { ItineraryNode, type PlannerNode, type PlannerNodeData } from "./itinerary-node";
import { Inspector, type EdgeDraft, type ItemDraft } from "./inspector";

type View = "graph" | "timeline" | "list";
type Selection = { kind: "item"; id: string } | { kind: "edge"; id: string } | { kind: "new-item" } | null;

const nodeTypes = { itinerary: ItineraryNode };

export function Planner({
  trip,
  initialDays,
  groups,
  members,
  canEdit,
}: {
  trip: Trip;
  initialDays: ItineraryDay[];
  groups: TripGroup[];
  members: Member[];
  canEdit: boolean;
}) {
  const [days, setDays] = useState(initialDays);
  const [dayIndex, setDayIndex] = useState(0);
  const [filter, setFilter] = useState("all");
  const [view, setView] = useState<View>("graph");
  const [selection, setSelection] = useState<Selection>(null);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState<{ message: string; tone: "ok" | "error" } | null>(null);
  const [dayTitleEditing, setDayTitleEditing] = useState(false);
  const [dayTitle, setDayTitle] = useState("");

  const day = days[dayIndex] ?? days[0];

  useEffect(() => {
    if (window.matchMedia("(max-width: 900px)").matches) setView("timeline");
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const groupByID = useMemo(() => new Map(groups.map((group) => [group.id, group])), [groups]);
  const itemNames = useMemo(() => {
    const names = new Map<string, string>();
    for (const candidate of days) for (const item of candidate.items) names.set(item.id, item.title);
    return names;
  }, [days]);

  const visibleItems = useMemo(() => {
    if (!day) return [];
    return day.items.filter((item) => {
      if (filter === "all") return true;
      if (filter === "shared") return item.group_id === "";
      return item.group_id === "" || item.group_id === filter;
    });
  }, [day, filter]);

  const visibleIDs = useMemo(() => new Set(visibleItems.map((item) => item.id)), [visibleItems]);
  const visibleEdges = useMemo(() => {
    if (!day) return [];
    return day.edges.filter((edge) => {
      if (!visibleIDs.has(edge.from_item_id) || !visibleIDs.has(edge.to_item_id)) return false;
      if (filter === "all") return true;
      if (filter === "shared") return edge.group_id === "";
      return edge.group_id === "" || edge.group_id === filter;
    });
  }, [day, filter, visibleIDs]);

  const nodes = useMemo<PlannerNode[]>(() => {
    return visibleItems.map((item, index) => {
      const fallbackX = 80 + (index % 3) * 280;
      const fallbackY = 70 + Math.floor(index / 3) * 165;
      return {
        id: item.id,
        type: "itinerary",
        position: {
          x: item.pos_x === 0 && item.pos_y === 0 ? fallbackX : item.pos_x,
          y: item.pos_x === 0 && item.pos_y === 0 ? fallbackY : item.pos_y,
        },
        data: { item, group: groupByID.get(item.group_id), canEdit },
        selected: selection?.kind === "item" && selection.id === item.id,
      };
    });
  }, [visibleItems, groupByID, canEdit, selection]);

  const edges = useMemo<Edge[]>(() => {
    return visibleEdges.map((edge) => {
      const group = groupByID.get(edge.group_id);
      const color = group?.color ?? "#a9a496";
      return {
        id: edge.id,
        source: edge.from_item_id,
        target: edge.to_item_id,
        type: "smoothstep",
        label: `${modeLabel[edge.mode] ?? edge.mode} · ${edge.duration_minutes > 0 ? `${edge.duration_minutes} min` : "time open"}`,
        labelStyle: { fill: "#64675e", fontSize: 10, fontWeight: 500 },
        labelBgStyle: { fill: "#f9f6ef", fillOpacity: 0.92 },
        labelBgPadding: [5, 3],
        labelBgBorderRadius: 4,
        style: { stroke: color },
        selected: selection?.kind === "edge" && selection.id === edge.id,
        markerEnd: { type: MarkerType.ArrowClosed, color, width: 16, height: 16 },
      };
    });
  }, [visibleEdges, groupByID, selection]);

  const selectedItem = useMemo(() => {
    if (selection?.kind !== "item") return undefined;
    for (const candidate of days) {
      const found = candidate.items.find((item) => item.id === selection.id);
      if (found) return found;
    }
    return undefined;
  }, [days, selection]);

  const selectedEdge = useMemo(() => {
    if (selection?.kind !== "edge") return undefined;
    for (const candidate of days) {
      const found = candidate.edges.find((edge) => edge.id === selection.id);
      if (found) return found;
    }
    return undefined;
  }, [days, selection]);

  const newDraft = useMemo<ItineraryItem | undefined>(() => {
    if (selection?.kind !== "new-item" || !day) return undefined;
    return {
      id: "__new__",
      trip_id: trip.id,
      day_id: day.id,
      group_id: filter === "all" || filter === "shared" ? "" : filter,
      title: "",
      kind: "place",
      location_name: "",
      address: "",
      latitude: 0,
      longitude: 0,
      has_coordinates: false,
      start_time: "",
      end_time: "",
      notes: "",
      cost_minor: 0,
      currency: trip.currency,
      link: "",
      pos_x: 80 + (day.items.length % 3) * 280,
      pos_y: 70 + Math.floor(day.items.length / 3) * 165,
      sort_order: day.items.length,
      version: 0,
      created_at: "",
      updated_at: "",
    };
  }, [selection, day, filter, trip.id, trip.currency]);

  async function refresh() {
    try {
      const data = await browserApi<{ days: ItineraryDay[] }>(`/api/v1/trips/${trip.id}/itinerary`);
      setDays(data.days ?? []);
    } catch {
      // The visible error below is enough; a reload remains available.
    }
  }

  function showError(error: unknown) {
    setToast({ message: errorMessage(error), tone: "error" });
  }

  async function saveNewItem(draft: ItemDraft): Promise<boolean> {
    if (!day) return false;
    setBusy(true);
    try {
      const created = await browserApi<ItineraryItem>(`/api/v1/trips/${trip.id}/days/${day.id}/items`, {
        method: "POST",
        body: JSON.stringify(draft),
      });
      setDays((current) => current.map((candidate) => candidate.id === day.id ? { ...candidate, items: [...candidate.items, created] } : candidate));
      setSelection({ kind: "item", id: created.id });
      setToast({ message: "Stop added to the day.", tone: "ok" });
      return true;
    } catch (error) {
      showError(error);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function saveItem(draft: ItemDraft): Promise<boolean> {
    if (!selectedItem) return false;
    setBusy(true);
    try {
      const updated = await browserApi<ItineraryItem>(`/api/v1/trips/${trip.id}/items/${selectedItem.id}`, {
        method: "PATCH",
        body: JSON.stringify({ ...draft, version: selectedItem.version }),
      });
      setDays((current) => current.map((candidate) => ({
        ...candidate,
        items: candidate.items.map((item) => item.id === updated.id ? updated : item),
      })));
      setSelection({ kind: "item", id: updated.id });
      setToast({ message: "Stop saved.", tone: "ok" });
      return true;
    } catch (error) {
      showError(error);
      if (error instanceof BrowserApiError && error.status === 409) await refresh();
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function deleteItem(): Promise<void> {
    if (!selectedItem) return;
    setBusy(true);
    try {
      await browserApi(`/api/v1/trips/${trip.id}/items/${selectedItem.id}?version=${selectedItem.version}`, { method: "DELETE" });
      setDays((current) => current.map((candidate) => ({
        ...candidate,
        items: candidate.items.filter((item) => item.id !== selectedItem.id),
        edges: candidate.edges.filter((edge) => edge.from_item_id !== selectedItem.id && edge.to_item_id !== selectedItem.id),
      })));
      setSelection(null);
      setToast({ message: "Stop removed.", tone: "ok" });
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  }

  async function saveEdge(draft: EdgeDraft): Promise<boolean> {
    if (!selectedEdge) return false;
    setBusy(true);
    try {
      const updated = await browserApi<ItineraryEdge>(`/api/v1/trips/${trip.id}/edges/${selectedEdge.id}`, {
        method: "PATCH",
        body: JSON.stringify({ ...draft, version: selectedEdge.version }),
      });
      setDays((current) => current.map((candidate) => ({
        ...candidate,
        edges: candidate.edges.map((edge) => edge.id === updated.id ? updated : edge),
      })));
      setSelection({ kind: "edge", id: updated.id });
      setToast({ message: "Travel leg saved.", tone: "ok" });
      return true;
    } catch (error) {
      showError(error);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function deleteEdge(): Promise<void> {
    if (!selectedEdge) return;
    setBusy(true);
    try {
      await browserApi(`/api/v1/trips/${trip.id}/edges/${selectedEdge.id}?version=${selectedEdge.version}`, { method: "DELETE" });
      setDays((current) => current.map((candidate) => ({
        ...candidate,
        edges: candidate.edges.filter((edge) => edge.id !== selectedEdge.id),
      })));
      setSelection(null);
      setToast({ message: "Travel leg removed.", tone: "ok" });
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  }

  const persistPosition = useCallback(async (itemID: string, x: number, y: number) => {
    const item = days.flatMap((candidate) => candidate.items).find((candidate) => candidate.id === itemID);
    if (!item) return;
    setDays((current) => current.map((candidate) => ({
      ...candidate,
      items: candidate.items.map((entry) => entry.id === itemID ? { ...entry, pos_x: x, pos_y: y } : entry),
    })));
    try {
      const updated = await browserApi<ItineraryItem>(`/api/v1/trips/${trip.id}/items/${itemID}`, {
        method: "PATCH",
        body: JSON.stringify({
          day_id: item.day_id,
          group_id: item.group_id,
          title: item.title,
          kind: item.kind,
          location_name: item.location_name,
          address: item.address,
          latitude: item.latitude,
          longitude: item.longitude,
          has_coordinates: item.has_coordinates,
          start_time: item.start_time,
          end_time: item.end_time,
          notes: item.notes,
          cost_minor: item.cost_minor,
          currency: item.currency,
          link: item.link,
          pos_x: x,
          pos_y: y,
          sort_order: item.sort_order,
          version: item.version,
        }),
      });
      setDays((current) => current.map((candidate) => ({
        ...candidate,
        items: candidate.items.map((entry) => entry.id === itemID ? updated : entry),
      })));
    } catch (error) {
      showError(new Error("Could not save the new position. Refreshing the canvas."));
      await refresh();
    }
  }, [days, trip.id]);

  const onNodeDragStop: OnNodeDrag<PlannerNode> = useCallback((_event, node) => {
    if (!canEdit) return;
    void persistPosition(node.id, Math.round(node.position.x), Math.round(node.position.y));
  }, [canEdit, persistPosition]);

  function onConnect(connection: Connection) {
    if (!canEdit || !day) return;
    if (!connection.source || !connection.target || connection.source === connection.target) return;
    const existing = day.edges.find((edge) => edge.from_item_id === connection.source && edge.to_item_id === connection.target);
    if (existing) {
      setSelection({ kind: "edge", id: existing.id });
      return;
    }
    const from = day.items.find((item) => item.id === connection.source);
    const to = day.items.find((item) => item.id === connection.target);
    const sharedGroup = from?.group_id && from.group_id === to?.group_id ? from.group_id : "";
    void createEdge(connection.source, connection.target, sharedGroup);
  }

  async function createEdge(from: string, to: string, groupID: string) {
    if (!day) return;
    setBusy(true);
    try {
      const created = await browserApi<ItineraryEdge>(`/api/v1/trips/${trip.id}/days/${day.id}/edges`, {
        method: "POST",
        body: JSON.stringify({
          group_id: groupID,
          from_item_id: from,
          to_item_id: to,
          mode: "walk",
          duration_minutes: 0,
          distance_km: 0,
          depart_time: "",
          arrive_time: "",
          notes: "",
        }),
      });
      setDays((current) => current.map((candidate) => candidate.id === day.id ? { ...candidate, edges: [...candidate.edges, created] } : candidate));
      setSelection({ kind: "edge", id: created.id });
      setToast({ message: "Leg added. Set the travel time yourself.", tone: "ok" });
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  }

  async function exportPDF() {
    setExporting(true);
    try {
      await exportPlannerPDF({ trip, days, groups, members });
      setToast({ message: "Planner exported as a PDF.", tone: "ok" });
    } catch (error) {
      showError(error);
    } finally {
      setExporting(false);
    }
  }

  async function saveDayTitle() {
    if (!day) return;
    setBusy(true);
    try {
      await browserApi(`/api/v1/trips/${trip.id}/days/${day.id}`, {
        method: "PATCH",
        body: JSON.stringify({ title: dayTitle, version: day.version }),
      });
      setDays((current) => current.map((candidate) => candidate.id === day.id ? { ...candidate, title: dayTitle, version: candidate.version + 1 } : candidate));
      setDayTitleEditing(false);
      setToast({ message: "Day title saved.", tone: "ok" });
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  }

  if (!day) {
    return <div className="px-6 py-16 text-center text-[13px] text-ink-soft">This trip has no itinerary days yet.</div>;
  }

  const sortedItems = [...visibleItems].sort((a, b) => {
    const timeA = a.start_time || "99:99";
    const timeB = b.start_time || "99:99";
    return timeA.localeCompare(timeB) || a.sort_order - b.sort_order;
  });

  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="eyebrow">The plan</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2.5">
            {dayTitleEditing ? (
              <form
                className="flex items-center gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  void saveDayTitle();
                }}
              >
                <Input
                  autoFocus
                  value={dayTitle}
                  maxLength={120}
                  onChange={(event) => setDayTitle(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") setDayTitleEditing(false);
                  }}
                  className="h-9 w-64"
                  aria-label="Day title"
                />
                <Button type="submit" size="sm" disabled={busy}>Save</Button>
                <Button size="sm" variant="ghost" onClick={() => setDayTitleEditing(false)}>Cancel</Button>
              </form>
            ) : (
              <>
                <h2 className="display text-[1.9rem] leading-none">{day.title || `Day ${dayIndex + 1}`}</h2>
                {canEdit ? (
                  <button
                    type="button"
                    onClick={() => {
                      setDayTitle(day.title);
                      setDayTitleEditing(true);
                    }}
                    className="rounded-md px-1.5 py-1 text-[10.5px] font-medium text-ink-faint hover:bg-[#ece7dc] hover:text-ink"
                  >
                    Rename day
                  </button>
                ) : null}
              </>
            )}
          </div>
          <p className="mt-2 flex items-center gap-1.5 text-[12px] text-ink-soft">
            <CalendarDays size={12} /> {formatDay(day.date, "EEEE, MMMM d, yyyy")}
            <span className="mx-1 text-line-strong">·</span>
            {visibleItems.length} {visibleItems.length === 1 ? "stop" : "stops"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={() => void exportPDF()} disabled={exporting}>
            {exporting ? <Spinner /> : <FileDown size={15} />} Export planner
          </Button>
          {canEdit ? (
            <Button onClick={() => setSelection({ kind: "new-item" })}>
              <Plus size={15} /> Add stop
            </Button>
          ) : null}
        </div>
      </div>

      <div className="mt-5 scroll-thin flex gap-2 overflow-x-auto pb-1">
        {days.map((candidate, index) => (
          <button
            key={candidate.id}
            type="button"
            onClick={() => {
              setDayIndex(index);
              setSelection(null);
              setDayTitleEditing(false);
            }}
            className={cn(
              "min-w-[132px] rounded-xl border px-3.5 py-2.5 text-left transition-colors",
              index === dayIndex
                ? "border-forest bg-forest-soft text-forest"
                : "border-line bg-paper text-ink-soft hover:border-line-strong hover:bg-[#f9f6ef]",
            )}
            aria-current={index === dayIndex ? "true" : undefined}
          >
            <span className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.08em]">
              Day {String(index + 1).padStart(2, "0")}
              <span className={index === dayIndex ? "text-forest/70" : "text-ink-faint"}>{candidate.items.length}</span>
            </span>
            <span className="mt-1 block truncate text-[12.5px] font-medium">{formatDay(candidate.date, "EEE, MMM d")}</span>
            {candidate.title ? <span className="mt-0.5 block truncate text-[10px] opacity-70">{candidate.title}</span> : null}
          </button>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-y border-line py-2.5">
        <div className="flex items-center gap-1 rounded-lg bg-[#ece7dc]/80 p-1">
          {[
            { value: "graph" as const, label: "Graph", icon: Route },
            { value: "timeline" as const, label: "Timeline", icon: Rows3 },
            { value: "list" as const, label: "List", icon: LayoutList },
          ].map((option) => {
            const Icon = option.icon;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setView(option.value)}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11.5px] font-medium transition-colors",
                  view === option.value ? "bg-paper text-ink shadow-sm" : "text-ink-soft hover:text-ink",
                )}
                aria-pressed={view === option.value}
              >
                <Icon size={13} /> <span className="hidden sm:inline">{option.label}</span>
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-3">
          {groups.length > 0 ? (
            <div className="flex items-center gap-2">
              <span className="hidden text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-faint sm:inline">Show</span>
              <select
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                className="h-8 rounded-lg border border-line-strong bg-paper px-2.5 text-[11.5px] text-ink focus:border-forest focus:outline-none"
                aria-label="Filter itinerary by group"
              >
                <option value="all">Everyone & groups</option>
                <option value="shared">Everyone only</option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>{group.name}</option>
                ))}
              </select>
            </div>
          ) : null}
          {groups.length > 0 ? (
            <div className="hidden items-center gap-2 sm:flex">
              {groups.slice(0, 3).map((group) => (
                <span key={group.id} className="flex items-center gap-1 text-[10px] text-ink-soft">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: group.color }} />
                  {group.name.split(" ")[0]}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className={cn("mt-4 grid gap-4", selection ? "xl:grid-cols-[minmax(0,1fr)_352px]" : "grid-cols-1")}>
        <div className="min-w-0">
          {visibleItems.length === 0 && view !== "graph" ? (
            <EmptyState
              icon={<MapPin size={19} />}
              title={filter === "all" ? "This day is still open" : "Nothing in this view yet"}
              description={
                filter === "all"
                  ? "Add the first place, meal or slow afternoon. The route can stay loose."
                  : "Try another group filter, or add a stop for this group."
              }
              action={canEdit ? <Button onClick={() => setSelection({ kind: "new-item" })}><Plus size={14} /> Add a stop</Button> : undefined}
            />
          ) : view === "graph" ? (
            <div className="relative h-[560px] w-full overflow-hidden rounded-2xl border border-line bg-[#f9f6ef] sm:h-[620px]">
              <ReactFlow
                key={`${day.id}-${filter}`}
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                onNodeClick={(_event, node) => setSelection({ kind: "item", id: node.id })}
                onEdgeClick={(_event, edge) => setSelection({ kind: "edge", id: edge.id })}
                onPaneClick={() => setSelection(null)}
                onNodeDragStop={onNodeDragStop}
                onConnect={onConnect}
                nodesDraggable={canEdit}
                nodesConnectable={canEdit}
                edgesReconnectable={false}
                elementsSelectable
                fitView
                fitViewOptions={{ padding: 0.22, maxZoom: 1.15 }}
                minZoom={0.25}
                maxZoom={1.6}
                connectOnClick={canEdit}
                proOptions={{ hideAttribution: false }}
                className="h-full w-full"
              >
                <Background color="#d8d2c4" gap={20} size={1} />
                <Controls showInteractive={false} position="bottom-left" />
                <MiniMap
                  pannable
                  zoomable
                  nodeColor={(node) => {
                    const data = node.data as PlannerNodeData | undefined;
                    return data?.group?.color ?? "#d5cfc1";
                  }}
                  maskColor="rgba(249,246,239,.72)"
                  position="bottom-right"
                />
              </ReactFlow>
              <div className="pointer-events-none absolute left-1/2 top-4 z-10 -translate-x-1/2 rounded-full border border-line bg-paper/90 px-3 py-1 text-[10.5px] text-ink-soft shadow-sm backdrop-blur">
                {canEdit ? "Drag stops to arrange · connect a stop to several for alternate routes" : "Drag to explore · view only"}
              </div>
              {visibleItems.length === 0 ? (
                <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
                  <div className="pointer-events-auto rounded-2xl border border-line bg-paper/95 p-6 text-center shadow-lg">
                    <p className="display text-[1.35rem]">An open day</p>
                    <p className="mt-1 max-w-[240px] text-[11.5px] leading-relaxed text-ink-soft">
                      Nothing fixed yet. Add a first stop and let the shape emerge.
                    </p>
                    {canEdit ? (
                      <Button size="sm" className="mt-4" onClick={() => setSelection({ kind: "new-item" })}>
                        <Plus size={13} /> Add first stop
                      </Button>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          ) : view === "timeline" ? (
            <Timeline
              items={sortedItems}
              edges={visibleEdges}
              groups={groupByID}
              selectedID={selection?.kind === "item" ? selection.id : selection?.kind === "edge" ? selection.id : undefined}
              canEdit={canEdit}
              onSelectItem={(id) => setSelection({ kind: "item", id })}
              onSelectEdge={(id) => setSelection({ kind: "edge", id })}
              onAdd={() => setSelection({ kind: "new-item" })}
            />
          ) : (
            <div className="overflow-hidden rounded-2xl border border-line bg-paper">
              <div className="hidden grid-cols-[80px_1fr_150px_110px] gap-3 border-b border-line bg-[#f7f3ea] px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-faint sm:grid">
                <span>Time</span>
                <span>Stop</span>
                <span>Place</span>
                <span>Group</span>
              </div>
              {sortedItems.map((item) => {
                const group = groupByID.get(item.group_id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelection({ kind: "item", id: item.id })}
                    className={cn(
                      "grid w-full grid-cols-[64px_1fr] items-center gap-3 border-b border-line px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-[#f9f6ef] sm:grid-cols-[80px_1fr_150px_110px]",
                      selection?.kind === "item" && selection.id === item.id && "bg-forest-soft/50",
                    )}
                  >
                    <span className="text-[11.5px] font-semibold tabular-nums text-ink-soft">{item.start_time || "Open"}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-medium">{item.title}</span>
                      <span className="mt-0.5 block text-[10.5px] text-ink-faint sm:hidden">{item.location_name || kindLabel[item.kind]}</span>
                    </span>
                    <span className="hidden truncate text-[11.5px] text-ink-soft sm:block">{item.location_name || "—"}</span>
                    <span className="hidden sm:block">
                      {group ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f1ede3] px-2 py-0.5 text-[10px] font-medium text-ink-soft">
                          <span className="h-1.5 w-1.5 rounded-full" style={{ background: group.color }} />
                          {group.name}
                        </span>
                      ) : (
                        <span className="text-[10.5px] text-ink-faint">Everyone</span>
                      )}
                    </span>
                  </button>
                );
              })}
              {sortedItems.length === 0 ? (
                <div className="px-4 py-10 text-center text-[12px] text-ink-faint">No stops in this view.</div>
              ) : null}
            </div>
          )}

          {view === "graph" && visibleEdges.length === 0 && visibleItems.length > 1 ? (
            <p className="mt-2.5 flex items-center gap-1.5 text-[11px] text-ink-faint">
              <Sparkles size={12} /> Connect two stops to record a travel leg and its honest timing.
            </p>
          ) : null}
        </div>

        {selection ? (
          <aside className="min-h-[420px] overflow-hidden rounded-2xl border border-line bg-paper shadow-[var(--shadow-soft)] xl:sticky xl:top-4 xl:h-[calc(100vh-2rem)] xl:max-h-[760px]">
            {selection.kind === "edge" && selectedEdge ? (
              <Inspector
                edge={selectedEdge}
                groups={groups}
                currency={trip.currency}
                canEdit={canEdit}
                itemNames={itemNames}
                busy={busy}
                onSaveEdge={saveEdge}
                onDelete={deleteEdge}
                onClose={() => setSelection(null)}
              />
            ) : selection.kind === "new-item" && newDraft ? (
              <Inspector
                item={newDraft}
                isNew
                groups={groups}
                currency={trip.currency}
                canEdit={canEdit}
                itemNames={itemNames}
                busy={busy}
                onSaveItem={saveNewItem}
                onClose={() => setSelection(null)}
              />
            ) : selectedItem ? (
              <Inspector
                item={selectedItem}
                groups={groups}
                currency={trip.currency}
                canEdit={canEdit}
                itemNames={itemNames}
                busy={busy}
                onSaveItem={saveItem}
                onDelete={deleteItem}
                onClose={() => setSelection(null)}
              />
            ) : (
              <div className="flex h-full min-h-[420px] items-center justify-center p-6 text-center">
                <div>
                  <p className="text-[12px] text-ink-faint">This stop was removed.</p>
                  <Button variant="ghost" size="sm" className="mt-2" onClick={() => setSelection(null)}>Close</Button>
                </div>
              </div>
            )}
          </aside>
        ) : null}
      </div>

      {toast ? (
        <div
          role="status"
          className={cn(
            "fixed bottom-5 right-5 z-50 flex max-w-sm items-center gap-3 rounded-xl border px-4 py-3 text-[12.5px] shadow-[var(--shadow-lift)]",
            toast.tone === "ok" ? "border-forest/20 bg-forest text-paper" : "border-[#e2c9bc] bg-[#fbf1eb] text-[#8f4529]",
          )}
        >
          {toast.message}
          <button type="button" onClick={() => setToast(null)} aria-label="Dismiss message" className="opacity-70 hover:opacity-100">
            <X size={13} />
          </button>
        </div>
      ) : null}
    </div>
  );
}

function Timeline({
  items,
  edges,
  groups,
  selectedID,
  canEdit,
  onSelectItem,
  onSelectEdge,
  onAdd,
}: {
  items: ItineraryItem[];
  edges: ItineraryEdge[];
  groups: Map<string, TripGroup>;
  selectedID?: string;
  canEdit: boolean;
  onSelectItem: (id: string) => void;
  onSelectEdge: (id: string) => void;
  onAdd: () => void;
}) {
  return (
    <div className="rounded-2xl border border-line bg-paper px-5 py-6 sm:px-7">
      <div className="relative">
        {items.map((item, index) => {
          const next = items[index + 1];
          const edge = next ? edges.find((candidate) => candidate.from_item_id === item.id && candidate.to_item_id === next.id) : undefined;
          const group = groups.get(item.group_id);
          return (
            <div key={item.id}>
              <button
                type="button"
                onClick={() => onSelectItem(item.id)}
                className={cn(
                  "group relative flex w-full items-start gap-4 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-[#f7f3ea]",
                  selectedID === item.id && "bg-forest-soft/60",
                )}
              >
                <span className="w-[54px] shrink-0 pt-1 text-right text-[11px] font-semibold tabular-nums text-ink-soft">
                  {item.start_time || "—"}
                </span>
                <span className="relative mt-1.5 flex h-3 w-3 shrink-0 items-center justify-center">
                  <span className="h-2.5 w-2.5 rounded-full border-2 border-paper" style={{ background: group?.color ?? "#8ea092" }} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-[14px] font-semibold">{item.title}</span>
                    {group ? <Badge tone="outline">{group.name}</Badge> : null}
                  </span>
                  <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-soft">
                    <span>{kindLabel[item.kind]}</span>
                    {item.location_name ? <span className="flex items-center gap-1"><MapPin size={10} /> {item.location_name}</span> : null}
                    {item.start_time && item.end_time ? <span>{timeLabel(item.start_time)} – {timeLabel(item.end_time)}</span> : null}
                  </span>
                  {item.notes ? <span className="mt-1.5 block line-clamp-2 text-[11px] leading-relaxed text-ink-faint">{item.notes}</span> : null}
                </span>
                <ArrowRight size={14} className="mt-1.5 shrink-0 text-ink-faint opacity-0 transition-opacity group-hover:opacity-100" />
              </button>
              {next ? (
                <button
                  type="button"
                  onClick={() => edge && onSelectEdge(edge.id)}
                  disabled={!edge}
                  className={cn(
                    "ml-[74px] flex items-center gap-2 border-l border-dashed border-line-strong py-2 pl-4 text-left text-[10.5px] transition-colors",
                    edge ? "text-ink-faint hover:text-forest" : "cursor-default text-ink-faint/70",
                  )}
                >
                  <span className={cn("-ml-[19px] h-px w-3", edge ? "bg-line-strong" : "bg-line")} />
                  {edge ? (
                    <>
                      {modeLabel[edge.mode] ?? edge.mode} · {edge.duration_minutes > 0 ? `${edge.duration_minutes} min` : "time open"}
                      {edge.distance_km > 0 ? ` · ${edge.distance_km} km` : ""}
                      <span className="text-forest/70">Edit leg</span>
                    </>
                  ) : (
                    "No leg recorded between these stops"
                  )}
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
      {canEdit ? (
        <button
          type="button"
          onClick={onAdd}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-line-strong py-3 text-[12px] font-medium text-ink-soft transition-colors hover:border-forest hover:bg-forest-soft/40 hover:text-forest"
        >
          <Plus size={14} /> Add a stop to this day
        </button>
      ) : null}
    </div>
  );
}
