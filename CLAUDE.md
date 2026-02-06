# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ShiftMD is a full-stack application for a doctor working across multiple hospitals/clinics in Portugal to track shifts, calculate earnings (with dynamic pricing rules for nights/weekends/holidays), and estimate Portuguese taxes (IRS, Social Security, withholding). Go module: `github.com/joao-moreira/doctor-tracker`.

## Build & Run Commands

### Full Stack (Docker Compose)
```bash
docker compose up -d                    # Start all services (postgres, migrate, backend, frontend)
docker compose down                     # Stop everything
```

### Backend (Go)
```bash
cd backend
make setup                              # docker-up + wait + migrate-up (first-time setup)
make dev                                # Run with hot reload (go run, sets DT_JWT_SECRET=dev-secret)
make build                              # Compile to bin/doctor-tracker
make test                               # go test ./... -v -race
make lint                               # golangci-lint run ./...
make migrate-up                         # Apply all pending migrations
make migrate-down                       # Rollback one migration
make migrate-create                     # Create new migration files (interactive)
```

Run a single Go test:
```bash
go test ./internal/domain/auth/... -v -run TestRegister
```

### Frontend (pnpm + Turborepo)
```bash
cd frontend
pnpm install                            # Install all workspace dependencies
pnpm dev                                # Start all apps in dev mode
pnpm dev:web                            # Start web app only (port 5173)
pnpm build                              # Build all packages
pnpm test                               # Run all tests (vitest)
pnpm lint                               # Lint all packages
pnpm typecheck                          # Type-check all packages
```

Run a single frontend test:
```bash
cd frontend/apps/web && npx vitest run src/components/layout/Layout.test.tsx
cd frontend/packages/shared && npx vitest run src/utils/tax.test.ts
```

## Architecture

### Backend — Hexagonal (Ports & Adapters)

```
backend/
├── cmd/server/main.go          # Entry point: wires repos → services → handlers → server
├── internal/
│   ├── domain/                 # Core business logic (zero framework deps)
│   │   ├── auth/               # User auth: register, login, JWT, refresh tokens
│   │   ├── schedule/           # Shifts: CRUD, auto-earnings calculation
│   │   ├── workplace/          # Workplaces + pricing rules + pricing resolution engine
│   │   ├── finance/            # Invoices, earnings aggregation
│   │   └── tax/                # Portuguese tax engine (IRS brackets, SS, withholding)
│   ├── adapter/                # Infrastructure implementations
│   │   ├── postgres/           # Repository implementations (raw pgx SQL, no ORM)
│   │   ├── http/               # Chi router, handlers, middleware, DTOs
│   │   └── gcal/               # Google Calendar OAuth + two-way sync
│   └── config/                 # koanf config: YAML → env vars (DT_ prefix) → defaults
├── pkg/                        # Shared utilities: money (cents), clock (testable time), pagination
└── db/migrations/              # golang-migrate SQL files
```

**Key pattern**: Each domain package defines a `Repository` interface (port). The `postgres/` adapter implements it. Services depend only on interfaces. `main.go` wires everything together.

**Pricing resolution** (`workplace/pricing.go`): When a shift is created, `ResolveShiftEarnings()` splits it at midnight and rule-time boundaries, then matches each segment to priority-ordered pricing rules to compute per-segment earnings.

**Config loading order**: `config.yaml` → environment variables with `DT_` prefix (e.g., `DT_DATABASE_HOST`) → hardcoded defaults. JWT secret (`DT_JWT_SECRET`) is the only required config value.

### Frontend — Monorepo

```
frontend/
├── apps/web/                   # React 19 + Vite 6 + TypeScript 5.7
│   ├── src/
│   │   ├── routes/             # Page components (dashboard, calendar, workplaces, finance, settings, login)
│   │   ├── components/         # UI components organized by feature
│   │   ├── lib/api.ts          # Instantiates shared API client with web token provider
│   │   ├── i18n/               # i18next: English + Portuguese
│   │   └── styles/globals.css  # Tailwind + FullCalendar overrides
│   └── vite.config.ts          # @/ alias, /api proxy → localhost:8080
└── packages/shared/            # Platform-agnostic shared code
    ├── api/                    # ky HTTP client with auto-auth refresh + endpoint wrappers
    ├── hooks/                  # TanStack Query hook factories (useAuth, useShifts, useWorkplaces, useFinance, useGCal)
    ├── types/                  # TypeScript interfaces mirroring backend models
    ├── schemas/                # Zod validation schemas
    ├── stores/                 # Zustand store (calendar state, theme, sidebar)
    ├── utils/                  # currency formatting, Portuguese tax calculator (client-side)
    └── constants/              # Tax brackets (2025/2026), pay model metadata
```

**State management** (3-layer): server state via TanStack Query v5, client state via Zustand (persisted to localStorage), form state via React Hook Form + Zod.

**API client** (`shared/api/client.ts`): Uses `ky` with automatic token injection, 401 → refresh token → retry flow, and 30s timeout.

### Database

PostgreSQL 16 with `uuid-ossp` and `btree_gist` extensions. All monetary values stored as integer cents (`money.Cents` in Go, `centsToEuros()`/`eurosToCents()` in TS). Shifts have an exclusion constraint preventing overlapping non-cancelled shifts per user.

### API

All endpoints at `/api/v1/`. Public: `/auth/register`, `/auth/login`, `/auth/refresh`. All others require Bearer token via `Authorization` header. Response envelope: `{ data, error }`.

## Conventions

- **Money**: Always integer cents. Use `money.Cents` (Go) and `eurosToCents()`/`centsToEuros()` (TS). Never use floats for currency.
- **Tests (Go)**: Hand-rolled mock repositories implementing domain interfaces. No mockgen/gomock. `testutil.NewTestDB()` exists for integration tests using testcontainers (PostgreSQL 16 Alpine).
- **Tests (Frontend)**: Vitest with `@testing-library/react` for web, plain vitest for shared utils.
- **Tax logic is duplicated**: Go `tax.PortugalEngine` and TS `calculatePortugueseTax()` both implement Portuguese IRS calculation. Changes must be kept in sync.
- **i18n**: All user-facing strings go through i18next. Locales in `frontend/apps/web/src/i18n/locales/{en,pt}.json`.
- **Imports**: Frontend uses `@/` path alias for `apps/web/src/`. Shared package exports via `@doctor-tracker/shared/<subpath>`.
