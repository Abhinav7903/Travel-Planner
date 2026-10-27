# Wayfarer — Security Checklist

## Secrets and environment
- [x] `DATABASE_URL`, Gmail SMTP app password, `OTP_HMAC_SECRET`, `SESSION_SECRET` only in Go-only config/environment; `apps/api/config.json` is ignored by Git and Docker.
- [x] Web only receives server-only `INTERNAL_API_BASE_URL` and `INTERNAL_API_TOKEN`; no API origin or token uses `NEXT_PUBLIC_`.
- [x] `.env.example` and `config.example.json` contain placeholders only; `.gitignore` excludes `.env`, `apps/api/config.json`, and secrets. Docker build excludes `apps/api/config.json`.
- [ ] Developer rotates any credential previously pasted into chat before production use.
- [x] No OTP, session token, invite token, note body or DB URL in normal logs.

## Authentication
- [x] OTP generated with `crypto/rand`.
- [x] HMAC-SHA-256 keyed digest stored; raw code never persisted.
- [x] 10-minute expiry, max 5 attempts, 60-second cooldown, single use.
- [x] DB-backed rate limits per email and IP.
- [x] Generic request/verify responses (no account enumeration).
- [x] Session token 32 random bytes; only SHA-256 hash stored.
- [x] `HttpOnly; Secure (production); SameSite=Lax; Path=/`, host-only cookie.
- [x] Logout revokes session; expired/revoked sessions rejected.
- [x] No credentials in localStorage/sessionStorage.

## CSRF and transport
- [x] State-changing cookie-authenticated requests require matching `wf_csrf` cookie + `X-CSRF-Token`.
- [x] Origin allowlist validation on mutations.
- [x] Same-origin browser access through the BFF; Go origin is never sent to browser code. The public Koyeb endpoint requires `X-Internal-Token` on every `/v1` route.
- [x] BFF allowlist, method validation, body limit, timeout, header allowlist, multiple Set-Cookie preservation.
- [x] Security headers + static CSP allowlist; `productionBrowserSourceMaps: false`.
- [x] HTTPS required in production (Vercel/Koyeb). Secure cookie gated by `APP_ENV`.

## Authorization
- [x] Membership and role checked in SQL for every trip-scoped operation.
- [x] Viewers read-only; editors mutate content; owner manages settings/members/invites.
- [x] Group/item/edge IDs validated against the trip, not trusted from body.
- [x] Invite email match enforced after login.
- [x] Invite tokens random, hashed at rest, one-time, 7-day expiry, revocable.
- [x] Owner cannot be removed or invited to downgrade; single-owner constraint.
- [x] Expense splits constrained to trip members; sum checked transactionally.

## Input and data
- [x] Server-side validation for all writes; parameterized SQL only.
- [x] 1 MB body limit; bounded strings; pagination for lists.
- [x] DB constraints for roles, money, coordinates, dates, self-edges, duplicates.
- [x] Markdown rendered with raw HTML disabled; links sanitized by react-markdown.
- [x] Time zone validated (`time.LoadLocation`); currency uppercase ISO-shaped check.
- [x] User-safe error codes; no SQL/stack traces returned.

## Deployment
- [x] Backend Docker image runs as non-root with health check.
- [x] JSON deployment configs contain placeholders, never secrets.
- [x] Neon connects with TLS; pool configured with sane limits and timeouts.
- [x] Graceful shutdown and request timeouts.
- [ ] Rotate Neon role password, set production secrets in Koyeb/Vercel dashboards.
- [ ] Review migration SQL before applying to production.
