"use client";

import { useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from "react";
import { LogoMark } from "./brand";

type Phase = "loading" | "leaving" | "done";

const HEALTH_TIMEOUT_MS = 10_000;
const HEALTH_RETRY_MS = 2_000;
const MINIMUM_LOADING_MS = 900;
const SHORT_LOADING_MS = 240;
const FADE_MS = 560;
const SLOW_AFTER_MS = 15_000;
const RETRY_AFTER_MS = 60_000;
const TOTAL_TASKS = 4;
const WARM_API_KEY = "wayfarer:warm-api";
const WARM_API_TTL_MS = 10 * 60 * 1000;
const MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const POINTER_QUERY = "(hover: hover) and (pointer: fine)";

type NetworkInformationLike = {
  effectiveType?: string;
  saveData?: boolean;
  addEventListener?: (type: string, listener: () => void) => void;
  removeEventListener?: (type: string, listener: () => void) => void;
};

function subscribeToReducedMotion(callback: () => void) {
  const query = window.matchMedia(MOTION_QUERY);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

function getReducedMotionSnapshot() {
  return window.matchMedia(MOTION_QUERY).matches;
}

function getReducedMotionServerSnapshot() {
  return false;
}

function subscribeToOnline(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function getOnlineSnapshot() {
  return navigator.onLine;
}

function getOnlineServerSnapshot() {
  return true;
}

function getConnection(): NetworkInformationLike | undefined {
  if (typeof navigator === "undefined") return undefined;
  return (navigator as Navigator & { connection?: NetworkInformationLike }).connection;
}

function subscribeToConnection(callback: () => void) {
  const connection = getConnection();
  connection?.addEventListener?.("change", callback);
  return () => connection?.removeEventListener?.("change", callback);
}

function getSlowConnectionSnapshot() {
  const connection = getConnection();
  return Boolean(
    connection?.saveData ||
      connection?.effectiveType === "slow-2g" ||
      connection?.effectiveType === "2g",
  );
}

function getSlowConnectionServerSnapshot() {
  return false;
}

function isWarmApi() {
  try {
    const value = sessionStorage.getItem(WARM_API_KEY);
    if (!value) return false;
    const parsed = JSON.parse(value) as { at?: unknown };
    return typeof parsed.at === "number" && Date.now() - parsed.at < WARM_API_TTL_MS;
  } catch {
    return false;
  }
}

function rememberWarmApi() {
  try {
    sessionStorage.setItem(WARM_API_KEY, JSON.stringify({ at: Date.now() }));
  } catch {
    // Storage is optional; the gate still works without it.
  }
}

export function ApiWakeGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("loading");
  const [settled, setSettled] = useState(0);
  const [taskLabel, setTaskLabel] = useState("Waking the trail guide");
  const [slow, setSlow] = useState(false);
  const [longWait, setLongWait] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const reduceMotion = useSyncExternalStore(
    subscribeToReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot,
  );
  const online = useSyncExternalStore(
    subscribeToOnline,
    getOnlineSnapshot,
    getOnlineServerSnapshot,
  );
  const slowConnection = useSyncExternalStore(
    subscribeToConnection,
    getSlowConnectionSnapshot,
    getSlowConnectionServerSnapshot,
  );

  useEffect(() => {
    if (phase === "done") return;
    const timer = setInterval(() => setElapsed((value) => value + 1), 1_000);
    return () => clearInterval(timer);
  }, [phase]);

  useEffect(() => {
    let cancelled = false;
    let fadeTimer: ReturnType<typeof setTimeout> | undefined;
    const startedAt = Date.now();
    let settledCount = 0;

    const wait = (milliseconds: number) =>
      new Promise<void>((resolve) => {
        setTimeout(resolve, milliseconds);
      });

    const waitForOnline = () =>
      new Promise<void>((resolve) => {
        if (navigator.onLine) {
          resolve();
          return;
        }
        const handleOnline = () => {
          window.removeEventListener("online", handleOnline);
          resolve();
        };
        window.addEventListener("online", handleOnline);
      });

    const pingApi = async () => {
      try {
        const response = await fetch("/api/health", {
          cache: "no-store",
          signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
        });
        return response.ok;
      } catch {
        return false;
      }
    };

    const waitForApi = async () => {
      let delay = HEALTH_RETRY_MS;
      while (!cancelled) {
        await waitForOnline();
        if (cancelled) return;
        if (await pingApi()) return;
        if (!cancelled) await wait(delay);
        delay = Math.min(delay + 1_500, 8_000);
      }
    };

    const settle = (label: string) => {
      if (cancelled) return;
      settledCount += 1;
      setSettled(settledCount);
      setTaskLabel(label);
    };

    const finish = (duration: number) => {
      setPhase("leaving");
      fadeTimer = setTimeout(() => {
        if (!cancelled) setPhase("done");
      }, duration);
    };

    const prefetchLikelyRoute = (signedIn: boolean) => {
      const prefetch = () => router.prefetch(signedIn ? "/trips" : "/login");
      const idle = window.requestIdleCallback;
      if (typeof idle === "function") idle(prefetch, { timeout: 2_000 });
      else setTimeout(prefetch, 300);
    };

    const checkSession = async () => {
      try {
        const response = await fetch("/api/v1/auth/me", {
          cache: "no-store",
          signal: AbortSignal.timeout(8_000),
        });
        rememberWarmApi();
        return response.ok;
      } catch {
        return false;
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
      if (isWarmApi()) {
        const ok = await Promise.race([pingApi(), wait(1_500).then(() => false)]);
        if (cancelled) return;
        if (ok) {
          rememberWarmApi();
          setSettled(TOTAL_TASKS);
          setTaskLabel("Ready to go");
          finish(FADE_MS);
          return;
        }
      }

      await waitForApi();
      if (cancelled) return;
      rememberWarmApi();

      settle("Checking your trail pass");
      const signedIn = await checkSession();
      if (cancelled) return;
      prefetchLikelyRoute(signedIn);

      settle("Unfolding the map");
      await waitForFonts();
      if (cancelled) return;

      settle("Plotting the scenic route");
      await wait(420);
      if (cancelled) return;

      settle("Ready to go");
      const minimum = isWarmApi() ? SHORT_LOADING_MS : MINIMUM_LOADING_MS;
      const remaining = Math.max(0, minimum - (Date.now() - startedAt));
      if (remaining > 0) await wait(remaining);
      if (cancelled) return;

      finish(FADE_MS);
    };

    void run();
    const slowTimer = setTimeout(() => {
      if (!cancelled) setSlow(true);
    }, SLOW_AFTER_MS);
    const retryTimer = setTimeout(() => {
      if (!cancelled) setLongWait(true);
    }, RETRY_AFTER_MS);

    return () => {
      cancelled = true;
      clearTimeout(slowTimer);
      clearTimeout(retryTimer);
      if (fadeTimer) clearTimeout(fadeTimer);
    };
  }, [router]);

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
          longWait={longWait}
          offline={!online}
          slowConnection={slowConnection}
          elapsed={elapsed}
          reduceMotion={reduceMotion}
          onRetry={() => window.location.reload()}
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
  longWait,
  offline,
  slowConnection,
  elapsed,
  reduceMotion,
  onRetry,
}: {
  prepared: boolean;
  exiting: boolean;
  progress: number;
  taskLabel: string;
  slow: boolean;
  longWait: boolean;
  offline: boolean;
  slowConnection: boolean;
  elapsed: number;
  reduceMotion: boolean;
  onRetry: () => void;
}) {
  const indeterminate = !prepared && progress === 0;
  const status = offline
    ? "Waiting for a connection"
    : prepared
      ? "Trip planner ready"
      : taskLabel;
  const clock = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}`;
  const waiting = slow || longWait;

  const loaderRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const planeRef = useRef<SVGGElement>(null);
  const turnRef = useRef<SVGGElement>(null);
  const smoothProgress = useRef(0);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const path = pathRef.current;
    if (!path) return;

    const target = progress;
    const from = smoothProgress.current;
    const startedAt = performance.now();
    const duration = reduceMotion ? 0 : 1_100;
    const length = path.getTotalLength();

    const tick = (now: number) => {
      const t = duration === 0 ? 1 : Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const value = from + (target - from) * eased;
      smoothProgress.current = value;

      const distance = (length * value) / 100;
      const point = path.getPointAtLength(distance);
      const ahead = path.getPointAtLength(Math.min(length, distance + 2));
      const angle = Math.atan2(ahead.y - point.y, ahead.x - point.x) * (180 / Math.PI);

      planeRef.current?.setAttribute("transform", `translate(${point.x} ${point.y})`);
      turnRef.current?.setAttribute("transform", `rotate(${angle})`);

      if (t < 1) frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    };
  }, [progress, reduceMotion]);

  useEffect(() => {
    const element = loaderRef.current;
    if (!element || reduceMotion) return;
    if (!window.matchMedia(POINTER_QUERY).matches) return;

    let frame: number | null = null;
    let pointerX = 0;
    let pointerY = 0;

    const apply = () => {
      frame = null;
      element.style.setProperty("--wl-pointer-x", pointerX.toFixed(4));
      element.style.setProperty("--wl-pointer-y", pointerY.toFixed(4));
    };

    const schedule = () => {
      if (frame === null) frame = requestAnimationFrame(apply);
    };

    const handleMove = (event: PointerEvent) => {
      pointerX = (event.clientX / window.innerWidth - 0.5) * 2;
      pointerY = (event.clientY / window.innerHeight - 0.5) * 2;
      schedule();
    };

    const reset = () => {
      pointerX = 0;
      pointerY = 0;
      schedule();
    };

    element.addEventListener("pointermove", handleMove);
    element.addEventListener("pointerleave", reset);
    return () => {
      element.removeEventListener("pointermove", handleMove);
      element.removeEventListener("pointerleave", reset);
      if (frame !== null) cancelAnimationFrame(frame);
      element.style.removeProperty("--wl-pointer-x");
      element.style.removeProperty("--wl-pointer-y");
    };
  }, [reduceMotion]);

  return (
    <div
      ref={loaderRef}
      className={`wayfarer-loader${exiting ? " wayfarer-loader--exit" : ""}${reduceMotion ? " wayfarer-loader--reduce" : ""}${offline ? " wayfarer-loader--offline" : ""}`}
      style={{ "--wl-progress": progress / 100 } as CSSProperties}
      aria-busy={!prepared}
    >
      <p className="wl-sr-only" aria-live="polite">
        {status}
      </p>

      <div className="wl-sky" aria-hidden="true">
        <div className="wl-sun" />
        <div className="wl-cloud wl-cloud--one" />
        <div className="wl-cloud wl-cloud--two" />
        <svg
          className="wl-flight-path"
          viewBox="0 0 900 250"
          preserveAspectRatio="xMidYMid meet"
          aria-hidden="true"
        >
          <path className="wl-path-shadow" d="M 35 190 C 180 20, 250 220, 390 115 S 640 25, 850 100" />
          <path
            ref={pathRef}
            className="wl-path-line"
            d="M 35 190 C 180 20, 250 220, 390 115 S 640 25, 850 100"
          />
          <path
            className="wl-path-progress"
            d="M 35 190 C 180 20, 250 220, 390 115 S 640 25, 850 100"
            pathLength="100"
            style={{ strokeDasharray: 100, strokeDashoffset: 100 - progress }}
          />
          <g
            ref={planeRef}
            className={`wl-plane${indeterminate ? " wl-plane--idle" : ""}`}
            transform="translate(35 190)"
          >
            <g ref={turnRef}>
              <PlaneGlyph />
            </g>
          </g>
        </svg>
        <span className="wl-pin wl-pin--kyoto">
          <span className="wl-pin-shape">
            <span className="wl-pin-dot" />
          </span>
          <small>Kyoto</small>
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
      </div>

      <div className="wl-content">
        <div className="wl-brand">
          <LogoMark className="h-[34px] w-[34px] rounded-[12px] bg-forest text-paper" />
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
              ? "Your itinerary is ready. Let's go."
              : offline
                ? "You're offline. Reconnect and the trail guide will pick up where it left off."
                : slow
                  ? "Still waking the trail guide. The first visit can take up to a minute."
                  : slowConnection
                    ? "This connection is slow, so the first load may take a little longer."
                    : "Packing the little details for your next big story."}
          </p>
        </div>

        <div className="wl-progress">
          <div className="wl-progress-meta">
            <span>{status}</span>
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
          {waiting && !prepared && (
            <p className="wl-elapsed">
              {clock} elapsed · first loads can take up to a minute
            </p>
          )}
          {longWait && !prepared && (
            <div className="wl-retry">
              <span>
                {offline
                  ? "Check your connection, then reload."
                  : "The server is taking longer than expected."}
              </span>
              <button type="button" className="wl-retry-button" onClick={onRetry}>
                Reload
              </button>
            </div>
          )}
        </div>

        <div className="wl-footer" aria-hidden="true">
          <span>TAKE THE SCENIC ROUTE</span>
        </div>
      </div>
    </div>
  );
}

function PlaneGlyph() {
  return (
    <g transform="translate(-12 -12) rotate(18) scale(1.6)">
      <path d="M21 3 3 10.6l6.1 2.2L11.7 21l3.1-7.4L21 3Z" fill="currentColor" />
    </g>
  );
}
