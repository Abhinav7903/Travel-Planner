import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  CalendarDays,
  FileDown,
  MapPin,
  MoveRight,
  NotebookPen,
  Route,
  Split,
  Users,
} from "lucide-react";
import { getSessionUser } from "@/lib/api";
import { Logo } from "@/components/brand";
import { Badge } from "@/components/ui/badge";

export default async function LandingPage() {
  let user = null;
  try {
    user = await getSessionUser();
  } catch {
    user = null;
  }
  if (user) redirect("/trips");

  return (
    <div className="min-h-screen overflow-x-hidden bg-canvas">
      <header className="mx-auto flex h-20 w-full max-w-6xl items-center justify-between px-5 sm:px-8">
        <Logo />
        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="rounded-xl px-3.5 py-2 text-[13.5px] font-medium text-ink-soft transition-colors hover:bg-[#ece7dc] hover:text-ink"
          >
            Sign in
          </Link>
          <Link
            href="/login"
            className="inline-flex h-9 items-center rounded-xl bg-forest px-4 text-[13.5px] font-medium text-paper transition-colors hover:bg-forest-deep"
          >
            Start planning
          </Link>
        </div>
      </header>

      <main>
        <section className="relative mx-auto grid w-full max-w-6xl gap-12 px-5 pb-16 pt-10 sm:px-8 lg:grid-cols-[0.92fr_1.08fr] lg:items-center lg:pb-24 lg:pt-16">
          <div className="reveal relative z-10">
            <Badge tone="forest" className="mb-6">
              <Route size={11} /> The itinerary, made visible
            </Badge>
            <h1 className="display text-[3.2rem] leading-[0.97] sm:text-[4.4rem]">
              Plan the trip
              <br />
              <span className="text-forest">as it unfolds.</span>
            </h1>
            <p className="mt-6 max-w-lg text-[16px] leading-[1.7] text-ink-soft">
              Wayfarer turns an itinerary into a living map of places, journeys and days. Shape the route together,
              split into groups, keep the notes, and know exactly where the money went.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/login"
                className="inline-flex h-12 items-center gap-2 rounded-xl bg-forest px-6 text-[14.5px] font-medium text-paper shadow-[0_1px_1px_rgba(22,58,46,.2)] transition-colors hover:bg-forest-deep"
              >
                Begin a trip <ArrowRight size={16} />
              </Link>
              <a
                href="#how"
                className="inline-flex h-12 items-center rounded-xl border border-line-strong bg-paper px-5 text-[14.5px] font-medium text-ink transition-colors hover:border-ink-faint"
              >
                See how it works
              </a>
            </div>
            <p className="mt-5 flex items-center gap-2 text-[12px] text-ink-faint">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-forest" />
              Passwordless sign-in. No credit card. Yours to share.
            </p>
          </div>

          <div className="reveal-delay relative">
            <div className="absolute -inset-8 -z-10 rounded-[3rem] bg-[radial-gradient(ellipse_at_center,_#e1e8db_0%,_transparent_70%)]" />
            <div className="paper-card overflow-hidden shadow-[0_30px_90px_rgba(57,58,48,.13)]">
              <div className="flex items-center justify-between border-b border-line px-5 py-4">
                <div>
                  <p className="eyebrow">Kyoto & Tokyo</p>
                  <p className="mt-0.5 text-[15px] font-semibold">Seven slow days in spring</p>
                </div>
                <div className="flex -space-x-1.5">
                  {["AM", "YK", "SR"].map((label, index) => (
                    <span
                      key={label}
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-[#e7ebe2] text-[9px] font-semibold text-forest ring-2 ring-paper"
                      style={{ transform: `translateX(-${index * 2}px)` }}
                    >
                      {label}
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid min-h-[310px] grid-cols-[1fr_118px] sm:grid-cols-[1fr_155px]">
                <div className="relative overflow-hidden bg-[#f9f6ef] p-5">
                  <div className="absolute inset-0 opacity-50 [background-image:radial-gradient(#d8d2c4_0.7px,transparent_0.7px)] [background-size:16px_16px]" />
                  <svg className="absolute inset-0 h-full w-full" viewBox="0 0 320 300" preserveAspectRatio="none" fill="none">
                    <path
                      d="M62 70 C 92 60, 120 86, 146 104 S 188 132, 225 120"
                      stroke="#b9b3a5"
                      strokeWidth="1.3"
                      strokeDasharray="3 4"
                    />
                    <path
                      d="M146 104 C 154 140, 128 158, 102 182 S 78 224, 116 238"
                      stroke="#b9b3a5"
                      strokeWidth="1.3"
                      strokeDasharray="3 4"
                    />
                    <path d="M225 120 C 250 152, 244 190, 218 214" stroke="#b9b3a5" strokeWidth="1.3" strokeDasharray="3 4" />
                  </svg>
                  <div className="relative space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-forest text-[10px] font-semibold text-paper">
                        09
                      </div>
                      <div className="min-w-0 rounded-xl border border-line bg-paper px-3 py-2.5 shadow-sm">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-faint">Temples & gardens</p>
                        <p className="mt-0.5 text-[12.5px] font-semibold">Fushimi Inari at first light</p>
                        <p className="mt-1 flex items-center gap-1 text-[10.5px] text-ink-soft">
                          <MapPin size={10} /> Fushimi, Kyoto · 7:10 AM
                        </p>
                      </div>
                    </div>
                    <div className="ml-10 flex items-center gap-2 text-[9.5px] text-ink-faint">
                      <span className="h-px w-5 border-t border-dashed border-line-strong" />
                      Walk · 18 min · 1.2 km
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#eadfce] text-[10px] font-semibold text-[#745739]">
                        10
                      </div>
                      <div className="min-w-0 rounded-xl border border-line bg-paper px-3 py-2.5 shadow-sm">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-faint">Together</p>
                        <p className="mt-0.5 text-[12.5px] font-semibold">Lunch at Nishiki Market</p>
                        <p className="mt-1 flex items-center gap-1 text-[10.5px] text-ink-soft">
                          <MapPin size={10} /> Downtown · 12:20 PM
                        </p>
                      </div>
                    </div>
                    <div className="ml-10 flex items-center gap-2 text-[9.5px] text-ink-faint">
                      <span className="h-px w-5 border-t border-dashed border-line-strong" />
                      Transit · ~25 min
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#e4e2ee] text-[10px] font-semibold text-[#514d72]">
                        02
                      </div>
                      <div className="min-w-0 rounded-xl border border-line bg-paper px-3 py-2.5 shadow-sm">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-faint">Food & city</p>
                        <p className="mt-0.5 text-[12.5px] font-semibold">Gion after dark</p>
                        <p className="mt-1 flex items-center gap-1 text-[10.5px] text-ink-soft">
                          <MapPin size={10} /> Higashiyama · 6:40 PM
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-l border-line bg-[#f5f1e7] p-4">
                  <p className="eyebrow mb-3">Day 02</p>
                  <div className="space-y-4">
                    {["08:00", "12:20", "18:40"].map((time, index) => (
                      <div key={time} className="relative pl-4">
                        <span className="absolute left-0 top-1 h-1.5 w-1.5 rounded-full bg-forest" />
                        {index < 2 ? <span className="route-line absolute left-[2.5px] top-3 h-8 w-px" /> : null}
                        <p className="text-[10px] font-semibold text-ink">{time}</p>
                        <p className="mt-0.5 text-[9.5px] leading-snug text-ink-soft">
                          {["Coffee, then east", "Market lunch", "Lanterns & dinner"][index]}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-5 rounded-xl border border-line bg-paper p-2.5">
                    <p className="text-[8.5px] font-semibold uppercase tracking-wider text-ink-faint">Map notes</p>
                    <p className="mt-1 text-[9px] leading-snug text-ink-soft">15 min walk between stops. Route left open.</p>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3.5">
                <div className="flex gap-4 text-[11px] text-ink-soft">
                  <span className="flex items-center gap-1.5">
                    <CalendarDays size={12} /> Apr 4 – 10
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Users size={12} /> 3 travellers
                  </span>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-forest-soft px-2 py-1 text-[10px] font-semibold text-forest">
                  <FileDown size={11} /> Export planner
                </span>
              </div>
            </div>
            <p className="mt-3 text-right text-[11px] text-ink-faint">A preview of the Wayfarer workspace</p>
          </div>
        </section>

        <section id="how" className="border-y border-line bg-[#f9f6ef]">
          <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 lg:py-24">
            <div className="max-w-2xl">
              <p className="eyebrow">A different shape of planner</p>
              <h2 className="display mt-3 text-[2.4rem] leading-tight sm:text-[3rem]">
                Somewhere between a map, a schedule and a shared notebook.
              </h2>
            </div>

            <div className="mt-12 grid gap-4 md:grid-cols-6">
              <Feature
                className="md:col-span-4"
                icon={<Route size={19} />}
                title="An editable itinerary graph"
                body="Move a place and its journey moves with it. A graph, timeline and list are three views of the same calm plan — with honest, editable travel times instead of invented precision."
                visual={<GraphVisual />}
              />
              <Feature
                className="md:col-span-2"
                icon={<Split size={19} />}
                title="Together, or apart"
                body="Create groups for a day and let the route branch. Compare paths, then come back together for dinner."
                visual={
                  <div className="mt-6 space-y-2">
                    {[
                      { label: "Temples & gardens", color: "#1f4d3d" },
                      { label: "Food & city", color: "#b46d4c" },
                    ].map((group) => (
                      <div key={group.label} className="flex items-center gap-2.5 rounded-xl border border-line bg-paper px-3 py-2.5">
                        <span className="h-2 w-2 rounded-full" style={{ background: group.color }} />
                        <span className="text-[12px] font-medium">{group.label}</span>
                        <MoveRight size={12} className="ml-auto text-ink-faint" />
                      </div>
                    ))}
                  </div>
                }
              />
              <Feature
                className="md:col-span-2"
                icon={<MapPin size={19} />}
                title="A map, when you need it"
                body="See every located stop in context. If tiles are unavailable, your plan stays exactly where it was."
                visual={
                  <div className="relative mt-6 h-[122px] overflow-hidden rounded-xl border border-line bg-[#ebe8dc]">
                    <svg viewBox="0 0 260 122" className="absolute inset-0 h-full w-full" fill="none">
                      <path d="M-10 82 C 50 50, 90 100, 150 58 S 220 42, 280 66" stroke="#d3ccbb" strokeWidth="9" />
                      <path d="M40 -10 C 55 30, 30 60, 70 130" stroke="#ded8c8" strokeWidth="5" />
                      <path d="M180 -10 C 170 40, 200 76, 185 130" stroke="#ded8c8" strokeWidth="4" />
                      <path d="M62 70 C 98 62, 128 78, 168 50" stroke="#8fa394" strokeWidth="1.6" strokeDasharray="3 4" />
                    </svg>
                    <span className="absolute left-[54px] top-[59px] h-3 w-3 rounded-full border-2 border-paper bg-forest shadow" />
                    <span className="absolute left-[160px] top-[40px] h-3 w-3 rounded-full border-2 border-paper bg-clay shadow" />
                    <span className="absolute bottom-2 right-2 rounded bg-paper/80 px-1.5 py-0.5 text-[8px] text-ink-faint">
                      Map tiles © OpenStreetMap
                    </span>
                  </div>
                }
              />
              <Feature
                className="md:col-span-2"
                icon={<Split size={19} />}
                title="Money that adds up"
                body="Equal or custom splits in whole minor units. Balances per currency, with a suggested way to settle."
                visual={
                  <div className="mt-6 space-y-2">
                    <div className="flex items-center justify-between rounded-xl border border-line bg-paper px-3 py-2.5 text-[12px]">
                      <span className="text-ink-soft">Alex paid</span>
                      <span className="font-semibold tabular-nums">¥18,400</span>
                    </div>
                    <div className="flex items-center justify-between rounded-xl bg-forest-soft px-3 py-2.5 text-[12px]">
                      <span className="text-forest">Maya owes Alex</span>
                      <span className="font-semibold tabular-nums text-forest">¥6,133</span>
                    </div>
                  </div>
                }
              />
              <Feature
                className="md:col-span-2"
                icon={<NotebookPen size={19} />}
                title="Notes without the scramble"
                body="Pinned Markdown notes autosave with a visible state. Your words stay yours, rendered without raw HTML."
                visual={
                  <div className="mt-6 rounded-xl border border-line bg-paper p-3">
                    <p className="text-[11px] font-semibold">Before we go</p>
                    <div className="mt-1.5 space-y-1">
                      <span className="block h-1.5 w-[88%] rounded bg-[#e8e3d7]" />
                      <span className="block h-1.5 w-[72%] rounded bg-[#e8e3d7]" />
                      <span className="block h-1.5 w-[54%] rounded bg-[#e8e3d7]" />
                    </div>
                    <p className="mt-2.5 text-[9px] text-ink-faint">Saved just now</p>
                  </div>
                }
              />
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 lg:py-24">
          <div className="mesh relative overflow-hidden rounded-[2rem] border border-line px-6 py-14 text-center sm:px-12">
            <div className="relative z-10 mx-auto max-w-2xl">
              <p className="eyebrow">The next trip starts quietly</p>
              <h2 className="display mt-4 text-[2.6rem] leading-tight sm:text-[3.4rem]">Give the plan a place to live.</h2>
              <p className="mx-auto mt-4 max-w-md text-[14.5px] leading-relaxed text-ink-soft">
                Build it with the people coming along. Change it as you go. Print it when you want paper.
              </p>
              <Link
                href="/login"
                className="mt-7 inline-flex h-12 items-center gap-2 rounded-xl bg-forest px-6 text-[14.5px] font-medium text-paper transition-colors hover:bg-forest-deep"
              >
                Start planning <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-start justify-between gap-4 px-5 py-8 text-[12px] text-ink-faint sm:flex-row sm:items-center sm:px-8">
          <div className="flex items-center gap-3">
            <Logo />
            <span className="hidden h-4 w-px bg-line sm:block" />
            <span>A calmer way to plan a trip.</span>
          </div>
          <div className="flex items-center gap-5">
            <span>Maps © OpenStreetMap contributors</span>
            <span>© {new Date().getFullYear()} Wayfarer</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Feature({
  icon,
  title,
  body,
  visual,
  className,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  visual: React.ReactNode;
  className?: string;
}) {
  return (
    <article className={`rounded-2xl border border-line bg-paper p-6 ${className ?? ""}`}>
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-forest-soft text-forest">{icon}</div>
      <h3 className="display mt-5 text-[1.4rem]">{title}</h3>
      <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">{body}</p>
      {visual}
    </article>
  );
}

function GraphVisual() {
  return (
    <div className="relative mt-6 h-[190px] overflow-hidden rounded-xl border border-line bg-[#f6f2e9]">
      <div className="absolute inset-0 opacity-60 [background-image:radial-gradient(#d8d2c4_0.7px,transparent_0.7px)] [background-size:18px_18px]" />
      <svg className="absolute inset-0 h-full w-full" fill="none" viewBox="0 0 560 190">
        <path d="M84 56 C 130 44, 160 72, 210 92 S 300 118, 344 96" stroke="#aeb2a4" strokeWidth="1.4" strokeDasharray="3 4" />
        <path d="M210 92 C 240 122, 242 148, 296 154" stroke="#aeb2a4" strokeWidth="1.4" strokeDasharray="3 4" />
        <path d="M344 96 C 404 76, 446 96, 478 124" stroke="#aeb2a4" strokeWidth="1.4" strokeDasharray="3 4" />
        <path d="M296 154 C 362 162, 420 144, 478 124" stroke="#aeb2a4" strokeWidth="1.4" strokeDasharray="3 4" />
        <rect x="40" y="34" width="116" height="46" rx="10" fill="#fdfbf7" stroke="#ddd7ca" />
        <text x="54" y="53" fill="#92958a" fontSize="7.5" fontWeight="600" letterSpacing=".8">08:10 · KYOTO</text>
        <text x="54" y="68" fill="#252721" fontSize="10" fontWeight="600">Fushimi Inari</text>
        <rect x="160" y="68" width="116" height="46" rx="10" fill="#fdfbf7" stroke="#ddd7ca" />
        <text x="174" y="87" fill="#92958a" fontSize="7.5" fontWeight="600" letterSpacing=".8">11:40 · GION</text>
        <text x="174" y="102" fill="#252721" fontSize="10" fontWeight="600">Tea at Ippodo</text>
        <rect x="278" y="130" width="116" height="46" rx="10" fill="#fdfbf7" stroke="#ddd7ca" />
        <text x="292" y="149" fill="#92958a" fontSize="7.5" fontWeight="600" letterSpacing=".8">14:00 · EAST</text>
        <text x="292" y="164" fill="#252721" fontSize="10" fontWeight="600">Philosopher's Path</text>
        <rect x="304" y="38" width="116" height="46" rx="10" fill="#fdfbf7" stroke="#1f4d3d" strokeWidth="1.2" />
        <text x="318" y="57" fill="#1f4d3d" fontSize="7.5" fontWeight="600" letterSpacing=".8">TOGETHER</text>
        <text x="318" y="72" fill="#252721" fontSize="10" fontWeight="600">Nishiki Market</text>
        <rect x="418" y="96" width="112" height="46" rx="10" fill="#f7ede4" stroke="#dec9ba" />
        <text x="432" y="115" fill="#9a5939" fontSize="7.5" fontWeight="600" letterSpacing=".8">FOOD GROUP</text>
        <text x="432" y="130" fill="#252721" fontSize="10" fontWeight="600">Pontocho alley</text>
        <text x="250" y="58" fill="#8c8f84" fontSize="7.5">walk · 18m</text>
        <text x="226" y="128" fill="#8c8f84" fontSize="7.5">transit · 24m</text>
      </svg>
      <div className="absolute bottom-2.5 left-2.5 flex gap-1.5">
        <span className="rounded-md border border-line bg-paper px-2 py-1 text-[9px] font-medium text-ink-soft">Graph</span>
        <span className="rounded-md px-2 py-1 text-[9px] text-ink-faint">Timeline</span>
        <span className="rounded-md px-2 py-1 text-[9px] text-ink-faint">List</span>
      </div>
    </div>
  );
}
