# Wayfarer

Wayfarer is a collaborative travel planner built around an editable itinerary graph. Plans can be viewed as a schedule, timeline, map, or connected graph, so a trip reads the same whether you are arranging stops or navigating them.

## Features

- Passwordless email OTP authentication with invite-only trip sharing
- Trip workspaces with owner, editor, and viewer roles
- Itinerary days and stops with locations, times, costs, notes, and links
- React Flow itinerary graph with drag-to-arrange and editable travel legs
- Schedule, timeline, list, and graph views
- Leaflet map with keyless street and satellite basemaps
- Schematic route lines that follow the itinerary graph
- Group management, per-person costs, and expense splitting in minor currency units
- Shared trip notes with versioned updates
- Responsive, accessible interface with explicit empty and failure states

## Architecture

```text
Browser
  -> Next.js App Router (Vercel)
     -> same-origin /api/v1 BFF proxy
        -> Go API (Koyeb, token-gated HTTPS)
           -> PostgreSQL (Neon)
```

- The browser never calls the Go API directly.
- The Next.js BFF adds `X-Internal-Token` from a server-only environment variable.
- Session cookies remain on the web origin.
- OTP/session secrets, SMTP credentials, and the database URL stay in backend configuration.
- Map tiles require no API key.

## Stack

- **Web:** Next.js 16, React 19, TypeScript, Tailwind CSS, React Flow, Leaflet
- **API:** Go 1.24, Chi, pgx/v5
- **Database:** PostgreSQL 16 (Neon in production)
- **Monorepo:** pnpm workspace

## Repository layout

```text
apps/web/          Next.js frontend and API proxy
apps/api/          Go API, migration and seed commands
db/migrations/     PostgreSQL migrations
deploy/            Koyeb/Vercel/Neon deployment notes
docs/              Product, architecture, database, security and delivery docs
compose.yaml       Local PostgreSQL
```

## Local development

Prerequisites: Node.js 20.9+, pnpm 11, Go 1.24+, Docker.

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Start PostgreSQL:

   ```bash
   docker compose up -d postgres
   ```

   The local database listens on `localhost:5433` with database `wayfarer`, user `wayfarer`, and the local-only password from `compose.yaml`.

3. Configure the API:

   ```bash
   cp apps/api/config.example.json apps/api/config.json
   ```

   Set the local `DATABASE_URL` and development secrets. For local email testing, `mail_mode: "dev"` prints OTP codes to the API log instead of sending email.

4. Run migrations:

   ```bash
   cd apps/api
   go run ./cmd/migrate -dir ../../db/migrations
   ```

5. Configure the web app:

   ```bash
   cp apps/web/.env.example apps/web/.env.local
   ```

   Set `INTERNAL_API_BASE_URL=http://localhost:8080` and `INTERNAL_API_TOKEN` to the same token used by the API. These are server-only values; never prefix them with `NEXT_PUBLIC_`.

6. Start both services:

   ```bash
   pnpm dev:api
   pnpm dev
   ```

   Web: `http://localhost:3000`  
   API readiness: `http://localhost:8080/readyz`

Optional development data:

```bash
pnpm seed:dev
```

Seed data is for local development only.

## Environment

### API

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `WEB_ORIGIN` | Allowed web origin(s), comma-separated |
| `PUBLIC_WEB_URL` | Public HTTPS web URL used in invite links |
| `INTERNAL_API_TOKEN` | Shared BFF-to-API token, at least 32 characters |
| `SESSION_SECRET` | Session signing secret, at least 32 characters |
| `OTP_HMAC_SECRET` | OTP hashing secret, at least 32 characters |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `MAIL_FROM` | SMTP delivery |
| `MAIL_MODE` | `smtp` in production, `dev` locally |
| `TRUST_PROXY_HEADER` | Honor proxy headers behind Koyeb/Vercel |

### Web

| Variable | Purpose |
| --- | --- |
| `INTERNAL_API_BASE_URL` | Server-only base URL of the Go API |
| `INTERNAL_API_TOKEN` | Server-only shared token; must match the API |

Never expose the API token, session secrets, SMTP credentials, or database URL to client JavaScript.

## Maps

- Street basemap: © OpenStreetMap contributors via `tile.openstreetmap.de`
- Satellite basemap: Esri World Imagery and contributors
- No map API key is required.
- Route lines are schematic connections from the itinerary graph, not live road routing or guaranteed travel durations.
- If tiles are unavailable, the itinerary, graph, and schedule remain usable.

## Testing and checks

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
go -C apps/api test ./...
go -C apps/api vet ./...
```

The optional browser suite is available through `pnpm test:e2e` when its browser runtime is installed.

## Deployment

1. Create a Neon PostgreSQL database and run the migrations against the pooled `DATABASE_URL`.
2. Deploy the Go API with `apps/api/Dockerfile` to Koyeb.
3. Expose the API over HTTPS and require `X-Internal-Token` on every `/v1` route.
4. Deploy `apps/web` to Vercel with root directory `apps/web`.
5. Set only these server-side web variables in Vercel Project Settings:
   - `INTERNAL_API_BASE_URL`
   - `INTERNAL_API_TOKEN`
6. Set `WEB_ORIGIN` and `PUBLIC_WEB_URL` on the API to the final Vercel URL.
7. Run a production smoke test: login, invite acceptance, trip creation, itinerary edits, map, expense split, notes, and logout.

See `deploy/deployment.json` and `deploy/koyeb.json` for the deployment blueprint.

## Security notes

- Rotate any credential that has appeared in chat, logs, or screenshots, including database and email app passwords.
- Use long random secrets for sessions, OTP hashing, and the internal API token.
- Keep the API token server-side; a public API endpoint is acceptable only because every `/v1` route requires the shared token.
- The production CSP allowlists the map tile hosts and permits no arbitrary scripts.
- Back up the database before destructive maintenance.

## Documentation

- [Product specification](docs/PRODUCT_SPEC.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Database design](docs/DATABASE_DESIGN.md)
- [Security checklist](docs/SECURITY_CHECKLIST.md)
- [Implementation plan](docs/IMPLEMENTATION_PLAN.md)

## License

See [LICENSE](LICENSE).
