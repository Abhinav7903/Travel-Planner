"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { browserApi } from "@/lib/client-api";
import { Button, Spinner } from "@/components/ui/button";

export function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    if (busy) return;
    setBusy(true);
    try {
      await browserApi("/api/v1/auth/logout", { method: "POST", body: "{}" });
    } finally {
      router.push("/login");
      router.refresh();
    }
  }

  return (
    <Button variant="secondary" onClick={() => void signOut()} disabled={busy}>
      {busy ? <Spinner /> : <LogOut size={14} />} Sign out
    </Button>
  );
}
