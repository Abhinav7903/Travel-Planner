"use client";

import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { BedDouble, Camera, Coffee, Lightbulb, MapPin, TrainFront, UtensilsCrossed } from "lucide-react";
import type { ItineraryItem, TripGroup } from "@/lib/types";
import { cn, kindLabel, timeLabel } from "@/lib/utils";

export type PlannerNodeData = {
  item: ItineraryItem;
  group?: TripGroup;
  canEdit: boolean;
  [key: string]: unknown;
};

export type PlannerNode = Node<PlannerNodeData, "itinerary">;

const kindIcon = {
  place: MapPin,
  activity: Camera,
  meal: UtensilsCrossed,
  transport: TrainFront,
  stay: BedDouble,
  note: Lightbulb,
} as const;

export function ItineraryNode({ data, selected }: NodeProps<PlannerNode>) {
  const { item, group } = data;
  const Icon = kindIcon[item.kind] ?? Coffee;
  return (
    <div
      className={cn(
        "wf-node relative w-[218px] rounded-2xl border border-line-strong bg-paper px-3.5 py-3 text-left shadow-[0_2px_10px_rgba(37,39,33,.06)] transition-shadow",
        selected && "border-forest",
      )}
      style={group ? { borderLeftColor: group.color, borderLeftWidth: 3 } : undefined}
    >
      <Handle type="target" position={Position.Left} className="!bg-forest" />
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-faint">
          <Icon size={11} /> {kindLabel[item.kind] ?? "Stop"}
        </span>
        <span className="rounded-full bg-[#f1ede3] px-1.5 py-0.5 text-[9.5px] font-semibold tabular-nums text-ink-soft">
          {item.start_time || "Open"}
        </span>
      </div>
      <p className="mt-1.5 line-clamp-2 text-[13px] font-semibold leading-snug text-ink">{item.title}</p>
      {item.location_name ? (
        <p className="mt-1 flex items-center gap-1 truncate text-[10.5px] text-ink-soft">
          <MapPin size={9} className="shrink-0" /> {item.location_name}
        </p>
      ) : null}
      <div className="mt-2 flex items-center justify-between gap-2 border-t border-line/80 pt-1.5">
        <span className="truncate text-[9.5px] text-ink-faint">
          {group ? group.name : item.start_time ? timeLabel(item.start_time) : "Unscheduled"}
        </span>
        {group ? <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: group.color }} /> : null}
      </div>
      <Handle type="source" position={Position.Right} className="!bg-forest" />
    </div>
  );
}
