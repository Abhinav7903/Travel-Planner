import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Compass } from "lucide-react";

export const metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <main className="relative flex min-h-svh items-center justify-center overflow-hidden bg-canvas px-5 py-16 sm:px-8">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-paper/80 blur-3xl"
      />
      <div className="relative w-full max-w-2xl">
        <div className="flex items-center justify-between">
          <p className="eyebrow">Wayfarer</p>
          <span className="inline-flex h-9 items-center gap-2 rounded-full border border-line bg-paper px-3.5 text-[10.5px] font-medium uppercase tracking-[0.16em] text-ink-faint">
            <Compass size={13} /> Off the map
          </span>
        </div>

        <section className="mt-10 overflow-hidden rounded-[28px] border border-line bg-paper shadow-[0_24px_80px_-40px_rgba(37,39,33,.35)]">
          <div className="border-b border-line px-6 py-8 sm:px-10 sm:py-10">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
              <span className="display shrink-0 text-[4.8rem] leading-[0.8] text-line-strong sm:text-[6rem]">
                404
              </span>
              <div className="pt-1">
                <h1 className="display text-[2rem] leading-[1.05] sm:text-[2.5rem]">
                  This route does not exist.
                </h1>
                <p className="mt-3 max-w-md text-[13.5px] leading-relaxed text-ink-soft">
                  The page may have moved, been archived, or the link may be incomplete. Your trips are still
                  right where you left them.
                </p>
              </div>
            </div>

            <div className="mt-8 flex flex-col gap-2.5 sm:flex-row">
              <Link
                href="/trips"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-forest px-5 text-[13px] font-medium text-paper transition-colors hover:bg-forest-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
              >
                <ArrowLeft size={15} /> Back to your trips
              </Link>
              <Link
                href="/"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-line-strong bg-canvas px-5 text-[13px] font-medium text-ink transition-colors hover:bg-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
              >
                Wayfarer home <ArrowUpRight size={15} />
              </Link>
            </div>
          </div>

          <div className="grid gap-6 px-6 py-6 sm:grid-cols-[1fr_auto] sm:items-center sm:px-10">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-faint">
                Next best step
              </p>
              <p className="mt-2 text-[12.5px] leading-relaxed text-ink-soft">
                Open your dashboard to continue planning, or use the link that brought you here.
              </p>
            </div>
            <div aria-hidden className="relative h-10 sm:w-48">
              <div className="absolute left-0 right-8 top-1/2 border-t border-dashed border-line-strong" />
              <span className="absolute left-0 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-forest" />
              <span className="absolute left-[55%] top-1/2 h-2 w-2 -translate-y-1/2 rounded-full border border-line-strong bg-paper" />
              <span className="absolute right-0 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-canvas text-[9px] text-ink-faint">
                ?
              </span>
            </div>
          </div>
        </section>

        <p className="mt-5 text-center text-[11px] text-ink-faint">
          If you followed an invitation link, ask the trip owner to send a fresh one.
        </p>
      </div>
    </main>
  );
}
