"use client";

import { useEffect, useState, type ReactNode } from "react";

type Phase = "loading" | "leaving" | "done";

const HEALTH_TIMEOUT_MS = 10_000;
const HEALTH_RETRY_MS = 2_000;
const MINIMUM_LOADING_MS = 900;
const FADE_MS = 520;
const SLOW_AFTER_MS = 15_000;
const TOTAL_TASKS = 3;

export function ApiWakeGate({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [settled, setSettled] = useState(0);
  const [taskLabel, setTaskLabel] = useState("Waking the trail guide");
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let fadeTimer: ReturnType<typeof setTimeout> | undefined;
    const startedAt = Date.now();
    let settledCount = 0;

    const wait = (milliseconds: number) =>
      new Promise<void>((resolve) => {
        setTimeout(resolve, milliseconds);
      });

    const settle = (label: string) => {
      if (cancelled) return;
      settledCount += 1;
      setSettled(settledCount);
      setTaskLabel(label);
    };

    const waitForApi = async () => {
      while (!cancelled) {
        try {
          const response = await fetch("/api/health", {
            cache: "no-store",
            signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
          });
          if (response.ok) return;
        } catch {
          // The first request after an idle period may fail while Koyeb wakes.
        }
        if (!cancelled) await wait(HEALTH_RETRY_MS);
      }
    };

    const checkSession = async () => {
      try {
        await fetch("/api/v1/auth/me", {
          cache: "no-store",
          signal: AbortSignal.timeout(8_000),
        });
      } catch {
        // A 401 is a valid answer here; the gate is only checking reachability.
      }
    };

    const waitForFonts = async () => {
      try {
        await document.fonts.ready;
      } catch {
        // Fonts are decorative; never let them hold the gate open.
      }
    };

    const run = async () => {
      await waitForApi();
      if (cancelled) return;

      settle("Checking your trail pass");
      await checkSession();
      if (cancelled) return;

      settle("Unfolding the map");
      await waitForFonts();
      if (cancelled) return;

      settle("Ready for takeoff");
      const remaining = Math.max(0, MINIMUM_LOADING_MS - (Date.now() - startedAt));
      if (remaining > 0) await wait(remaining);
      if (cancelled) return;

      setPhase("leaving");
      fadeTimer = setTimeout(() => {
        if (!cancelled) setPhase("done");
      }, FADE_MS);
    };

    void run();
    const slowTimer = setTimeout(() => {
      if (!cancelled) setSlow(true);
    }, SLOW_AFTER_MS);

    return () => {
      cancelled = true;
      clearTimeout(slowTimer);
      if (fadeTimer) clearTimeout(fadeTimer);
    };
  }, []);

  useEffect(() => {
    const previous = document.body.style.overflow;
    if (phase !== "done") document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [phase]);

  const ready = phase !== "loading";
  const progress = Math.round((settled / TOTAL_TASKS) * 100);

  return (
    <>
      {phase !== "done" && (
        <TravelLoadingScreen
          prepared={ready}
          exiting={phase === "leaving"}
          progress={progress}
          taskLabel={taskLabel}
          slow={slow}
        />
      )}
      {ready && <div className="wl-app-reveal">{children}</div>}
    </>
  );
}

function TravelLoadingScreen({
  prepared,
  exiting,
  progress,
  taskLabel,
  slow,
}: {
  prepared: boolean;
  exiting: boolean;
  progress: number;
  taskLabel: string;
  slow: boolean;
}) {
  const indeterminate = !prepared && progress === 0;

  return (
    <div
      className={`wayfarer-loader${exiting ? " wayfarer-loader--exit" : ""}`}
      role="status"
      aria-live="polite"
      aria-label={prepared ? "Trip planner ready" : "Preparing your trip planner"}
    >
      <div className="wl-sky" aria-hidden="true">
        <div className="wl-sun" />
        <div className="wl-cloud wl-cloud--one" />
        <div className="wl-cloud wl-cloud--two" />
        <div className="wl-cloud wl-cloud--three" />
        <svg className="wl-flight-path" viewBox="0 0 900 250" preserveAspectRatio="none">
          <path className="wl-path-shadow" d="M 35 190 C 180 20, 250 220, 390 115 S 640 25, 850 100" />
          <path className="wl-path-line" d="M 35 190 C 180 20, 250 220, 390 115 S 640 25, 850 100" />
        </svg>
        <span className="wl-plane">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M21 3 3 10.6l6.1 2.2L11.7 21l3.1-7.4L21 3Z" fill="currentColor" />
          </svg>
        </span>
        <span className="wl-pin wl-pin--kyoto">
          <span className="wl-pin-shape">
            <span className="wl-pin-dot" />
          </span>
          <small>Kyoto</small>
        </span>
        <span className="wl-pin wl-pin--coast">
          <span className="wl-pin-shape">
            <span className="wl-pin-dot" />
          </span>
          <small>Coast</small>
        </span>
        <span className="wl-pin wl-pin--mountain">
          <span className="wl-pin-shape">
            <span className="wl-pin-dot" />
          </span>
          <small>Somewhere new</small>
        </span>
        <div className="wl-hill wl-hill--back" />
        <div className="wl-hill wl-hill--middle" />
        <div className="wl-hill wl-hill--front" />
        <div className="wl-water" />
        <div className="wl-road" />
      </div>

      <div className="wl-content">
        <div className="wl-brand">
          <span className="wl-brand-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path
                d="M5.5 18.5 9 6.5l9.5 6.5-5.5 5.5-7.5-.5Z"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinejoin="round"
              />
              <circle cx="11.2" cy="12.1" r="1.15" fill="currentColor" />
            </svg>
          </span>
          <span>Wayfarer</span>
        </div>

        <div className="wl-copy">
          <p className="wl-eyebrow">
            <span className="wl-eyebrow-dot" />
            YOUR NEXT CHAPTER
          </p>
          <h1>
            Making room
            <br />
            for <em>somewhere</em> new.
          </h1>
          <p className="wl-subtitle">
            {prepared
              ? "Your itinerary is ready. Let’s go."
              : slow
                ? "Still waking the trail guide. The first visit can take up to a minute."
                : "Packing the little details for your next big story…"}
          </p>
        </div>

        <div className="wl-progress">
          <div className="wl-progress-meta">
            <span>{prepared ? "Ready for takeoff" : taskLabel}</span>
            <span>{indeterminate ? "…" : `${progress}%`}</span>
          </div>
          <div
            className={`wl-progress-track${indeterminate ? " wl-progress-track--indeterminate" : ""}`}
            role="progressbar"
            aria-label="Loading progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={indeterminate ? undefined : progress}
          >
            <span style={{ width: indeterminate ? "34%" : `${progress}%` }} />
          </div>
          <div className="wl-loading-note">
            <span className="wl-spinner" aria-hidden="true" />
            {prepared ? "Cleared for boarding." : "No rush. The good bits are worth getting right."}
          </div>
        </div>
      </div>

      <div className="wl-footer" aria-hidden="true">
        <span>TAKE THE SCENIC ROUTE</span>
        <span>✦</span>
        <span>COLLECT MOMENTS, NOT MILES</span>
      </div>
    </div>
  );
}
