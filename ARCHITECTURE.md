# Doctor Work Tracker & Finance Manager

## Context

You are a doctor working independently at multiple locations. You need a unified application to:
- Track work schedules across workplaces with different pay models (hourly, per-turn, monthly)
- Handle dynamic pricing (rates vary by time-of-day and day-of-week)
- Visualize your schedule in a Google Calendar-like interface with two-way sync
- Project earnings and estimate Portuguese taxes (IRS, Social Security, withholding)

**Stack**: Go backend + PostgreSQL | React web + React Native mobile (Expo) | Self-hosted

---

## Project Structure Overview

```
doctor-tracker/
|-- backend/              # Go backend (chi + pgx + sqlc)
|-- frontend/
|   |-- apps/
|   |   |-- web/          # React + Vite + FullCalendar + Recharts
|   |   |-- mobile/       # Expo + React Native + NativeWind
|   |-- packages/
|       |-- shared/       # Types, API client, hooks, tax engine, validation
|       |-- tailwind-config/  # Shared design tokens
|-- docker-compose.yml    # PostgreSQL + backend for local dev
```

---

## Backend Architecture (Go)

### Tech Stack

| Concern | Library |
|---|---|
| Router | `go-chi/chi/v5` |
| DB Driver | `jackc/pgx/v5` |
| Queries | `sqlc` (type-safe SQL codegen) |
| Migrations | `golang-migrate/migrate/v4` |
| Auth | `golang-jwt/jwt/v5` |
| Validation | `go-playground/validator/v10` |
| Config | `knadh/koanf/v2` |
| Logging | `log/slog` (stdlib) |
| Google Cal | `google.golang.org/api/calendar/v3` |
| Scheduler | `go-co-op/gocron/v2` |
| Testing | `testify` + `testcontainers-go` |

### Go Project Layout (Hexagonal / Domain-Driven)

```
backend/
|-- cmd/server/main.go
|-- internal/
|   |-- domain/
|   |   |-- workplace/    # Workplace, PricingRule models + service + repository interface
|   |   |   |-- model.go
|   |   |   |-- service.go
|   |   |   |-- repository.go
|   |   |   |-- pricing.go           # Rate resolution engine
|   |   |-- schedule/
|   |   |   |-- model.go             # Shift, RecurrenceRule structs
|   |   |   |-- service.go
|   |   |   |-- repository.go
|   |   |   |-- recurrence.go        # RRULE expansion logic
|   |   |-- finance/
|   |   |   |-- model.go             # EarningsRecord, TaxSummary, Projection
|   |   |   |-- service.go
|   |   |   |-- repository.go
|   |   |   |-- tax.go               # Tax engine interface
|   |   |-- auth/
|   |   |   |-- model.go             # User, Session, TokenPair
|   |   |   |-- service.go
|   |   |   |-- repository.go
|   |   |-- tax/
|   |       |-- engine.go            # TaxEngine interface
|   |       |-- portugal.go          # Portuguese tax rules implementation
|   |       |-- brackets.go          # IRS bracket definitions (data-driven, versionable)
|   |       |-- social_security.go   # Seguranca Social calculation
|   |       |-- withholding.go       # Retencao na fonte calculation
|   |-- adapter/
|   |   |-- postgres/     # Repository implementations (uses sqlc-generated code)
|   |   |   |-- workplace_repo.go
|   |   |   |-- schedule_repo.go
|   |   |   |-- finance_repo.go
|   |   |   |-- auth_repo.go
|   |   |   |-- db.go                # Connection pool setup
|   |   |-- gcal/         # Google Calendar sync adapter
|   |   |   |-- client.go            # OAuth2 token management, API client
|   |   |   |-- sync.go              # Two-way sync logic, conflict resolution
|   |   |   |-- webhook.go           # Push notification handler
|   |   |   |-- mapper.go            # Domain <-> Google Event mapping
|   |   |-- http/         # Chi router, handlers, middleware, DTOs
|   |       |-- server.go            # chi router setup, middleware stack
|   |       |-- middleware/
|   |       |   |-- auth.go          # JWT validation middleware
|   |       |   |-- logging.go
|   |       |   |-- recovery.go
|   |       |   |-- cors.go
|   |       |-- handler/
|   |       |   |-- workplace.go
|   |       |   |-- schedule.go
|   |       |   |-- finance.go
|   |       |   |-- auth.go
|   |       |   |-- gcal.go
|   |       |-- dto/                  # Request/Response DTOs (decoupled from domain)
|   |           |-- workplace.go
|   |           |-- schedule.go
|   |           |-- finance.go
|   |           |-- auth.go
|   |-- config/
|       |-- config.go                 # Configuration struct + loading
|-- db/
|   |-- migrations/       # SQL migration files
|   |-- queries/          # sqlc query files
|   |-- sqlc.yaml
|-- pkg/
|   |-- money/            # Decimal money type (integer cents, no floats)
|   |-- clock/            # Time abstraction for testing
|   |-- pagination/       # Cursor/offset pagination helpers
|-- Makefile
|-- Dockerfile
|-- docker-compose.yml
```

