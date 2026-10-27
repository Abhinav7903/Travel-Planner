# Wayfarer — Architecture

## System shape

```
Browser
  |  same-origin fetch /api/...
  v
Next.js on Vercel
  - App Router pages + client workspace
  - Route Handler BFF: explicit allowlist, bounded body/response, timeouts
  |  server-only HTTPS + X-Internal-Token + forwarded cookies
  v
Go API on Koyeb (token-gated HTTPS endpoint)
  - Chi router, pgx/v5 pool, request IDs, structured logs
  - OTP/session/authz, trip domains
  |  TLS SQL
  v
Neon PostgreSQL (pooled endpoint)
```

The browser never learns the Go origin. Only the Next.js server reads `INTERNAL_API_BASE_URL`.

## Key decisions

| Area | Decision | Why |
| --- | --- | --- |
| Monorepo | pnpm workspace + `apps/web`, `apps/api`, `db/migrations`, `docs` | One contract and one review surface |
| Web | Next.js App Router, strict TS, Tailwind v4, Geist | Server-first rendering, deployment to Vercel |
| Graph | `@xyflow/react` with custom nodes and bezier legs | Mature, keyboardable canvas, controlled layout |
| Map | Leaflet + OSM.de street tiles + Esri World Imagery satellite tiles | Replaceable keyless providers, OSM/Esri attribution, Map/Satellite toggle, no API key |
| PDF | `jsPDF` generated from current trip data | Offline-safe, real downloadable PDF, no screenshot dependence |
| API | Go 1.24, Chi, pgx/v5 | Small binary, straightforward Docker deploy, reliable pool |
| DB | Versioned SQL migrations applied manually | No startup schema mutation; Neon-friendly |
| Auth | OTP HMAC digests + hashed opaque sessions | Passwordless and no bearer tokens in localStorage |
| CSRF | Double-submit `wf_csrf` + `X-CSRF-Token` + Origin checks | Cookie-auth mutation defense without a server session store |
| Money | `BIGINT` minor units + ISO 4217 | Exact arithmetic |
| Time | `DATE` + local `TIME` + trip IANA timezone; `timestamptz` for instants | Correct trip-day semantics across zones |

## BFF contract

`apps/web/src/app/api/v1/[...path]/route.ts`:

- Allows only documented `/v1` path patterns and methods (`GET`, `POST`, `PATCH`, `DELETE`).
- Rejects unknown paths before any upstream call.
- Forwards only `accept`, `content-type`, `cookie`, `origin`, `referer`, `user-agent`, `x-request-id`; adds `X-CSRF-Token` from the `wf_csrf` cookie on mutations.
- Drops hop-by-hop headers. Does not forward arbitrary request headers or query keys.
- Enforces a 1 MB request-body limit and a 15 s upstream timeout; buffers a bounded response.
- Preserves every `Set-Cookie` header with `headers.append`.
- Returns a stable user-safe error when the API is unavailable; never exposes the upstream URL.
- Supports `GET /api/health` for deployment diagnostics (proxied `/v1/healthz`).

The route handler is not a general proxy: a new endpoint must be added to the allowlist and tested.

## Frontend rendering

- Server components fetch through the same `/api` contract only when a server-origin base is available; interactive pages use client fetching so cookies stay same-origin.
- `productionBrowserSourceMaps: false` and `poweredByHeader: false`.
- Secrets are server-only env; no `NEXT_PUBLIC_*` secrets.
- Static CSP headers allow only self, OSM.de/OSM and Esri ArcGIS tile hosts, and the inline style/worker needs of React Flow/Leaflet. The Go API origin is never added to browser CSP.
- Print CSS gives a clean planner even without JavaScript PDF generation.

## Backend layering

```
cmd/server, cmd/seed
internal/config     environment parsing/validation
internal/store      pgx pool + SQL repositories
internal/auth       OTP digest/generation, session tokens, role policy
internal/mail       Mailer interface, Gmail SMTP app-password implementation, dev sink
internal/api        Chi handlers, middleware, response envelopes
internal/money      minor-unit split and settlement algorithms
internal/validate   input normalization/validation
```

Authorization lives in store/service queries and middleware, not UI. Every trip-scoped query joins membership or uses a membership assertion.

## Running and deploying

- Local: `docker compose up -d`, apply migrations, run API on `:8080`, web on `:3000`.
- Koyeb: build `apps/api/Dockerfile`; inject `DATABASE_URL`, `SESSION_SECRET`, `OTP_HMAC_SECRET`, `INTERNAL_API_TOKEN`, `SMTP_*`, `MAIL_FROM`, `WEB_ORIGIN`, and `PUBLIC_WEB_URL`. The service listens on `$PORT`. Vercel cannot reach a Koyeb private-mesh address, so expose the Koyeb HTTPS endpoint and rely on the shared `X-Internal-Token` check on every `/v1` route; the token and origin stay server-side.
- Vercel: project root `apps/web`; set server-only `INTERNAL_API_BASE_URL` and `INTERNAL_API_TOKEN` in Project Settings (not in `vercel.json`). Set the Koyeb `WEB_ORIGIN` and `PUBLIC_WEB_URL` to the final Vercel origin.
- Neon: use the pooled connection string for the API, `sslmode=require`. Run `/app/migrate` before shifting traffic; migrations are never applied at process start.
- Maps: OSM.de street and Esri World Imagery satellite tiles need no API key. If either provider is unreachable, the map degrades to a notice while the itinerary remains usable.
