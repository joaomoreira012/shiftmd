-- ============================================================
-- EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- ============================================================
-- ENUM TYPES
-- ============================================================
CREATE TYPE pay_model AS ENUM ('hourly', 'per_turn', 'monthly');
CREATE TYPE shift_status AS ENUM ('scheduled', 'confirmed', 'completed', 'cancelled');
CREATE TYPE day_of_week AS ENUM ('mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun');
CREATE TYPE earning_status AS ENUM ('projected', 'confirmed', 'paid');

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    full_name       VARCHAR(255) NOT NULL,
    nif             VARCHAR(9),

    tax_regime      VARCHAR(50) NOT NULL DEFAULT 'simplified',
    activity_code   VARCHAR(10),
    irs_category    CHAR(1) NOT NULL DEFAULT 'B',

    gcal_access_token    TEXT,
    gcal_refresh_token   TEXT,
    gcal_token_expiry    TIMESTAMPTZ,
    gcal_calendar_id     VARCHAR(255),

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- WORKPLACES
-- ============================================================
CREATE TABLE workplaces (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name            VARCHAR(255) NOT NULL,
    address         TEXT,
    color           VARCHAR(7),
    pay_model       pay_model NOT NULL,

    base_rate_cents BIGINT NOT NULL,
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

CREATE INDEX idx_workplaces_user ON workplaces(user_id) WHERE is_active = true;

-- ============================================================
-- PRICING RULES
-- ============================================================
CREATE TABLE pricing_rules (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workplace_id    UUID NOT NULL REFERENCES workplaces(id) ON DELETE CASCADE,

    name            VARCHAR(255) NOT NULL,
    priority        INT NOT NULL DEFAULT 0,

    time_start      TIME,
    time_end        TIME,

    days_of_week    day_of_week[],
    specific_dates  DATE[],

    rate_cents      BIGINT,
    rate_multiplier NUMERIC(4,2),

    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_rate_or_multiplier CHECK (
        (rate_cents IS NOT NULL AND rate_multiplier IS NULL) OR
        (rate_cents IS NULL AND rate_multiplier IS NOT NULL)
    ),
    UNIQUE(workplace_id, priority)
);

CREATE INDEX idx_pricing_rules_workplace ON pricing_rules(workplace_id) WHERE is_active = true;

-- ============================================================
-- RECURRENCE RULES
-- ============================================================
CREATE TABLE recurrence_rules (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    rrule_string    TEXT NOT NULL,

    frequency       VARCHAR(10) NOT NULL,
    interval_value  INT NOT NULL DEFAULT 1,
    by_day          day_of_week[],
    by_month_day    INT[],

    dtstart         TIMESTAMPTZ NOT NULL,
    until_date      TIMESTAMPTZ,
    count           INT,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- SHIFTS
-- ============================================================
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

CREATE INDEX idx_shifts_user_time ON shifts(user_id, start_time, end_time);
CREATE INDEX idx_shifts_workplace ON shifts(workplace_id);
CREATE INDEX idx_shifts_gcal ON shifts(gcal_event_id) WHERE gcal_event_id IS NOT NULL;
CREATE INDEX idx_shifts_status ON shifts(user_id, status) WHERE status != 'cancelled';

-- ============================================================
-- SHIFT EARNINGS
-- ============================================================
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

CREATE INDEX idx_shift_earnings_shift ON shift_earnings(shift_id);
CREATE INDEX idx_shift_earnings_status ON shift_earnings(status);

-- ============================================================
-- INVOICES (Recibos Verdes)
-- ============================================================
CREATE TABLE invoices (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    workplace_id        UUID NOT NULL REFERENCES workplaces(id) ON DELETE CASCADE,

    period_start        DATE NOT NULL,
    period_end          DATE NOT NULL,

    gross_amount_cents  BIGINT NOT NULL,

    withholding_rate    NUMERIC(5,4) NOT NULL,
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

CREATE INDEX idx_invoices_user_period ON invoices(user_id, period_start, period_end);
CREATE INDEX idx_invoices_workplace ON invoices(workplace_id);

-- ============================================================
-- TAX YEAR CONFIGS
-- ============================================================
CREATE TABLE tax_year_configs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fiscal_year     INT NOT NULL UNIQUE,

    irs_brackets    JSONB NOT NULL,

    ss_rate                 NUMERIC(5,4) NOT NULL,
    ss_income_coefficient   NUMERIC(5,4) NOT NULL,
    ias_value_cents         BIGINT NOT NULL,

    default_withholding_rate NUMERIC(5,4) NOT NULL,

    min_existence_cents     BIGINT NOT NULL,

    standard_iva_rate       NUMERIC(5,4) NOT NULL DEFAULT 0.2300,

    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- GOOGLE CALENDAR SYNC STATE
-- ============================================================
CREATE TABLE gcal_sync_state (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    sync_token      TEXT,
    page_token      TEXT,

    channel_id      VARCHAR(255),
    resource_id     VARCHAR(255),
    channel_expiry  TIMESTAMPTZ,

    last_full_sync  TIMESTAMPTZ,
    last_incremental_sync TIMESTAMPTZ,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(user_id)
);

-- ============================================================
-- REFRESH TOKENS
-- ============================================================
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

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id) WHERE revoked_at IS NULL;

-- ============================================================
-- SEED: Tax Year Configs
-- ============================================================
INSERT INTO tax_year_configs (id, fiscal_year, irs_brackets, ss_rate, ss_income_coefficient, ias_value_cents, default_withholding_rate, min_existence_cents, standard_iva_rate, notes)
VALUES (
    uuid_generate_v4(),
    2026,
    '[
        {"lower_limit": 0, "upper_limit": 770300, "rate": 0.125, "deduction": 0},
        {"lower_limit": 770300, "upper_limit": 1162300, "rate": 0.165, "deduction": 30812},
        {"lower_limit": 1162300, "upper_limit": 1647200, "rate": 0.220, "deduction": 94754},
        {"lower_limit": 1647200, "upper_limit": 2132100, "rate": 0.250, "deduction": 144170},
        {"lower_limit": 2132100, "upper_limit": 2714600, "rate": 0.285, "deduction": 218792},
        {"lower_limit": 2714600, "upper_limit": 3979100, "rate": 0.350, "deduction": 395142},
        {"lower_limit": 3979100, "upper_limit": 5199700, "rate": 0.370, "deduction": 474724},
        {"lower_limit": 5199700, "upper_limit": 8119900, "rate": 0.435, "deduction": 812940},
        {"lower_limit": 8119900, "upper_limit": 99999999999, "rate": 0.480, "deduction": 1178235}
    ]'::jsonb,
    0.2140,
    0.7000,
    53713,
    0.2500,
    1288000,
    0.2300,
    'Portuguese IRS brackets for 2026'
),
(
    uuid_generate_v4(),
    2025,
    '[
        {"lower_limit": 0, "upper_limit": 747900, "rate": 0.130, "deduction": 0},
        {"lower_limit": 747900, "upper_limit": 1128400, "rate": 0.165, "deduction": 26177},
        {"lower_limit": 1128400, "upper_limit": 1599200, "rate": 0.220, "deduction": 88240},
        {"lower_limit": 1599200, "upper_limit": 2070000, "rate": 0.250, "deduction": 136218},
        {"lower_limit": 2070000, "upper_limit": 2635500, "rate": 0.285, "deduction": 208668},
        {"lower_limit": 2635500, "upper_limit": 3863200, "rate": 0.350, "deduction": 379973},
        {"lower_limit": 3863200, "upper_limit": 5048300, "rate": 0.370, "deduction": 457237},
        {"lower_limit": 5048300, "upper_limit": 7883400, "rate": 0.435, "deduction": 785377},
        {"lower_limit": 7883400, "upper_limit": 99999999999, "rate": 0.480, "deduction": 1140130}
    ]'::jsonb,
    0.2140,
    0.7000,
    52250,
    0.2500,
    1218000,
    0.2300,
    'Portuguese IRS brackets for 2025'
);
