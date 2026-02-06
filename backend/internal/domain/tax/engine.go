package tax

import "github.com/joao-moreira/doctor-tracker/pkg/money"

// Engine calculates Portuguese taxes for independent workers.
type Engine interface {
	CalculateIRS(config YearConfig, annualGrossIncome money.Cents) IRSResult
	CalculateSocialSecurity(config YearConfig, quarterlyGrossIncome money.Cents) SSResult
	CalculateWithholding(grossAmount money.Cents, rate float64) money.Cents
	CalculateAnnualSummary(config YearConfig, annualGrossIncome money.Cents) AnnualSummary
}

type YearConfig struct {
	FiscalYear             int         `json:"fiscal_year"`
	Brackets               []IRSBracket `json:"brackets"`
	SSRate                 float64     `json:"ss_rate"`                  // 0.214
	SSIncomeCoefficient    float64     `json:"ss_income_coefficient"`    // 0.70
	IASValueCents          money.Cents `json:"ias_value_cents"`          // IAS in cents
	DefaultWithholdingRate float64     `json:"default_withholding_rate"` // 0.25
	MinExistenceCents      money.Cents `json:"min_existence_cents"`
	SimplifiedCoefficient  float64     `json:"simplified_coefficient"`   // 0.75 for Cat B services
}

type IRSBracket struct {
	LowerLimit money.Cents `json:"lower_limit"`
	UpperLimit money.Cents `json:"upper_limit"`
	Rate       float64     `json:"rate"`
	Deduction  money.Cents `json:"deduction"`
}

type IRSResult struct {
	TaxableIncome    money.Cents      `json:"taxable_income"`
	TotalTax         money.Cents      `json:"total_tax"`
	EffectiveRate    float64          `json:"effective_rate"`
	BracketBreakdown []BracketResult  `json:"bracket_breakdown"`
}

type BracketResult struct {
	BracketLabel    string      `json:"bracket_label"`
	TaxableInBracket money.Cents `json:"taxable_in_bracket"`
	Rate            float64     `json:"rate"`
	TaxAmount       money.Cents `json:"tax_amount"`
}

type SSResult struct {
	RelevantIncome      money.Cents `json:"relevant_income"`
	MonthlyBase         money.Cents `json:"monthly_base"`
	MonthlyContribution money.Cents `json:"monthly_contribution"`
	QuarterlyPayment    money.Cents `json:"quarterly_payment"`
	AnnualEstimate      money.Cents `json:"annual_estimate"`
}

type AnnualSummary struct {
	GrossIncome      money.Cents `json:"gross_income"`
	TaxableIncome    money.Cents `json:"taxable_income"`
	IRSAmount        money.Cents `json:"irs_amount"`
	IRSEffectiveRate float64     `json:"irs_effective_rate"`
	SSAnnual         money.Cents `json:"ss_annual"`
	WithholdingTotal money.Cents `json:"withholding_total"`
	NetIncome        money.Cents `json:"net_income"`
	MonthlyNet       money.Cents `json:"monthly_net"`
}
