ALTER TABLE workplaces ADD COLUMN has_consultation_pay BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE pricing_rules ADD COLUMN consultation_rate_cents BIGINT;
ALTER TABLE shifts ADD COLUMN patients_seen INT;
