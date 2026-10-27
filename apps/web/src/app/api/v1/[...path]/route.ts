import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = "[0-9a-fA-F-]{36}";
const TOKEN = "[A-Za-z0-9_-]{20,128}";

const ROUTES: Array<{ methods: string[]; pattern: RegExp; auth: boolean }> = [
  { methods: ["GET"], pattern: /^v1\/auth\/me$/, auth: true },
  { methods: ["POST"], pattern: /^v1\/auth\/otp\/request$/, auth: false },
  { methods: ["POST"], pattern: /^v1\/auth\/otp\/verify$/, auth: false },
  { methods: ["POST"], pattern: /^v1\/auth\/logout$/, auth: true },
  { methods: ["POST"], pattern: /^v1\/maps\/resolve$/, auth: true },
  { methods: ["GET"], pattern: new RegExp(`^v1/invitations/${TOKEN}$`), auth: false },
  { methods: ["POST"], pattern: new RegExp(`^v1/invitations/${TOKEN}/accept$`), auth: true },
  { methods: ["GET", "POST"], pattern: /^v1\/trips$/, auth: true },
  { methods: ["GET", "PATCH"], pattern: new RegExp(`^v1/trips/${UUID}/?$`), auth: true },
  { methods: ["GET"], pattern: new RegExp(`^v1/trips/${UUID}/members$`), auth: true },
  { methods: ["PATCH", "DELETE"], pattern: new RegExp(`^v1/trips/${UUID}/members/${UUID}$`), auth: true },
  { methods: ["GET", "POST"], pattern: new RegExp(`^v1/trips/${UUID}/invitations$`), auth: true },
  { methods: ["POST"], pattern: new RegExp(`^v1/trips/${UUID}/invitations/${UUID}/resend$`), auth: true },
  { methods: ["DELETE"], pattern: new RegExp(`^v1/trips/${UUID}/invitations/${UUID}$`), auth: true },
  { methods: ["GET", "POST"], pattern: new RegExp(`^v1/trips/${UUID}/groups$`), auth: true },
  { methods: ["PATCH", "DELETE"], pattern: new RegExp(`^v1/trips/${UUID}/groups/${UUID}$`), auth: true },
  { methods: ["GET"], pattern: new RegExp(`^v1/trips/${UUID}/itinerary$`), auth: true },
  { methods: ["PATCH"], pattern: new RegExp(`^v1/trips/${UUID}/days/${UUID}$`), auth: true },
  { methods: ["POST"], pattern: new RegExp(`^v1/trips/${UUID}/days/${UUID}/items$`), auth: true },
  { methods: ["POST"], pattern: new RegExp(`^v1/trips/${UUID}/days/${UUID}/edges$`), auth: true },
  { methods: ["PATCH", "DELETE"], pattern: new RegExp(`^v1/trips/${UUID}/items/${UUID}$`), auth: true },
  { methods: ["PATCH", "DELETE"], pattern: new RegExp(`^v1/trips/${UUID}/edges/${UUID}$`), auth: true },
  { methods: ["GET", "POST"], pattern: new RegExp(`^v1/trips/${UUID}/notes$`), auth: true },
  { methods: ["PATCH", "DELETE"], pattern: new RegExp(`^v1/trips/${UUID}/notes/${UUID}$`), auth: true },
  { methods: ["GET", "POST"], pattern: new RegExp(`^v1/trips/${UUID}/expenses$`), auth: true },
  { methods: ["PATCH", "DELETE"], pattern: new RegExp(`^v1/trips/${UUID}/expenses/${UUID}$`), auth: true },
  { methods: ["GET"], pattern: new RegExp(`^v1/trips/${UUID}/ledger$`), auth: true },
  { methods: ["GET", "POST"], pattern: new RegExp(`^v1/trips/${UUID}/settlements$`), auth: true },
];

const MAX_BODY_BYTES = 1_000_000;
const MAX_RESPONSE_BYTES = 5_000_000;

function fail(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status, headers: { "cache-control": "no-store" } });
}

function sameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === request.nextUrl.host;
  } catch {
    return false;
  }
}

async function handler(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const upstreamPath = ["v1", ...path].join("/");
  const route = ROUTES.find((candidate) => candidate.pattern.test(upstreamPath));
  if (!route) return fail(404, "not_found", "This API route is not available.");
  if (!route.methods.includes(request.method)) return fail(405, "method_not_allowed", "Method not allowed.");

  const query = request.nextUrl.searchParams;
  const allowedQuery =
    request.method === "DELETE" &&
    [...query.keys()].every((key) => key === "version") &&
    /^\d{1,9}$/.test(query.get("version") ?? "");
  if (request.nextUrl.search && !allowedQuery) {
    return fail(400, "validation_error", "Query parameters are not supported.");
  }

  const mutation = !["GET", "HEAD"].includes(request.method);
  if (mutation && !sameOrigin(request)) {
    return fail(403, "forbidden", "Request origin is not allowed.");
  }

  let body: ArrayBuffer | undefined;
  if (mutation) {
    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().startsWith("application/json")) {
      return fail(415, "unsupported_media_type", "Expected an application/json body.");
    }
    const declared = Number(request.headers.get("content-length") ?? "0");
    if (declared > MAX_BODY_BYTES) return fail(413, "payload_too_large", "Request is too large.");
    body = await request.arrayBuffer();
    if (body.byteLength > MAX_BODY_BYTES) return fail(413, "payload_too_large", "Request is too large.");
  }

  const base = process.env.INTERNAL_API_BASE_URL;
  if (!base) return fail(503, "unavailable", "The service is not configured.");
  const headers = new Headers({ accept: "application/json" });
  if (body) headers.set("content-type", "application/json");
  const cookie = request.headers.get("cookie");
  if (cookie) headers.set("cookie", cookie);
  const internalToken = process.env.INTERNAL_API_TOKEN;
  if (internalToken) headers.set("x-internal-token", internalToken);
  const csrf = request.headers.get("x-csrf-token");
  if (csrf) headers.set("x-csrf-token", csrf);
  const origin = request.headers.get("origin");
  if (origin && sameOrigin(request)) headers.set("origin", origin);
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) headers.set("x-forwarded-for", forwardedFor);

  let upstream: Response;
  try {
    const suffix = allowedQuery ? `?version=${query.get("version")}` : "";
    upstream = await fetch(`${base.replace(/\/$/, "")}/${upstreamPath}${suffix}`, {
      method: request.method,
      headers,
      body,
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    return fail(502, "upstream_unavailable", "The service is temporarily unavailable.");
  }

  const length = Number(upstream.headers.get("content-length") ?? "0");
  if (length > MAX_RESPONSE_BYTES) return fail(502, "upstream_error", "The service returned an invalid response.");

  const bytes = await upstream.arrayBuffer();
  if (bytes.byteLength > MAX_RESPONSE_BYTES) {
    return fail(502, "upstream_error", "The service returned an invalid response.");
  }

  const responseHeaders = new Headers({
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  for (const value of upstream.headers.getSetCookie()) {
    responseHeaders.append("set-cookie", value);
  }
  const requestId = upstream.headers.get("x-request-id");
  if (requestId) responseHeaders.set("x-request-id", requestId);

  return new NextResponse(bytes, { status: upstream.status, headers: responseHeaders });
}

export const GET = handler;
export const POST = handler;
export const PATCH = handler;
export const DELETE = handler;
