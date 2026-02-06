export interface EarningsSummary {
  period: string;
  gross_earnings: number;
  projected_earnings: number;
  actual_earnings: number;
  shift_count: number;
  by_workplace: WorkplaceEarnings[];
}

export interface WorkplaceEarnings {
  workplace_id: string;
  workplace_name: string;
  color: string;
  gross: number;
  shift_count: number;
  hours: number;
}

export interface TaxEstimate {
  gross_income: number;
  taxable_income: number;
  irs_amount: number;
  irs_effective_rate: number;
  ss_annual: number;
  withholding_total: number;
  net_income: number;
  monthly_net: number;
}

export interface BracketDetail {
  bracket_label: string;
  taxable_in_bracket: number;
  rate: number;
  tax_amount: number;
}

export interface Projection {
  month: string;
  projected_gross: number;
  actual_gross: number;
  difference: number;
  is_actual: boolean;
}

export interface Invoice {
  id: string;
  user_id: string;
  workplace_id: string;
  period_start: string;
  period_end: string;
  gross_amount_cents: number;
  withholding_rate: number;
  withholding_cents: number;
  iva_rate: number;
  iva_cents: number;
  net_amount_cents: number;
  invoice_number?: string;
  issued_at?: string;
  paid_at?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateInvoiceInput {
  workplace_id: string;
  period_start: string;
  period_end: string;
  gross_amount_cents: number;
  withholding_rate: number;
  iva_rate: number;
  invoice_number?: string;
  issued_at?: string;
  notes?: string;
}
