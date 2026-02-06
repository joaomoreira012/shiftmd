export type PayModel = 'hourly' | 'per_turn' | 'monthly';

export type DayOfWeek = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export interface Workplace {
  id: string;
  user_id: string;
  name: string;
  address?: string;
  color?: string;
  pay_model: PayModel;
  base_rate_cents: number;
  currency: string;
  monthly_expected_hours?: number;
  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;
  notes?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PricingRule {
  id: string;
  workplace_id: string;
  name: string;
  priority: number;
  time_start?: string;
  time_end?: string;
  days_of_week?: DayOfWeek[];
  specific_dates?: string[];
  rate_cents?: number;
  rate_multiplier?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateWorkplaceInput {
  name: string;
  address?: string;
  color?: string;
  pay_model: PayModel;
  base_rate_cents: number;
  currency: string;
  monthly_expected_hours?: number;
  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;
  notes?: string;
}

export interface UpdateWorkplaceInput {
  name?: string;
  address?: string;
  color?: string;
  pay_model?: PayModel;
  base_rate_cents?: number;
  monthly_expected_hours?: number;
  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;
  notes?: string;
}

export interface CreatePricingRuleInput {
  name: string;
  priority: number;
  time_start?: string;
  time_end?: string;
  days_of_week?: DayOfWeek[];
  specific_dates?: string[];
  rate_cents?: number;
  rate_multiplier?: number;
}
