import { redirect } from "next/navigation";
import Link from "next/link";
import { KeyRound, Map, ShieldCheck, Sparkles } from "lucide-react";
import { getSessionUser } from "@/lib/api";
import { AppShell } from "@/components/app-shell";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { SignOutButton } from "./sign-out-button";

export const metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/settings");

  return (
    <AppShell user={user}>
      <div className="mx-auto w-full max-w-[1000px] px-4 py-8 sm:px-6 lg:px-8">
        <p className="eyebrow">Account</p>
        <h1 className="display mt-1.5 text-[2.1rem] leading-none">Your corner of Wayfarer.</h1>
        <p className="mt-2 text-[13px] text-ink-soft">Passwordless by design. Your email is the only key.</p>

        <div className="mt-7 grid gap-4 md:grid-cols-2">
          <section className="rounded-2xl border border-line bg-paper p-5">
            <div className="flex items-start gap-3.5">
              <Avatar name={user.display_name} size="lg" />
              <div className="min-w-0">
                <h2 className="truncate text-[16px] font-semibold">{user.display_name}</h2>
                <p className="truncate text-[12px] text-ink-faint">{user.email}</p>
                <Badge tone="forest" className="mt-2"><ShieldCheck size={10} /> Verified email</Badge>
              </div>
            </div>
            <p className="mt-4 border-t border-line pt-4 text-[11.5px] leading-relaxed text-ink-soft">
              Display names come from your email and keep planning friendly. There is no password to manage or leak.
            </p>
          </section>

          <section className="rounded-2xl border border-line bg-paper p-5">
            <h2 className="flex items-center gap-1.5 text-[13.5px] font-semibold"><KeyRound size={14} /> Session</h2>
            <p className="mt-2 text-[11.5px] leading-relaxed text-ink-soft">
              You are signed in in this browser. Sessions use an opaque, HttpOnly cookie stored as a hash on the server. They can be revoked at logout.
            </p>
            <div className="mt-4 border-t border-line pt-4">
              <SignOutButton />
            </div>
          </section>

          <section className="rounded-2xl border border-line bg-[#fbf8f1] p-5">
            <h2 className="flex items-center gap-1.5 text-[13.5px] font-semibold"><Map size={14} /> Your trips</h2>
            <p className="mt-2 text-[11.5px] leading-relaxed text-ink-soft">
              Pick up where you left off, or begin a new itinerary from the dashboard.
            </p>
            <Link href="/trips" className="mt-4 inline-flex h-9 items-center rounded-xl border border-line-strong bg-paper px-3.5 text-[12.5px] font-medium transition-colors hover:bg-[#faf7f0]">
              Go to trips
            </Link>
          </section>

          <section className="rounded-2xl border border-line bg-paper p-5">
            <h2 className="flex items-center gap-1.5 text-[13.5px] font-semibold"><Sparkles size={14} /> A quiet planner</h2>
            <p className="mt-2 text-[11.5px] leading-relaxed text-ink-soft">
              Wayfarer keeps the graph, schedule, map, notes, and shared money in one place. No feeds, no noise, no invented travel times.
            </p>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
