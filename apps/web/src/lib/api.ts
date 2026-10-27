import { cookies } from "next/headers";
import type { ApiEnvelope, ApiFailure, User } from "./types";

export class ApiError extends Error {
  status: number;
  code: string;
  fields?: Record<string, string>;
  requestId?: string;

  constructor(status: number, message: string, code = "error", fields?: Record<string, string>, requestId?: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
    this.requestId = requestId;
  }
}

function baseURL(): string {
  const url = process.env.INTERNAL_API_BASE_URL;
  if (!url) {
    throw new Error("INTERNAL_API_BASE_URL is not configured");
  }
  return url.replace(/\/$/, "");
}

export async function serverApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  const cookieStore = await cookies();
  const headers = new Headers(init.headers);
  headers.set("accept", "application/json");
  if (init.body) headers.set("content-type", "application/json");
  const cookie = cookieStore.toString();
  if (cookie) headers.set("cookie", cookie);
  const internalToken = process.env.INTERNAL_API_TOKEN;
  if (internalToken) headers.set("x-internal-token", internalToken);

  const response = await fetch(`${baseURL()}${path}`, {
    ...init,
    headers,
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const payload = (await response.json().catch(() => ({}))) as ApiEnvelope<T> & ApiFailure;
  if (!response.ok) {
    throw new ApiError(
      response.status,
      payload.error?.message ?? "Something went wrong. Please try again.",
      payload.error?.code ?? "error",
      payload.error?.fields,
      payload.error?.request_id,
    );
  }
  return payload.data;
}

export async function getSessionUser(): Promise<User | null> {
  try {
    const result = await serverApi<{ user: User }>("/v1/auth/me");
    return result.user ?? null;
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 404)) return null;
    throw error;
  }
}

export async function requireUser(): Promise<User> {
  const user = await getSessionUser();
  if (!user) throw new ApiError(401, "Sign in to continue.");
  return user;
}
