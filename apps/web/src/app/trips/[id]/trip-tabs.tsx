"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Map, NotebookPen, Route, Settings, Users, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { segment: "plan", label: "Itinerary", icon: Route },
  { segment: "map", label: "Map", icon: Map },
  { segment: "notes", label: "Notes", icon: NotebookPen },
  { segment: "money", label: "Money", icon: Wallet },
  { segment: "people", label: "People", icon: Users },
  { segment: "settings", label: "Settings", icon: Settings },
];

export function TripTabs({ tripID, role }: { tripID: string; role: string }) {
  const pathname = usePathname();
  return (
    <nav className="scroll-thin overflow-x-auto px-2 sm:px-5" aria-label="Trip sections">
      <div className="flex min-w-max items-center gap-1">
        {tabs.map((tab) => {
          const href = `/trips/${tripID}/${tab.segment}`;
          const active = pathname === href || pathname.startsWith(`${href}/`);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.segment}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex items-center gap-2 px-3.5 py-3 text-[12.5px] font-medium transition-colors sm:px-4",
                active ? "text-forest" : "text-ink-soft hover:text-ink",
              )}
            >
              <Icon size={14} strokeWidth={1.8} />
              {tab.label}
              {tab.segment === "settings" && role !== "owner" ? null : null}
              {active ? <span className="absolute inset-x-3 bottom-0 h-[2px] rounded-full bg-forest" /> : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