**Key principle**: Domain models have zero framework dependencies. Adapters point inward.

---

### Database Schema

#### Extensions & Enums

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "btree_gist";   -- for exclusion constraints on time ranges

CREATE TYPE pay_model AS ENUM ('hourly', 'per_turn', 'monthly');
CREATE TYPE shift_status AS ENUM ('scheduled', 'confirmed', 'completed', 'cancelled');
CREATE TYPE day_of_week AS ENUM ('mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun');
CREATE TYPE earning_status AS ENUM ('projected', 'confirmed', 'paid');
```

#### Core Tables

##### users
```sql
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    full_name       VARCHAR(255) NOT NULL,
    nif             VARCHAR(9),                -- Portuguese tax number
    tax_regime      VARCHAR(50) NOT NULL DEFAULT 'simplified',
    activity_code   VARCHAR(10),               -- CAE/CIRS article 151 code
    irs_category    CHAR(1) NOT NULL DEFAULT 'B',
    gcal_access_token    TEXT,
    gcal_refresh_token   TEXT,
    gcal_token_expiry    TIMESTAMPTZ,
    gcal_calendar_id     VARCHAR(255),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

##### workplaces
```sql
CREATE TABLE workplaces (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name            VARCHAR(255) NOT NULL,
    address         TEXT,
    color           VARCHAR(7),                 -- hex color for calendar (#FF5733)
    pay_model       pay_model NOT NULL,
    base_rate_cents BIGINT NOT NULL,            -- stored in cents to avoid float
    currency        CHAR(3) NOT NULL DEFAULT 'EUR',
    monthly_expected_hours  NUMERIC(5,1),
    contact_name    VARCHAR(255),
    contact_phone   VARCHAR(50),
    contact_email   VARCHAR(255),
    notes           TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

##### pricing_rules (Dynamic Rate Overrides)

Rules are evaluated with priority ordering. The first matching rule wins.

```sql
CREATE TABLE pricing_rules (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workplace_id    UUID NOT NULL REFERENCES workplaces(id) ON DELETE CASCADE,
    name            VARCHAR(255) NOT NULL,       -- "Night Shift Premium"
    priority        INT NOT NULL DEFAULT 0,      -- lower number = higher priority
    time_start      TIME,                        -- e.g., '22:00'
    time_end        TIME,                        -- e.g., '08:00' (crosses midnight handled in code)
    days_of_week    day_of_week[],               -- e.g., '{mon,tue,wed,thu,fri}'
    specific_dates  DATE[],                      -- for holidays
    rate_cents      BIGINT,                      -- absolute rate in cents
    rate_multiplier NUMERIC(4,2),                -- e.g., 1.50 for 150% of base
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_rate_or_multiplier CHECK (
        (rate_cents IS NOT NULL AND rate_multiplier IS NULL) OR
        (rate_cents IS NULL AND rate_multiplier IS NOT NULL)
    ),
    UNIQUE(workplace_id, priority)
);
```

Example configuration for a hospital:

| Priority | Rule Name | Days | Time Window | Rate |
|---|---|---|---|---|
| 1 | Holiday | - | all day | specific_dates=holidays, x2.0 multiplier |
| 2 | Sunday | sun | all day | EUR 40.00/hr |
| 3 | Saturday | sat | all day | EUR 35.00/hr |
| 4 | Night Weekday | mon-fri | 22:00-08:00 | EUR 35.00/hr |
| 5 | (no match = base) | - | - | EUR 25.00/hr (workplace.base_rate_cents) |

##### shifts
```sql
CREATE TABLE shifts (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    workplace_id        UUID NOT NULL REFERENCES workplaces(id) ON DELETE CASCADE,
    start_time          TIMESTAMPTZ NOT NULL,
    end_time            TIMESTAMPTZ NOT NULL,
    timezone            VARCHAR(50) NOT NULL DEFAULT 'Europe/Lisbon',
    status              shift_status NOT NULL DEFAULT 'scheduled',
    recurrence_rule_id  UUID REFERENCES recurrence_rules(id) ON DELETE SET NULL,
    original_start_time TIMESTAMPTZ,
    is_recurrence_exception BOOLEAN NOT NULL DEFAULT false,
    gcal_event_id       VARCHAR(255),
    gcal_etag           VARCHAR(255),
    last_synced_at      TIMESTAMPTZ,
    title               VARCHAR(255),
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_shift_time_range CHECK (end_time > start_time)
);

