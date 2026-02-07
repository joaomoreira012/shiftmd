ALTER TABLE workplaces ADD COLUMN has_outside_visit_pay BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE pricing_rules ADD COLUMN outside_visit_rate_cents BIGINT;
ALTER TABLE shifts ADD COLUMN outside_visits INT;
