ALTER TABLE shifts DROP COLUMN IF EXISTS patients_seen;
ALTER TABLE pricing_rules DROP COLUMN IF EXISTS consultation_rate_cents;
ALTER TABLE workplaces DROP COLUMN IF EXISTS has_consultation_pay;
