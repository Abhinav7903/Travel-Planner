import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = { "cache-control": "no-store" } as const;

export async function GET() {
  const base = process.env.INTERNAL_API_BASE_URL;
  if (!base) {
    return NextResponse.json({ ok: false }, { status: 503, headers });
  }

  try {
    const response = await fetch(`${base.replace(/\/$/, "")}/readyz`, {
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) {
      return NextResponse.json({ ok: false }, { status: 503, headers });
    }
    return NextResponse.json({ ok: true }, { headers });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503, headers });
  }
}