-- Prevent overlapping shifts for the same user
ALTER TABLE shifts ADD CONSTRAINT no_overlapping_shifts
    EXCLUDE USING gist (
        user_id WITH =,
        tstzrange(start_time, end_time) WITH &&
    ) WHERE (status != 'cancelled');
```

##### recurrence_rules
```sql
CREATE TABLE recurrence_rules (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rrule_string    TEXT NOT NULL,                -- RFC 5545: 'FREQ=WEEKLY;BYDAY=MO,WE,FR;UNTIL=20261231'
    frequency       VARCHAR(10) NOT NULL,
    interval_value  INT NOT NULL DEFAULT 1,
    by_day          day_of_week[],
    by_month_day    INT[],
    dtstart         TIMESTAMPTZ NOT NULL,
    until_date      TIMESTAMPTZ,
    count           INT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

##### shift_earnings

A single shift may span multiple pricing windows (e.g., 20:00-08:00 has normal-rate 20:00-22:00 and night-rate 22:00-08:00).

```sql
CREATE TABLE shift_earnings (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shift_id        UUID NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
    pricing_rule_id UUID REFERENCES pricing_rules(id) ON DELETE SET NULL,
    segment_start   TIMESTAMPTZ NOT NULL,
    segment_end     TIMESTAMPTZ NOT NULL,
    hours           NUMERIC(5,2) NOT NULL,
    rate_cents      BIGINT NOT NULL,
    amount_cents    BIGINT NOT NULL,
    status          earning_status NOT NULL DEFAULT 'projected',
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

##### invoices (Recibos Verdes)
```sql
CREATE TABLE invoices (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    workplace_id        UUID NOT NULL REFERENCES workplaces(id) ON DELETE CASCADE,
    period_start        DATE NOT NULL,
    period_end          DATE NOT NULL,
    gross_amount_cents  BIGINT NOT NULL,
    withholding_rate    NUMERIC(5,4) NOT NULL,   -- 0.2500 for 25%
    withholding_cents   BIGINT NOT NULL,
    iva_rate            NUMERIC(5,4) NOT NULL DEFAULT 0,
    iva_cents           BIGINT NOT NULL DEFAULT 0,
    net_amount_cents    BIGINT NOT NULL,
    invoice_number      VARCHAR(100),
    issued_at           DATE,
    paid_at             DATE,
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

##### tax_year_configs
```sql
CREATE TABLE tax_year_configs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fiscal_year     INT NOT NULL UNIQUE,
    irs_brackets    JSONB NOT NULL,              -- versioned bracket data
    ss_rate                 NUMERIC(5,4) NOT NULL,  -- 0.2140
    ss_income_coefficient   NUMERIC(5,4) NOT NULL,  -- 0.70
    ias_value_cents         BIGINT NOT NULL,
    default_withholding_rate NUMERIC(5,4) NOT NULL,  -- 0.2500
    min_existence_cents     BIGINT NOT NULL,
    standard_iva_rate       NUMERIC(5,4) NOT NULL DEFAULT 0.2300,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

##### gcal_sync_state
```sql
CREATE TABLE gcal_sync_state (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    sync_token      TEXT,
    page_token      TEXT,
    channel_id      VARCHAR(255),
    resource_id     VARCHAR(255),
    channel_expiry  TIMESTAMPTZ,
    last_full_sync  TIMESTAMPTZ,
    last_incremental_sync TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

##### refresh_tokens
```sql
CREATE TABLE refresh_tokens (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash      VARCHAR(255) NOT NULL UNIQUE,
    expires_at      TIMESTAMPTZ NOT NULL,
    revoked_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    user_agent      TEXT,
    ip_address      INET
);
```

---

### Dynamic Pricing Resolution Algorithm

```
FUNCTION resolve_shift_earnings(shift, workplace, pricing_rules) -> []EarningSegment:

    // 1. Collect boundary times from rules + midnight crossings
    // 2. Split shift into contiguous segments at each boundary
    segments = split_shift_into_intervals(shift.start, shift.end, pricing_rules)

    FOR each segment IN segments:
        matching_rule = NULL
        FOR each rule IN pricing_rules ORDER BY priority ASC:
            IF rule matches segment (day_of_week, time range, specific date):
                matching_rule = rule
                BREAK

        IF matching_rule IS NULL:
            rate = workplace.base_rate_cents
        ELSE IF matching_rule.rate_multiplier IS NOT NULL:
            rate = workplace.base_rate_cents * matching_rule.rate_multiplier
        ELSE:
            rate = matching_rule.rate_cents

        SWITCH workplace.pay_model:
            CASE 'hourly':  amount = segment.hours * rate
            CASE 'per_turn': amount = rate (full turn amount)
            CASE 'monthly': amount = rate / monthly_expected_hours * segment.hours

        YIELD EarningSegment{segment_start, segment_end, hours, rate, amount}
```

**Midnight crossing handling**: A shift from Saturday 22:00 to Sunday 06:00 splits at midnight because `day_of_week` changes:
- Segment 1: Saturday 22:00-00:00 -> matches "saturday night" rule
- Segment 2: Sunday 00:00-06:00 -> matches "sunday" rule

**Time window matching** for rules where `time_start > time_end` (e.g., 22:00-08:00):
```go
func ruleMatchesTime(rule PricingRule, t time.Time) bool {
    clock := timeOfDay(t)
    if rule.TimeStart > rule.TimeEnd {
        // Crosses midnight: match if clock >= start OR clock < end
        return clock >= rule.TimeStart || clock < rule.TimeEnd
    }
    return clock >= rule.TimeStart && clock < rule.TimeEnd
}
```

---

### API Endpoints

All routes prefixed with `/api/v1`. JWT auth via `Authorization: Bearer <token>`.

#### Auth
```
POST   /auth/register
POST   /auth/login
POST   /auth/refresh
POST   /auth/logout
GET    /auth/me
```

#### Workplaces
```
GET    /workplaces
POST   /workplaces
GET    /workplaces/{id}
PUT    /workplaces/{id}
DELETE /workplaces/{id}                         # Soft-delete
GET    /workplaces/{id}/pricing-rules
POST   /workplaces/{id}/pricing-rules
PUT    /workplaces/{id}/pricing-rules/{ruleId}
DELETE /workplaces/{id}/pricing-rules/{ruleId}
POST   /workplaces/{id}/pricing-rules/reorder   # Bulk reorder priorities
GET    /workplaces/{id}/earnings-summary
```

#### Shifts (Calendar)
```
GET    /shifts?start=...&end=...&expand_recurrences=true
POST   /shifts
GET    /shifts/{id}
PUT    /shifts/{id}                              # Supports drag-and-drop (only start/end change)
DELETE /shifts/{id}
PATCH  /shifts/{id}/status
POST   /shifts/bulk
GET    /shifts/{id}/earnings
POST   /shifts/{id}/earnings/confirm
```

#### Recurrences
```
POST   /recurrences
PUT    /recurrences/{id}
DELETE /recurrences/{id}
```

#### Finance
```
GET    /finance/summary?month=...&year=...
GET    /finance/summary/monthly/{year}/{month}
GET    /finance/summary/yearly/{year}
GET    /finance/projections
GET    /finance/tax-estimate/{year}
GET    /finance/actual-vs-projected
GET    /finance/social-security
```

#### Invoices
```
GET    /invoices
POST   /invoices
GET    /invoices/{id}
PUT    /invoices/{id}
DELETE /invoices/{id}
```

#### Google Calendar
```
GET    /gcal/auth-url
POST   /gcal/callback
POST   /gcal/sync
GET    /gcal/status
DELETE /gcal/disconnect
POST   /gcal/webhook                             # No auth middleware (Google push)
```

---

### Google Calendar Sync

```
                    +-------------------+
                    | Google Calendar   |
                    +--------+----------+
                             |
              +--------------+--------------+
              |                             |
    Push Notifications              OAuth2 API Calls
    (webhook POST)                  (create/update/delete)
              |                             |
              v                             v
    +-------------------+     +-------------------+
    | Webhook Handler   |---->| Sync Engine       |
    | (debounce 5s)     |     | (incremental sync)|
    +-------------------+     +-------------------+
```

- **OAuth2 Flow**: Frontend gets consent URL -> User authorizes -> Code exchanged for tokens stored server-side
- **Outbound**: Shift CRUD pushes to Google via `extendedProperties.private.doctorTrackerId`
- **Inbound**: Webhook triggers debounced incremental sync using `syncToken`
- **Conflict Resolution**: Last-write-wins with notification (single-user app)
- **Watch Channel Renewal**: Daily cron checks expiry, renews 48h before
- **Polling Fallback**: Every 6h to catch dropped webhook notifications

---

### Portuguese Tax Engine

#### IRS Calculation (Imposto sobre Rendimento)

**Step 1**: Taxable Income (Simplified Regime Category B)
```
taxable_income = gross_income * 0.75  (75% taxable, 25% deemed expenses)
```

**Step 2**: Progressive Brackets (2026)

| Bracket | Taxable Income (EUR) | Rate |
|---|---|---|
| 1 | Up to 7,703 | 12.50% |
| 2 | 7,703 - 11,623 | 16.50% |
| 3 | 11,623 - 16,472 | 22.00% |
| 4 | 16,472 - 21,321 | 25.00% |
| 5 | 21,321 - 27,146 | 28.50% |
| 6 | 27,146 - 39,791 | 35.00% |
| 7 | 39,791 - 51,997 | 37.00% |
| 8 | 51,997 - 81,199 | 43.50% |
| 9 | Above 81,199 | 48.00% |

**Step 3**: Solidarity Surcharge
- 2.5% on income EUR 80k-250k
- 5% on income above EUR 250k

**Step 4**: Minimum Existence (Minimo de Existencia)
- Post-tax income cannot fall below EUR 12,880

#### Social Security (Seguranca Social)

```
relevant_income = quarterly_gross * 0.70
monthly_base = relevant_income / 3
monthly_base = clamp(monthly_base, IAS, 12 * IAS)  // IAS = EUR 537.13
monthly_contribution = monthly_base * 0.214
quarterly_payment = monthly_contribution * 3
```

Declaration schedule: Jan (Oct-Dec), Apr (Jan-Mar), Jul (Apr-Jun), Oct (Jul-Sep)

#### Withholding Tax (Retencao na Fonte)
- Default for medical professionals: **25%** (Article 151 CIRS)
- Exempt if annual income < EUR 15,000
- Per invoice: `withholding = gross * rate`

#### IVA (Value Added Tax)
- Medical services: **exempt** (Article 9 CIVA)
- Non-medical services (consulting, lectures): 23%
- Configurable per workplace

---

## Frontend Architecture

### Tech Stack

| Concern | Web | Mobile |
|---|---|---|
| Framework | React 19 + Vite 6 | Expo SDK 54 |
| Routing | React Router v7 | Expo Router v4 |
| Styling | Tailwind CSS + shadcn/ui | NativeWind v4 + Gluestack UI |
| Calendar | FullCalendar v6 | react-native-calendars + custom time grid |
| Charts | Recharts v2 | Victory Native |
| Forms | React Hook Form + Zod | React Hook Form + Zod |
| State (server) | TanStack Query v5 | TanStack Query v5 |
| State (client) | Zustand | Zustand |
| HTTP | ky | ky |
| Date handling | date-fns v3 | date-fns v3 |
| PDF export | @react-pdf/renderer | expo-print |
| CSV export | papaparse | papaparse |
| i18n | i18next + react-i18next | i18next + react-i18next |
| Recurrence | rrule | rrule |

### Monorepo Structure

```
frontend/
|-- turbo.json
|-- pnpm-workspace.yaml
|-- apps/
|   |-- web/
|   |   |-- vite.config.ts
|   |   |-- tailwind.config.ts
|   |   |-- src/
|   |   |   |-- main.tsx
|   |   |   |-- App.tsx
|   |   |   |-- routes/
|   |   |   |   |-- _layout.tsx          # Sidebar + topbar
|   |   |   |   |-- dashboard.tsx
|   |   |   |   |-- calendar.tsx
|   |   |   |   |-- workplaces/
|   |   |   |   |   |-- index.tsx        # List
|   |   |   |   |   |-- [id].tsx         # Detail/edit
|   |   |   |   |   |-- new.tsx
|   |   |   |   |-- finance/
|   |   |   |   |   |-- index.tsx        # Dashboard
|   |   |   |   |   |-- tax.tsx
|   |   |   |   |   |-- export.tsx
|   |   |   |   |-- settings.tsx
|   |   |   |   |-- login.tsx
|   |   |   |-- components/
|   |   |   |   |-- ui/                  # shadcn/ui components
|   |   |   |   |-- calendar/            # FullCalendar wrappers
|   |   |   |   |-- pricing/             # Pricing matrix components
|   |   |   |   |-- finance/             # Chart components
|   |   |   |   |-- layout/              # Sidebar, Topbar
|   |
|   |-- mobile/
|   |   |-- app.json
|   |   |-- app/
|   |   |   |-- _layout.tsx              # Tab navigator
|   |   |   |-- (tabs)/
|   |   |   |   |-- index.tsx            # Dashboard
|   |   |   |   |-- calendar.tsx
|   |   |   |   |-- workplaces.tsx
|   |   |   |   |-- finance.tsx
|   |   |   |-- workplace/[id].tsx
|   |   |   |-- shift/[id].tsx
|   |   |   |-- (auth)/login.tsx
|   |   |-- components/
|   |       |-- ui/                      # Gluestack components
|   |       |-- calendar/
|   |       |-- pricing/
|   |       |-- finance/
|
|-- packages/
    |-- shared/
    |   |-- src/
    |   |   |-- types/                   # TypeScript interfaces
    |   |   |   |-- workplace.ts
    |   |   |   |-- shift.ts
    |   |   |   |-- finance.ts
    |   |   |   |-- user.ts
    |   |   |   |-- api.ts
    |   |   |-- schemas/                 # Zod validation
    |   |   |   |-- workplace.schema.ts
    |   |   |   |-- shift.schema.ts
    |   |   |   |-- pricing.schema.ts
    |   |   |-- api/                     # API client (platform-agnostic)
    |   |   |   |-- client.ts
    |   |   |   |-- workplaces.ts
    |   |   |   |-- shifts.ts
    |   |   |   |-- finance.ts
    |   |   |   |-- auth.ts
    |   |   |   |-- google-calendar.ts
    |   |   |-- hooks/                   # TanStack Query wrappers
    |   |   |   |-- useWorkplaces.ts
    |   |   |   |-- useShifts.ts
    |   |   |   |-- useEarnings.ts
    |   |   |   |-- useTaxEstimates.ts
    |   |   |   |-- useAuth.ts
    |   |   |-- utils/
    |   |   |   |-- earnings.ts          # Shift earnings calculation
    |   |   |   |-- tax.ts               # Portuguese tax engine
    |   |   |   |-- date.ts
    |   |   |   |-- recurrence.ts
    |   |   |   |-- currency.ts
    |   |   |-- constants/
    |   |       |-- tax-tables.ts
    |   |       |-- pay-models.ts
    |
    |-- tailwind-config/
        |-- src/
            |-- preset.ts                # Colors, spacing, typography
            |-- tokens.ts                # Raw design token values
```

### Code Sharing Strategy

**Share logic, not UI.** Web and mobile have fundamentally different interaction paradigms.

| Shared (`packages/shared`) | Platform-Specific |
|---|---|
| TypeScript types & interfaces | UI components (shadcn vs Gluestack) |
| Zod validation schemas | Navigation/routing |
| API client functions | Calendar rendering |
| TanStack Query hooks | Chart rendering |
| Business logic (tax, earnings) | Token storage |
| Zustand store (filters, prefs) | Gesture handling |
| Design tokens (via Tailwind preset) | |
| Constants (tax tables, etc.) | |

---

### State Management

Three-layer architecture:

```
UI Components
     |
     +-- Server State (TanStack Query v5) -- all backend data
     |
     +-- Client State (Zustand) -- UI preferences, filters, view state
     |
     +-- Form State (React Hook Form) -- local to forms
```

**TanStack Query config**: 5min stale time, 30min garbage collection, refetch on focus/reconnect.

**Zustand store slices**:
- `CalendarSlice`: currentView (day/week/month), currentDate, selectedShiftId, draggedShiftId
- `FilterSlice`: selectedWorkplaceIds, showGoogleCalendarEvents
- `UISlice`: sidebarOpen, modal states

Persisted to localStorage (web) / AsyncStorage (mobile): view preferences, filter selections.

---

### Key Screens

#### 1. Dashboard

```
+-----------------------------------------------+
|  Welcome, Dr. [Name]          [Current Month]  |
+-----------------------------------------------+
|  This Month's       |   Upcoming Shifts         |
|  Earnings           |   (next 7 days list)      |
|  EUR X,XXX          |   Mon 9am - Hospital      |
|  vs projected       |   Tue 8pm - Clinic        |
+---------------------+---------------------------+
|  Earnings by        |   Quick Actions            |
|  Workplace (bar)    |   [+ New Shift]            |
|  |||  ||  |||       |   [+ New Workplace]        |
+---------------------+---------------------------+
```

#### 2. Calendar

```
+-----------------------------------------------+
| [< Prev] [Today] [Next >]   [Day|Week|Month]  |
+----------------+------------------------------+
| Workplace      |  Mon 5  Tue 6  Wed 7  Thu 8  |
| Filters:       |                               |
| [x] Hospital A |  +------+       +------+     |
| [x] Clinic B   |  |Shift |       |Shift |     |
| [x] Private    |  |9-17h |       |20-8h |     |
|                |  |EUR120|       |EUR180|     |
| [x] Show       |  +------+       +------+     |
|   Google Cal   |                               |
|                |         +------+              |
| Mini calendar  |         |Google|              |
|                |         |Event |              |
|                |         |(grey)|              |
+----------------+------------------------------+
```

- Click empty slot -> Create shift modal (pre-filled date/time)
- Click shift -> Edit shift drawer (details + earnings)
- Drag shift -> Reschedule (optimistic update)
- Drag edge -> Resize duration
- Workplace filter checkboxes in sidebar
- Google events as semi-transparent background (read-only)
- Each shift shows: color bar, time, calculated earnings

**Mobile**: Week strip + vertical time grid, tap to create/edit, long-press for quick actions, FAB button for new shift.

#### 3. Workplace Detail + Pricing Matrix

```
+-------------------------------------------------------+
|  Pricing Rules for Hospital Central (Hourly)          |
+-------------------------------------------------------+
|  Visual Matrix Preview (read-only):                   |
|  +-----+-----+-----+-----+-----+-----+-----+-----+  |
|  | Hour | Mon | Tue | Wed | Thu | Fri | Sat | Sun |  |
|  +-----+-----+-----+-----+-----+-----+-----+-----+  |
|  | 0-8  | €15 | €15 | €15 | €15 | €15 | €20 | €25 |  |
|  | 8-20 | €10 | €10 | €10 | €10 | €10 | €20 | €25 |  |
|  | 20-0 | €15 | €15 | €15 | €15 | €15 | €20 | €25 |  |
|  +-----+-----+-----+-----+-----+-----+-----+-----+  |
|                                                       |
|  Rules:                                               |
|  [1] Weekday Day: Mon-Fri 08:00-20:00 EUR 10.00/hr  |
|  [2] Weekday Night: Mon-Fri 20:00-08:00 EUR 15.00/hr|
|  [3] Weekend: Sat all day EUR 20.00/hr               |
|  [4] Sunday/Holiday: Sun all day EUR 25.00/hr        |
|                                                       |
|  [+ Add Rule]                                         |
|  Templates: [Standard Hospital] [Simple] [Custom]     |
|  Coverage: [All hours covered]                        |
+-------------------------------------------------------+
```

**Key UX decisions**:
- Rule-based (2-5 rules), not cell-based (168 cells)
- Visual matrix is read-only preview of how rules map to the week
- Preset templates for common configurations
- Real-time coverage validation (warns about uncovered time slots)
- Hover matrix cell -> highlights corresponding rule card

#### 4. Finance Dashboard

```
+-----------------------------------------------+
|  Finance Overview        [2026 v] [Export]     |
+-----------------------------------------------+
| Total Gross  | Total Net  | IRS Est. | SS Est.|
| EUR 8,450    | EUR 5,890  | EUR 1,860| EUR 700|
| +12% vs prev | +8% vs prev| 28.5%   | 21.4%  |
+-----------------------------------------------+
|  Monthly Earnings Trend (line chart)           |
|  --- Actual  ... Projected                     |
+-----------------------------------------------+
|  Earnings by Workplace (stacked bar chart)     |
|  [Hospital] [Clinic] [Private]                 |
+-----------------------------------------------+
|  Tax Breakdown        | Annual Projection:     |
|  [doughnut chart]     | Gross: EUR 101,400     |
|  Net | IRS | SS       | IRS:   EUR  22,300     |
|                       | SS:    EUR   7,200     |
|                       | Net:   EUR  67,100     |
+-----------------------------------------------+
|  Actual vs Projected (month-by-month table)    |
+-----------------------------------------------+
```

---

### Component Hierarchies

#### Calendar Components (Web)

```
CalendarPage
|-- CalendarToolbar (nav buttons, date display, view switcher)
|-- CalendarSidebar
|   |-- MiniCalendar (month navigator)
|   |-- WorkplaceFilterList
|   |-- GoogleCalendarToggle
|-- CalendarMain (FullCalendar wrapper)
|   |-- ShiftEventContent (custom renderer: color bar, time, earnings, badges)
|   |-- GoogleEventContent (semi-transparent, read-only)
|-- ShiftModal (create/edit dialog)
    |-- ShiftForm
        |-- WorkplaceSelect
        |-- DateTimePicker (start/end)
        |-- EarningsPreview (real-time calculation)
        |-- RecurrenceConfig (frequency, days, end date)
        |-- NotesField
```

#### Pricing Matrix Components (Web)

```
PricingConfiguration
|-- PayModelSelector (radio: hourly/per-turn/monthly)
|-- PricingMatrixPreview (read-only visual grid)
|   |-- MatrixHeader (day columns)
|   |-- MatrixRow (time blocks derived from rules)
|   |-- CoverageIndicator (warns about gaps)
|-- PricingRuleList
|   |-- PricingRuleCard
|       |-- RuleNameInput
|       |-- DaySelector (7 checkboxes + "Weekdays"/"Weekend" presets)
|       |-- TimeRangeSelector (start/end hour pickers)
|       |-- RateInput (EUR with /hour or /turn label)
|       |-- DeleteRuleButton
|-- AddRuleButton
|-- PricingTemplates ("Standard Hospital", "Simple", "Custom")
```

#### Finance Components (Web)

```
FinancePage
|-- FinanceHeader (date range selector, export menu)
|-- StatsGrid (4 KPI cards: gross, net, IRS, SS)
|-- EarningsTrendChart (Recharts: area for projected, line for actual)
|-- WorkplaceEarningsChart (Recharts: stacked bars by workplace)
|-- TaxBreakdownSection
|   |-- TaxDoughnutChart (Recharts: pie with net/IRS/SS segments)
|   |-- TaxDetailTable (annual projection breakdown)
|   |-- TaxBracketVisualizer
|-- ActualVsProjectedTable (month-by-month DataTable)
```

---

### Design Tokens

```typescript
// Workplace palette (color-coding shifts)
workplace: {
  blue: '#3B82F6', green: '#10B981', orange: '#F59E0B',
  purple: '#8B5CF6', rose: '#F43F5E', teal: '#14B8A6',
  sky: '#0EA5E9', amber: '#D97706',
}

// Finance-specific
income:     '#10B981'   // green for earnings
tax:        '#EF4444'   // red for deductions
projection: '#8B5CF6'   // purple for projected values

// Brand: Indigo scale (50-900)
primary: { 500: '#6366F1', 600: '#4F46E5', ... }
```

Dark mode supported via Tailwind `class` strategy on both platforms.

---

### Authentication Flow

```
Login -> POST /auth/login -> { accessToken, refreshToken }
                                    |
                    +---------------+---------------+
                    |                               |
              Web: httpOnly cookie          Mobile: expo-secure-store
              (refresh) + memory (access)   (both tokens)
                    |
              API requests with Bearer token
                    |
              401 -> Auto-refresh -> Retry original request
              Refresh fails -> Redirect to login
```

---

### Portuguese Tax Engine (Frontend)

Shared in `packages/shared/src/utils/tax.ts` for real-time previews:

```typescript
export function calculatePortugueseTax(input: {
  grossAnnualIncome: number;
  isSimplifiedRegime: boolean;
  activityCoefficient: number;  // 0.75 for medical
}): {
  taxableIncome: number;
  irsAmount: number;
  irsEffectiveRate: number;
  socialSecurity: number;
  withholdingTax: number;
  netIncome: number;
  bracketBreakdown: Array<{ bracket: string; taxableInBracket: number; rate: number; tax: number }>;
}
```

Tax tables versioned by year in `packages/shared/src/constants/tax-tables.ts`.

---

## Implementation Phases

### Phase 1: Foundation (Weeks 1-2)
- Go project scaffolding, Docker Compose (PostgreSQL 16), migrations
- JWT auth (register, login, refresh, middleware)
- Frontend monorepo setup (Turborepo + pnpm)
- Shared package: types, schemas, API client
- Web + mobile scaffolds with auth flow
- Design tokens and base component setup

### Phase 2: Workplace Management (Weeks 3-4)
- Workplace CRUD (backend + frontend)
- Pricing rules CRUD with priority ordering
- Pricing matrix UI (rule editor + visual preview + templates)
- Coverage validation

### Phase 3: Calendar & Shifts (Weeks 5-7)
- Shift CRUD with overlap prevention (database constraint)
- FullCalendar integration (web): week/day/month views, drag-and-drop
- Rate resolution engine: split shifts into earning segments
- Recurring shifts (RRULE support)
- Mobile calendar: week view with time grid
- Real-time earnings preview per shift

### Phase 4: Google Calendar Sync (Week 8)
- OAuth2 flow (backend + frontend)
- Outbound sync (shift changes push to Google)
- Inbound sync (webhooks + incremental sync tokens)
- Background event display on calendar

### Phase 5: Finance Dashboard (Weeks 9-11)
- Portuguese tax engine (IRS + SS + withholding) in both Go and TypeScript
- Tax year config seeding (2025 + 2026 brackets)
- KPI cards, trend charts, workplace breakdown
- Tax breakdown visualization
- Actual vs projected comparison
- Invoice/recibo verde tracking
- PDF/CSV export

### Phase 6: Polish (Week 12)
- Responsive design audit
- Error boundaries, loading skeletons
- i18n (Portuguese + English)
- Integration tests (testcontainers-go)
- Dockerfile + production deployment config

---

## Verification Plan

1. **Backend unit tests**: `go test ./...` -- pricing rule resolution with overnight shifts, overlapping shift prevention, tax calculations against known scenarios
2. **Backend integration tests**: testcontainers-go with real PostgreSQL
3. **Frontend tests**: `pnpm test` -- calendar renders shifts, pricing matrix coverage validation, tax calculations match expected values
4. **End-to-end manual test**: Create workplace with pricing rules -> schedule shift -> verify earnings -> check Google Calendar sync -> view finance projections
5. **Tax validation**: Compare IRS calculations against official AT (Autoridade Tributaria) simulator for known income scenarios
6. **Performance**: Lighthouse audit on web, React DevTools profiling, bundle analysis
