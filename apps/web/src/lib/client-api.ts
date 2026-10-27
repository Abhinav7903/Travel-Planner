import type { ApiEnvelope, ApiFailure } from "./types";

export class BrowserApiError extends Error {
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

function csrfToken(): string {
  return (
    document.cookie
      .split("; ")
      .find((part) => part.startsWith("wf_csrf="))
      ?.slice("wf_csrf=".length) ?? ""
  );
}

export async function browserApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("accept", "application/json");
  if (init.body) headers.set("content-type", "application/json");
  if (init.method && !["GET", "HEAD"].includes(init.method.toUpperCase())) {
    headers.set("x-csrf-token", csrfToken());
  }
  const response = await fetch(path, {
    ...init,
    headers,
    credentials: "same-origin",
  });
  const payload = (await response.json().catch(() => ({}))) as ApiEnvelope<T> & ApiFailure;
  if (!response.ok) {
    throw new BrowserApiError(
      response.status,
      payload.error?.message ?? "Something went wrong. Please try again.",
      payload.error?.code ?? "error",
      payload.error?.fields,
      payload.error?.request_id,
    );
  }
  return payload.data;
}
