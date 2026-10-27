"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Compass, LogOut, Menu, Settings, X } from "lucide-react";
import type { User } from "@/lib/types";
import { browserApi } from "@/lib/client-api";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/brand";
import { Avatar } from "@/components/ui/avatar";
import { Button, Spinner } from "@/components/ui/button";

const nav = [
  { href: "/trips", label: "Trips", icon: Compass },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({ user, children }: { user: User; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    setSigningOut(true);
    try {
      await browserApi("/api/v1/auth/logout", { method: "POST", body: "{}" });
    } finally {
      router.push("/");
      router.refresh();
    }
  }

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="px-6 pb-8 pt-6">
        <Logo href="/trips" />
      </div>
      <nav className="flex flex-col gap-1 px-3" aria-label="Main">
        {nav.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMenuOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium transition-colors",
                active ? "bg-forest-soft text-forest" : "text-ink-soft hover:bg-[#efeae0] hover:text-ink",
              )}
            >
              <Icon size={17} strokeWidth={1.8} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto border-t border-line p-3">
        <div className="flex items-center gap-3 rounded-xl px-2 py-2">
          <Avatar name={user.display_name} id={user.id} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold">{user.display_name}</p>
            <p className="truncate text-[11px] text-ink-faint">{user.email}</p>
          </div>
          <button
            type="button"
            onClick={signOut}
            disabled={signingOut}
            className="rounded-lg p-2 text-ink-faint transition-colors hover:bg-[#efeae0] hover:text-ink disabled:opacity-50"
            aria-label="Sign out"
            title="Sign out"
          >
            {signingOut ? <Spinner /> : <LogOut size={15} />}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="sticky top-0 hidden h-screen border-r border-line bg-[#f9f6ef] lg:block">{sidebar}</aside>

      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-canvas/90 px-4 backdrop-blur lg:hidden">
        <Logo href="/trips" />
        <Button variant="ghost" size="icon" onClick={() => setMenuOpen(true)} aria-label="Open menu">
          <Menu size={19} />
        </Button>
      </header>

      {menuOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            className="absolute inset-0 bg-ink/30 backdrop-blur-[2px]"
            onClick={() => setMenuOpen(false)}
            aria-label="Close menu"
          />
          <div className="absolute inset-y-0 left-0 w-[290px] border-r border-line bg-[#f9f6ef] shadow-2xl">
            <button
              className="absolute right-3 top-3 rounded-lg p-2 text-ink-soft hover:bg-[#efeae0]"
              onClick={() => setMenuOpen(false)}
              aria-label="Close menu"
            >
              <X size={17} />
            </button>
            {sidebar}
          </div>
        </div>
      ) : null}

      <main className="min-w-0 pb-20 lg:pb-0">{children}</main>
    </div>
  );
}
