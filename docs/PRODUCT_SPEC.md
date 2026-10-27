# Wayfarer — Product Specification

## Product promise

Wayfarer is a collaborative trip planner whose centerpiece is a **time-aware itinerary graph**. A trip is a sequence of places and activities connected by travel legs. Groups can branch onto different paths for a day, then rejoin. Every change is reflected in Graph, Timeline, Map, List and the exported PDF planner.

## Users and roles

| Role | Capabilities |
| --- | --- |
| Anonymous | Request/verify OTP, view invitation preview after sign-in prompt |
| Viewer | Read trip, itinerary, notes and expenses; cannot mutate |
| Editor | Create/edit/delete itinerary, groups, notes and expenses; invite viewers/editors |
| Owner | Everything an editor can do, plus trip settings, member roles/removal, invitation revocation and archiving |

Exactly one owner exists for the MVP. Ownership transfer is intentionally out of scope.

## Journeys

### 1. Passwordless sign-in
1. User enters email on `/sign-in`.
2. API returns a generic `202` response whether or not the account exists.
3. A six-digit code is emailed through Gmail SMTP using the configured app password (or a dev-only sink).
4. User enters the code; first verification creates the account and starts a session.
5. Codes expire after 10 minutes, tolerate 5 attempts, have a 60-second resend cooldown and are single use.

### 2. Create and share a trip
1. Dashboard opens on **My trips** with **Shared** and **Archived** tabs.
2. Create trip collects title, destination, dates, IANA timezone, ISO currency, description and optional cover URL.
3. Owner invites by email at editor or viewer role. The invitation email contains a one-time link expiring in seven days.
4. The invitee signs in with the matching email and accepts. Duplicate/race-safe acceptance returns the existing membership.

### 3. Plan on the graph
1. Trip workspace opens with a day picker and modes **Graph**, **Timeline**, **Map**, **List**; mobile defaults to List/Timeline.
2. Users add itinerary items (places/activities) with local start/end time, category, address, coordinates, notes, estimated cost, link and group.
3. Dragging items persists `x/y` layout coordinates. Connecting two nodes creates a directed travel leg.
4. Travel legs capture mode (walk/transit/car/flight/ferry/other), duration, optional distance, departure/arrival notes. Manual durations are clearly labelled as estimates.
5. Groups can be assigned to items and legs; Timeline and List compare branched paths.
6. Selecting a node/leg opens a right-hand inspector with edit and delete actions.
7. Keyboard users can tab to nodes and open the inspector; mobile users get the same planner through List/Timeline and a zoomable graph.

### 4. Notes
- Markdown notes with title, pin, author and timestamps.
- Raw HTML is disabled when rendering.
- Autosave uses optimistic concurrency (`version`); conflicts are surfaced without discarding the draft.

### 5. Expenses
- Expenses have payer, integer minor-unit amount, ISO currency, category, date, note, optional group and participants.
- Equal splits distribute the remaining minor units deterministically (payer then participant order).
- Custom splits must sum exactly to the total.
- Balances are grouped per currency. Suggested settlements never cross currencies and never mutate source expenses.
- Recording a settlement creates a new explicit settlement entry.

### 6. Export
- **Export PDF** builds a printable planner directly in the browser with:
  - cover, destination, dates, timezone;
  - per-day schedule with start/end times;
  - travel legs, durations and groups;
  - known coordinates and map caveat;
  - optional notes and expense balance summary.
- The PDF is generated from the loaded trip data; no hidden route estimates are invented.

## Information architecture

```
/                       landing
/sign-in                OTP request + verification
/dashboard              owned/shared/archived trips
/trips/:id              trip overview
/trips/:id/plan         graph/timeline/map/list workspace + PDF export
/trips/:id/notes        shared Markdown notes
/trips/:id/expenses     expenses, balances, settlements
/trips/:id/members      members, invitations, groups
/trips/:id/settings     trip settings + archive
/invite/:token          invitation acceptance
```

## Design direction

Warm off-white canvas, charcoal ink, one forest/teal accent, fine neutral borders, generous spacing, crisp cards, restrained motion. Server components by default; client components only for interactivity. Visible controls are functional or explicitly disabled with an explanation. Loading skeletons, empty states, recoverable errors, focus-visible rings, reduced-motion support.

## Explicit non-goals for MVP

- Live traffic, live geocoding or verified road routing.
- Multi-owner transfer.
- Cross-currency consolidation.
- Real-time multi-cursor collaboration (autosave/version checks only).
- Gmail inbox integration.
