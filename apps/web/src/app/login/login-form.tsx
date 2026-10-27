"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Mail } from "lucide-react";
import { browserApi, BrowserApiError } from "@/lib/client-api";
import { Button, Spinner } from "@/components/ui/button";
import { FieldError, FormError, Input, Label } from "@/components/ui/input";

type RequestResponse = { expires_at?: string; dev_code?: string; message?: string };

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [stage, setStage] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fieldError, setFieldError] = useState("");
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  useEffect(() => {
    if (stage === "code") codeRef.current?.focus();
  }, [stage]);

  async function requestCode(event?: React.FormEvent) {
    event?.preventDefault();
    setError("");
    setFieldError("");
    const normalized = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      setFieldError("Enter a valid email address.");
      return;
    }
    setBusy(true);
    try {
      const result = await browserApi<RequestResponse>("/api/v1/auth/otp/request", {
        method: "POST",
        body: JSON.stringify({ email: normalized }),
      });
      setEmail(normalized);
      setDevCode(result.dev_code ?? "");
      setExpiresAt(result.expires_at ?? "");
      setStage("code");
      setCode("");
      setCooldown(60);
    } catch (err) {
      setExpiresAt("");
      if (err instanceof BrowserApiError) {
        setFieldError(err.fields?.email ?? "");
        setError(err.message);
      } else {
        setError("We couldn't send a code. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function verify(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setFieldError("");
    if (!/^\d{6}$/.test(code)) {
      setFieldError("Enter the six-digit code.");
      return;
    }
    setBusy(true);
    try {
      await browserApi("/api/v1/auth/otp/verify", {
        method: "POST",
        body: JSON.stringify({ email, code }),
      });
      router.push(next);
      router.refresh();
    } catch (err) {
      if (err instanceof BrowserApiError) {
        setError(err.message);
        if (err.code === "expired" || err.code === "rate_limited") setStage("email");
        setCode("");
      } else {
        setError("We couldn't verify that code. Please try again.");
      }
      setBusy(false);
    }
  }

  const expiryLabel = expiresAt && !Number.isNaN(new Date(expiresAt).getTime())
    ? new Date(expiresAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    : "";

  if (stage === "email") {
    return (
      <form onSubmit={requestCode} noValidate className="space-y-4">
        <FormError>{error}</FormError>
        <div>
          <Label htmlFor="email">Email address</Label>
          <div className="relative">
            <Mail size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
            <Input
              id="email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoFocus
              placeholder="you@example.com"
              className="pl-9"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              aria-invalid={Boolean(fieldError)}
            />
          </div>
          <FieldError>{fieldError}</FieldError>
        </div>
        <Button type="submit" size="lg" className="w-full justify-between" disabled={busy}>
          <span>{busy ? "Sending code" : "Continue with email"}</span>
          {busy ? <Spinner /> : <ArrowRight size={16} />}
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={verify} noValidate className="space-y-4">
      <FormError>{error}</FormError>
      <div>
        <Label htmlFor="code" hint={email}>
          Six-digit code
        </Label>
        <Input
          ref={codeRef}
          id="code"
          name="code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          placeholder="000000"
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
          className="h-14 text-center text-[1.5rem] tracking-[0.4em] tabular-nums"
          aria-invalid={Boolean(fieldError)}
        />
        <FieldError>{fieldError}</FieldError>
        {expiryLabel ? (
          <p aria-live="polite" className="mt-2 text-[11.5px] text-ink-faint">
            Code sent. It expires at {expiryLabel} your local time.
          </p>
        ) : null}
        {devCode ? (
          <p className="mt-2 rounded-lg border border-line bg-sand/60 px-3 py-2 text-[11.5px] text-ink-soft">
            Development delivery — your code is <strong className="tracking-[0.15em]">{devCode}</strong>
          </p>
        ) : null}
      </div>
      <Button type="submit" size="lg" className="w-full justify-between" disabled={busy || code.length !== 6}>
        <span>{busy ? "Verifying" : "Enter Wayfarer"}</span>
        {busy ? <Spinner /> : <ArrowRight size={16} />}
      </Button>
      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={() => {
            setStage("email");
            setError("");
            setCode("");
            setExpiresAt("");
          }}
          className="inline-flex items-center gap-1.5 text-[12px] font-medium text-ink-soft hover:text-ink"
        >
          <ArrowLeft size={13} /> Use another email
        </button>
        <button
          type="button"
          onClick={() => requestCode()}
          disabled={busy || cooldown > 0}
          className="text-[12px] font-medium text-forest transition-opacity disabled:text-ink-faint"
        >
          {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
        </button>
      </div>
    </form>
  );
}
