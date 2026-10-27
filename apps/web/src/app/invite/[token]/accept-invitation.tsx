"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check } from "lucide-react";
import { browserApi, BrowserApiError } from "@/lib/client-api";
import { errorMessage } from "@/lib/utils";
import { Button, Spinner } from "@/components/ui/button";
import { FormError } from "@/components/ui/input";

export function AcceptInvitation({ token }: { token: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [accepted, setAccepted] = useState(false);

  async function accept() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await browserApi<{ trip_id: string; role: string; already_member: boolean }>(
        `/api/v1/invitations/${token}/accept`,
        { method: "POST", body: "{}" },
      );
      setAccepted(true);
      router.push(`/trips/${result.trip_id}/plan`);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof BrowserApiError && (err.status === 403 || err.status === 409)
          ? err.message || "This invitation cannot be accepted with the signed-in email."
          : errorMessage(err),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {error ? <FormError>{error}</FormError> : null}
      <Button className="w-full" onClick={() => void accept()} disabled={busy}>
        {busy ? <Spinner /> : accepted ? <Check size={15} /> : <ArrowRight size={15} />}
        {accepted ? "Opening the trip" : "Accept & open trip"}
      </Button>
      {!accepted ? (
        <p className="text-center text-[10.5px] leading-relaxed text-ink-faint">
          Wrong account? Sign out from Settings, then reopen this link.
        </p>
      ) : null}
    </div>
  );
}
