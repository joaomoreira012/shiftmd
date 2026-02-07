
# ShiftMD

Shift tracking and finance management for independent doctors in Portugal.

Track work schedules across multiple hospitals and clinics, calculate earnings with dynamic pricing rules (nights, weekends, holidays), sync with Google Calendar, and estimate Portuguese taxes (IRS, Social Security, withholding).

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Go 1.24, Chi router, pgx (PostgreSQL 16) |
| Frontend | React 19, Vite 6, TypeScript 5.7, Tailwind CSS |
| State | TanStack Query v5, Zustand, React Hook Form + Zod |
| Infrastructure | Docker Compose, golang-migrate |

## Quick Start

### Prerequisites

- Docker & Docker Compose
- Go 1.24+ (for backend development)
- Node.js 22+ and pnpm 10+ (for frontend development)

### Using Docker Compose (everything)

```bash
cp .env.example .env
docker compose up -d
```

This starts PostgreSQL, runs migrations, builds and starts the backend (port 8080), and starts the frontend dev server (port 5173).

Open http://localhost:5173 to access the app.

### Local Development (recommended)

**1. Start the database:**

```bash
cd backend
make setup    # Starts PostgreSQL via Docker, waits for healthy, runs migrations
```

**2. Start the backend:**

```bash
cd backend
make dev      # Runs on port 8080
```

**3. Start the frontend:**

```bash
cd frontend
pnpm install
pnpm dev:web  # Runs on port 5173, proxies /api to backend
```

## Project Structure

```
shiftmd/
├── backend/                 # Go API server (hexagonal architecture)
│   ├── cmd/server/          # Entry point
│   ├── internal/
│   │   ├── domain/          # Business logic (auth, schedule, workplace, finance, tax)
│   │   └── adapter/         # Infrastructure (postgres, http, gcal)
│   ├── db/migrations/       # SQL migration files
│   └── Makefile
├── frontend/                # pnpm + Turborepo monorepo
│   ├── apps/web/            # React web app
│   └── packages/shared/     # Cross-platform types, API client, hooks, utils
├── docker-compose.yml
└── ARCHITECTURE.md          # Detailed design document
```

## Environment Variables

Copy `.env.example` to `.env` for Docker Compose, or `backend/.env.example` to `backend/.env` for local backend development.

| Variable | Required | Description |
|----------|----------|-------------|
| `DT_JWT_SECRET` | Yes | Secret key for JWT signing |
| `DT_DATABASE_*` | Yes | PostgreSQL connection (host, port, user, password, dbname) |
| `DT_CORS_ALLOWED_ORIGINS` | No | Comma-separated allowed origins (default: `http://localhost:5173`) |
| `DT_GOOGLE_CLIENT_ID` | No | Google OAuth client ID (for Calendar sync) |
| `DT_GOOGLE_CLIENT_SECRET` | No | Google OAuth client secret |
| `DT_GOOGLE_REDIRECT_URL` | No | Google OAuth redirect URL |

## API

All endpoints under `/api/v1/`. Authentication via `Authorization: Bearer <token>`. Response format: `{ data, error }`.

See [docs/api.md](docs/api.md) for the full endpoint reference.

## Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md) - Detailed design document covering the full system specification
- [docs/api.md](docs/api.md) - API endpoint reference
- [docs/pricing.md](docs/pricing.md) - Dynamic pricing resolution algorithm
- [docs/tax-engine.md](docs/tax-engine.md) - Portuguese tax calculation rules

## License

Private project. All rights reserved.
