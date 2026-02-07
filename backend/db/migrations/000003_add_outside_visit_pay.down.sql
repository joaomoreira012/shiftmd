ALTER TABLE shifts DROP COLUMN IF EXISTS outside_visits;
ALTER TABLE pricing_rules DROP COLUMN IF EXISTS outside_visit_rate_cents;
ALTER TABLE workplaces DROP COLUMN IF EXISTS has_outside_visit_pay;
