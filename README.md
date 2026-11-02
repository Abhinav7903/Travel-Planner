# ✈️ Wayfarer

<p align="center">
  <strong>A modern, collaborative travel planner built around an editable itinerary graph.</strong><br>
  Plan trips visually as a schedule, timeline, interactive map, or connected graph.<br>
  Zero paid APIs. Zero AI gimmicks. 100% free, private, and open source.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16.4-black?style=flat-square&logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/React-19-blue?style=flat-square&logo=react" alt="React 19" />
  <img src="https://img.shields.io/badge/Go-1.24-00ADD8?style=flat-square&logo=go" alt="Go 1.24" />
  <img src="https://img.shields.io/badge/PostgreSQL-16-4169E1?style=flat-square&logo=postgresql" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-v4-38B2AC?style=flat-square&logo=tailwind-css" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="MIT License" />
  <img src="https://img.shields.io/badge/APIs-100%25_Free_%26_Open-brightgreen?style=flat-square" alt="Zero Paid APIs" />
</p>

---

## 📖 Table of Contents

- [Overview](#-overview)
- [Key Features](#-key-features)
- [Architecture & Security Model](#-architecture--security-model)
- [Tech Stack](#-tech-stack)
- [Repository Structure](#-repository-structure)
- [Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [1. Clone & Install Dependencies](#1-clone--install-dependencies)
  - [2. Start PostgreSQL](#2-start-postgresql)
  - [3. Configure & Run Backend API](#3-configure--run-backend-api)
  - [4. Configure & Run Web App](#4-configure--run-run-web-app)
  - [5. Seed Sample Data (Optional)](#5-seed-sample-data-optional)
- [Environment Configuration](#-environment-configuration)
- [Testing & Quality Verification](#-testing--quality-verification)
- [Deployment](#-deployment)
- [Design Principles](#-design-principles)
- [Documentation](#-documentation)
- [License](#-license)

---

## 🌟 Overview

Most travel planners force you into rigid spreadsheets or static lists that don't reflect how travel actually works. **Wayfarer** models trips as a connected graph of destinations, activities, and travel legs. 

Whether you're organizing a solo road trip or coordinating flights and expenses with a group of friends, Wayfarer provides the tools you need in one unified, real-time workspace.

---

## 🚀 Key Features

### 🗺️ Visual Itinerary & Graph Workspace
- **Connected Graph Editing:** Drag-to-arrange nodes powered by React Flow with editable travel legs (drive, flight, transit, walk, ferry).
- **Multi-Perspective Views:** Seamlessly toggle between **Schedule**, **Timeline**, **Map**, and **Graph** views.
- **Rich Stop Metadata:** Pin exact locations, start/end times, costs, attachments, links, and traveler notes.

### 🌍 Interactive Maps & 1-Tap Directions
- **Keyless Basemaps:** Leaflet-powered maps with OpenStreetMap street tiles and Esri World Imagery satellite views — requiring zero paid map tokens or API keys.
- **Schematic Route Overlays:** Dynamic route lines reflect your planned itinerary legs.
- **1-Tap Navigation:** Instant one-click deep links to get directions in **Google Maps**, **Apple Maps**, or **OpenStreetMap**.

### 🌦️ Live Open-Source Weather Forecasts
- **Zero-Key Forecasts:** Powered by [Open-Meteo](https://open-meteo.com) — 100% free, open, and privacy-respecting.
- **Per-Day Weather Badges:** Displays WMO condition icons and daily high/low temperatures directly on your itinerary timeline.
- **Client-Side Caching:** Built-in in-memory cache to prevent redundant network calls.

### 📅 Calendar Sync (.ics) & PDF Export
- **RFC 5545 iCalendar Exporter:** 1-click export of your complete trip to `.ics` format. Native import into **Apple Calendar**, **Google Calendar**, and **Microsoft Outlook** with exact dates, timezones, locations, and notes.
- **Printable Trip Dossier:** Clean, printable PDF export for offline access during flights or remote adventures.

### 💰 Expense Splitting, Budgeting & Analytics
- **Minor-Unit Precision:** All monetary amounts are handled strictly in integer minor currency units (cents) to eliminate floating-point rounding drift.
- **Target Trip Budget Tracker:** Set a trip spending goal with a visual progress bar, real-time remaining allowance, and over-budget warnings.
- **Category Spending Distribution:** Visual percentage and cost breakdown across Flights, Lodging, Food, Activities, and Transit.
- **Automated Debt Settlement:** Computes minimum transactions required to settle group balances.
- **RFC 4180 CSV Export:** Export your complete expense ledger and member splits to spreadsheet-ready CSV.

### 🎒 Packing List & Trip Checklist Workspace
- **Categorized Gear Tracking:** Organize items across *Documents*, *Clothing*, *Toiletries*, *Electronics*, *Health*, and *Gear*.
- **Progress Tracking:** Live completion percentage bar and completed item counters.
- **1-Click Starter Presets:** Preloaded packing templates for:
  - 🎒 *Trip Essentials*
  - ✈️ *International Travel*
  - 🏖️ *Beach & Warm Weather*
  - ❄️ *Cold & Winter*
- **Offline Persistence:** Automatically saves checklist changes to browser local storage.

### 📝 Group Collaboration & Versioned Notes
- **Granular Roles:** Trip access control with `Owner`, `Editor`, and `Viewer` permissions.
- **Shared Scratchpad:** Versioned Markdown trip notes with automatic conflict-aware revision tracking.
- **Invite Links:** Single-use, time-limited cryptographic trip invites.

### 🛡️ Privacy-First Security & Zero AI Gimmicks
- **No Generative AI or LLM Dependencies:** Zero unreliable hallucinated itineraries, zero tokens spent, zero personal travel data sent to third-party AI models.
- **Passwordless OTP Authentication:** Secure email one-time passcodes with rate limiting and constant-time HMAC comparisons.
- **BFF Architecture:** The browser never directly contacts the Go API; requests are proxied via Next.js server actions / routes with internal token authentication.
- **Hardened Validation:** Fortified against float `NaN`/`Inf` bypasses, data races, and nil-pointer dereferences.

---

## 🏛️ Architecture & Security Model

```text
[ Browser / Client ]
        │
        │ HTTPS (Same-Origin Cookies)
        ▼
[ Next.js 16 BFF Proxy (Vercel) ]
   • Validates session cookie
   • Enforces strict Content Security Policy (CSP)
   • Injects server-only X-Internal-Token header
        │
        │ Token-Gated HTTPS
        ▼
[ Go 1.24 Chi REST API (Koyeb) ]
   • Constant-time token verification
   • Strict input validation & NaN/Inf sanitization
   • Rate limiting & role-based access control (RBAC)
        │
        │ pgx Connection Pool
        ▼
[ PostgreSQL 16 (Neon / Local) ]
   • Normalized relational schema
   • Foreign keys with cascade rules
   • Minor-unit integer financial arithmetic
```

### Security Guarantees
1. **Server-Isolated Secrets:** The internal API token, session secrets, SMTP credentials, and database connection strings never touch the browser bundle.
2. **Strict Content Security Policy:** Script execution is strictly restricted. Only verified tile servers and the Open-Meteo weather API are allowlisted.
3. **Integer Currency Math:** No floating-point math in financial ledgers; zero penny drift.
4. **Defensive Nil & Error Handling:** Error responses and validation filters use deep copies and strict bounds checks to prevent server panics or memory disclosure.

---

## 💻 Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend Framework** | [Next.js 16](https://nextjs.org/) (App Router), [React 19](https://react.dev/), [TypeScript 5](https://www.typescriptlang.org/) |
| **Styling & UI** | [Tailwind CSS v4](https://tailwindcss.com/), Lucide Icons, Radix UI primitives |
| **Interactive Graph** | [xyflow / React Flow](https://reactflow.dev/) |
| **Mapping Engine** | [Leaflet](https://leafletjs.com/), OpenStreetMap, Esri Satellite Imagery |
| **Backend API** | [Go 1.24](https://go.dev/), [Chi](https://github.com/go-chi/chi), [pgx/v5](https://github.com/jackc/pgx) |
| **Database** | [PostgreSQL 16](https://www.postgresql.org/) (Neon in production, Docker locally) |
| **Testing** | [Vitest](https://vitest.dev/), Go standard `testing` framework |
| **Package Manager** | [pnpm](https://pnpm.io/) (Monorepo workspaces) |

---

## 📂 Repository Structure

```text
travel-planner/
├── apps/
│   ├── web/                     # Next.js 16 frontend & BFF proxy
│   │   ├── src/
│   │   │   ├── app/             # App Router pages and API routes
│   │   │   ├── components/      # UI components (Graph, Map, Weather, Checklist, etc.)
│   │   │   └── lib/             # Calendar export, CSV export, Weather client, API client
│   │   └── package.json
│   └── api/                     # Go 1.24 REST API
│       ├── cmd/
│       │   ├── api/             # Main server entrypoint
│       │   ├── migrate/         # SQL schema migration CLI
│       │   └── seed/            # Development database seeder
│       ├── internal/
│       │   ├── api/             # HTTP route handlers & middlewares
│       │   ├── apperr/          # Safe structured error subsystem
│       │   ├── auth/            # OTP generator & session token manager
│       │   ├── store/           # PostgreSQL data persistence queries
│       │   └── validate/        # Robust input & coordinate sanitization
│       └── go.mod
├── db/
│   └── migrations/              # Versioned SQL migration files
├── deploy/                      # Deployment blueprints (Koyeb, Vercel, Neon)
├── docs/                        # Architectural, security, and product specs
├── compose.yaml                 # Local PostgreSQL container configuration
└── pnpm-workspace.yaml          # Workspace configuration
```

---

## 🛠️ Getting Started

### Prerequisites
- **Node.js**: `v20.9.0` or higher
- **pnpm**: `v10` or `v11` (`npm install -g pnpm`)
- **Go**: `v1.24` or higher
- **Docker**: For running the local PostgreSQL database

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/Abhinav7903/Travel-Planner.git
cd Travel-Planner
pnpm install
```

### 2. Start PostgreSQL

Run the local PostgreSQL 16 container:

```bash
docker compose up -d postgres
```

*The database listens on `localhost:5433` with database `wayfarer`, user `wayfarer`, and password `wayfarer_local_dev`.*

### 3. Configure & Run Backend API

1. Copy the sample configuration:
   ```bash
   cp apps/api/config.example.json apps/api/config.json
   ```
2. Run database migrations:
   ```bash
   cd apps/api
   go run ./cmd/migrate -dir ../../db/migrations
   cd ../..
   ```
3. Start the API in development mode:
   ```bash
   pnpm dev:api
   ```
   *The API will be available at `http://localhost:8080`. Health check endpoint: `http://localhost:8080/readyz`.*

### 4. Configure & Run Web App

1. In a new terminal window, configure the frontend environment:
   ```bash
   cp apps/web/.env.example apps/web/.env.local
   ```
2. Start the Next.js development server:
   ```bash
   pnpm dev
   ```
3. Open **`http://localhost:3000`** in your browser.

> **💡 Local OTP Email Testing:** When `mail_mode` is set to `"dev"` in `apps/api/config.json`, login OTP verification codes are printed directly to the API terminal log.

### 5. Seed Sample Data (Optional)

To populate your local database with sample trips, itinerary items, expense ledgers, and notes:

```bash
pnpm seed:dev
```

---

## ⚙️ Environment Configuration

### Backend API (`apps/api/config.json` or Environment Variables)

| Variable | Description | Default / Example |
| :--- | :--- | :--- |
| `DATABASE_URL` | PostgreSQL connection string | `postgres://wayfarer:wayfarer_local_dev@localhost:5433/wayfarer?sslmode=disable` |
| `PORT` | API listen port | `8080` |
| `WEB_ORIGIN` | Permitted web frontend origin(s) | `http://localhost:3000` |
| `PUBLIC_WEB_URL` | Base public URL used in invite links | `http://localhost:3000` |
| `INTERNAL_API_TOKEN` | Shared secret between Next.js BFF and Go API | `min-32-char-random-internal-token-here` |
| `SESSION_SECRET` | Secret key used to sign session cookies | `min-32-char-random-session-secret-here` |
| `OTP_HMAC_SECRET` | Secret key used for hashing OTP tokens | `min-32-char-random-otp-hmac-secret-here` |
| `MAIL_MODE` | Email delivery mode (`dev` or `smtp`) | `dev` |
| `SMTP_HOST` | SMTP server host | `smtp.resend.com` |
| `SMTP_PORT` | SMTP server port | `587` |
| `SMTP_USERNAME` | SMTP login username | `resend` |
| `SMTP_PASSWORD` | SMTP password / API token | `re_123456...` |
| `MAIL_FROM` | Sender email address | `Wayfarer <trips@example.com>` |
| `TRUST_PROXY_HEADER`| Respect `X-Forwarded-*` headers | `true` (when behind Koyeb/reverse proxy) |

### Frontend Web (`apps/web/.env.local`)

| Variable | Description | Default / Example |
| :--- | :--- | :--- |
| `INTERNAL_API_BASE_URL` | URL of the Go backend (server-side only) | `http://localhost:8080` |
| `INTERNAL_API_TOKEN` | Shared token matching backend's `INTERNAL_API_TOKEN` | `min-32-char-random-internal-token-here` |

*Note: Never expose `INTERNAL_API_TOKEN` to the browser by prefixing it with `NEXT_PUBLIC_`.*

---

## 🧪 Testing & Quality Verification

Wayfarer enforces rigorous type safety, unit testing, and linting standards across the entire stack:

```bash
# Frontend TypeScript check
pnpm typecheck

# Frontend ESLint check (0 errors, 0 warnings enforced)
pnpm lint

# Frontend Vitest test suite (15 unit tests)
pnpm test

# Production Next.js build verification
pnpm build

# Go API test suite with race detector
go -C apps/api test -race ./...

# Go API vet analysis
go -C apps/api vet ./...
```

---

## 🚀 Deployment

Wayfarer is designed for effortless, low-cost or free-tier deployment across modern cloud platforms:

1. **Database (Neon):**
   - Create a free serverless PostgreSQL database on [Neon](https://neon.tech).
   - Apply schema migrations using `apps/api/cmd/migrate`.
2. **Backend API (Koyeb / Render / Fly.io):**
   - Deploy `apps/api/Dockerfile` on [Koyeb](https://koyeb.com) or any container host.
   - Configure environment variables and ensure the service is served over HTTPS.
3. **Frontend Web (Vercel):**
   - Connect the repository to [Vercel](https://vercel.com) with root directory set to `apps/web`.
   - Set `INTERNAL_API_BASE_URL` and `INTERNAL_API_TOKEN` in Vercel project settings.
   - Update `WEB_ORIGIN` and `PUBLIC_WEB_URL` on the API to match your live Vercel domain.

*Detailed deployment instructions and blueprints are available in [`deploy/deployment.json`](deploy/deployment.json) and [`deploy/koyeb.json`](deploy/koyeb.json).*

---

## 🎯 Design Principles

- **Zero Paid Dependencies:** No paid Google Maps, Mapbox, or commercial APIs required. All maps use OpenStreetMap & Esri satellite tiles, and weather uses Open-Meteo.
- **Deterministic & AI-Free:** Travel plans belong to travelers. No LLM prompts, no AI hallucination, and no unpredictable dynamic changes.
- **Resilient & Offline-Capable:** Map failure, offline status, or tile outages will never lock you out of your schedule, checklist, notes, or itinerary.
- **Precise Financials:** Every penny counts. Shared expenses are tracked with exact integer arithmetic.

---

## 📚 Documentation

For deep dives into the technical specifications and design choices:
- [Product Specification](docs/PRODUCT_SPEC.md)
- [System Architecture](docs/ARCHITECTURE.md)
- [Database Schema Design](docs/DATABASE_DESIGN.md)
- [Security Checklist](docs/SECURITY_CHECKLIST.md)
- [Implementation Plan](docs/IMPLEMENTATION_PLAN.md)

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
