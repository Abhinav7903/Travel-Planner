import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, Mail, MapPin, ShieldCheck, UserRound } from "lucide-react";
import { ApiError, getSessionUser, serverApi } from "@/lib/api";
import type { InvitationPreview } from "@/lib/types";
import { formatDateRange, roleLabel } from "@/lib/utils";
import { Logo } from "@/components/brand";
import { Badge } from "@/components/ui/badge";
import { AcceptInvitation } from "./accept-invitation";

export const metadata = { title: "Trip invitation" };
export const dynamic = "force-dynamic";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let preview: InvitationPreview;
  try {
    preview = await serverApi<InvitationPreview>(`/v1/invitations/${token}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
  const user = await getSessionUser();
  const available = preview.status === "pending";

  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-canvas">
      <div className="pointer-events-none absolute -right-24 -top-24 h-[380px] w-[380px] rounded-full bg-[#dce6d7] blur-3xl" />
      <div className="relative mx-auto flex w-full max-w-5xl flex-1 items-center px-5 py-10 sm:px-8">
        <div className="grid w-full gap-8 md:grid-cols-[1.08fr_.92fr] md:items-center">
          <div className="max-w-lg">
            <Logo />
            <p className="eyebrow mt-10">You are invited</p>
            <h1 className="display mt-3 text-[2.6rem] leading-[1.02] sm:text-[3.2rem]">{preview.trip_title}</h1>
            <p className="mt-4 max-w-md text-[14px] leading-relaxed text-ink-soft">
              {preview.inviter_name} would like you to help shape this journey. Bring your favourite detours.
            </p>
            <dl className="mt-7 space-y-3 text-[12.5px]">
              <div className="flex items-center gap-2.5 text-ink-soft">
                <MapPin size={14} className="text-forest" /> {preview.destination}
              </div>
              <div className="flex items-center gap-2.5 text-ink-soft">
                <CalendarDays size={14} className="text-forest" /> {formatDateRange(preview.start_date, preview.end_date)}
              </div>
              <div className="flex items-center gap-2.5 text-ink-soft">
                <UserRound size={14} className="text-forest" /> Invited as {roleLabel[preview.role] ?? preview.role}
              </div>
              <div className="flex items-center gap-2.5 text-ink-soft">
                <ShieldCheck size={14} className="text-forest" /> For {preview.masked_email}
              </div>
            </dl>
          </div>

          <section className="rounded-[1.6rem] border border-line bg-paper p-6 shadow-[0_24px_70px_rgba(45,45,37,.10)] sm:p-7">
            {!available ? (
              <div>
                <Badge tone="sand">{preview.status}</Badge>
                <h2 className="display mt-3 text-[1.55rem]">This invitation is no longer open.</h2>
                <p className="mt-2 text-[12.5px] leading-relaxed text-ink-soft">
                  Invitations are one-time and expire. Ask {preview.inviter_name} to send a fresh link.
                </p>
                <Link href="/trips" className="mt-5 inline-flex text-[12.5px] font-medium text-forest underline decoration-forest/30 underline-offset-4">
                  Go to your trips
                </Link>
              </div>
            ) : (
              <div>
                <p className="eyebrow">Almost there</p>
                <h2 className="display mt-2 text-[1.55rem] leading-tight">
                  {user ? `Welcome, ${user.display_name.split(" ")[0]}.` : "Sign in to take your place."}
                </h2>
                <p className="mt-2 text-[12.5px] leading-relaxed text-ink-soft">
                  {user
                    ? `You are signed in as ${user.email}. The invitation must match this email.`
                    : `Use ${preview.masked_email}. We will email a six-digit code — no password needed.`}
                </p>
                <div className="mt-5">
                  {user ? (
                    <AcceptInvitation token={token} />
                  ) : (
                    <Link
                      href={`/login?next=/invite/${token}`}
                      className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-forest px-4 text-sm font-medium text-[#fbf9f3] shadow-[0_1px_1px_rgba(22,58,46,.18)] transition-colors hover:bg-forest-deep"
                    >
                      <Mail size={15} /> Continue with email
                    </Link>
                  )}
                </div>
                <p className="mt-4 flex items-center justify-center gap-1.5 text-[10.5px] text-ink-faint">
                  Expires {new Date(preview.expires_at).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" })} · one-time link
                </p>
              </div>
            )}
          </section>
        </div>
      </div>
      <footer className="relative border-t border-line/70 px-5 py-4 text-center text-[10.5px] text-ink-faint sm:px-8">
        Wayfarer · a calmer way to plan together
      </footer>
    </main>
  );
}
