# Wayfarer — Implementation Plan

Status legend: **done**, **in progress**, **remaining**.

## Milestone 0 — Foundation
- [x] Read planning kit and capture architecture/security constraints.
- [x] Scaffold pnpm monorepo, `.gitignore`, env examples, local Postgres compose, deployment JSON.
- [x] Migration `0001_init.sql` with constraints, indexes, trigger and down path.
- [x] Go config validation, pgx pool, structured logging, request IDs, timeouts, graceful shutdown, `/healthz`, `/readyz`.
- [x] Next.js App Router scaffold, design tokens, CSP/security headers.

## Milestone 1 — Authentication
- [x] Cryptographically random six-digit OTP, HMAC digest, expiry/attempts/cooldown/rate limits.
- [x] Gmail SMTP app-password mailer + dev mail sink (explicit `MAIL_MODE=dev` only).
- [x] OTP request/verify, first-login user creation, hashed opaque session, cookie, logout, me.
- [x] CSRF double-submit + Origin middleware.
- [x] Allowlisted BFF route handler with bounded forwarding.
- [x] Sign-in UI with request/verify states, dev code display only in dev mode.
- [x] Unit tests for OTP digest/expiry/attempt behavior; auth middleware tests.

## Milestone 2 — Trips and collaboration
- [x] Trips CRUD/archive, owner/editor/viewer policy, dashboard tabs.
- [x] Invitations: email, role, hashed one-time token, expiry/revocation/resend, email match, race-safe acceptance.
- [x] Members management and role changes.
- [x] Groups CRUD and membership.
- [x] Invitation preview/accept UI.

## Milestone 3 — Itinerary graph
- [x] Days/items/edges repositories with role checks and versioning.
- [x] Graph workspace with React Flow custom nodes, drag persistence, connect-to-create, inspector.
- [x] Timeline, List and branch/group comparison.
- [x] Leaflet map with OSM.de street + Esri satellite toggle, markers, known-coordinate lines, graceful tile failure; no map API key.
- [x] Day filters and group filters; responsive mobile default to List.
- [x] PDF planner export via jsPDF + print stylesheet.
- [x] Graph validation tests (self-edge, cross-day, duplicate, membership).

## Milestone 4 — Notes and money
- [x] Markdown notes, pinned state, autosave status, version conflict recovery, raw HTML disabled.
- [x] Expenses with payer/participants/equal & custom splits in integer minor units.
- [x] Per-currency balances and suggested settlements; explicit settlement entries.
- [x] Unit tests for split remainder, custom sum, settlement algorithm, currency separation.

## Milestone 5 — Polish and verification
- [x] Loading, empty, error and destructive-confirmation states; keyboard/focus styles; reduced motion.
- [x] Responsive layouts and mobile planner alternative.
- [x] Seed command gated to development environment.
- [x] Run `go test ./...`, web lint/typecheck/unit tests/build.
- [x] Docker build for Go API; Koyeb JSON and Vercel config.
- [ ] Run live smoke test against local Postgres/API/web (document result).
- [ ] Playwright happy-path suite (OTP → trip → graph → invite → note → expense) against local stack.

## Known limitations / deliberate MVP choices
- No live routing/traffic/geocoding. Map lines are straight known-coordinate connectors.
- No cross-currency conversion or consolidation.
- OTP rate limits are DB-backed per instance; a distributed Redis limiter is a future hardening step.
- Single owner; explicit transfer flow intentionally omitted.
- PDF export is client-generated from currently loaded data, so very large trips are bounded by browser memory.
