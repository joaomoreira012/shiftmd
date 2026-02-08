package finance

import (
	"time"

	"github.com/google/uuid"
	"github.com/joao-moreira/doctor-tracker/pkg/money"
)

type Invoice struct {
	ID          uuid.UUID `json:"id"`
	UserID      uuid.UUID `json:"user_id"`
	WorkplaceID uuid.UUID `json:"workplace_id"`

	PeriodStart time.Time `json:"period_start"`
	PeriodEnd   time.Time `json:"period_end"`

	GrossAmountCents money.Cents `json:"gross_amount_cents"`
	WithholdingRate  float64     `json:"withholding_rate"`
	WithholdingCents money.Cents `json:"withholding_cents"`
	IVARate          float64     `json:"iva_rate"`
	IVACents         money.Cents `json:"iva_cents"`
	NetAmountCents   money.Cents `json:"net_amount_cents"`

	InvoiceNumber *string    `json:"invoice_number,omitempty"`
	IssuedAt      *time.Time `json:"issued_at,omitempty"`
	PaidAt        *time.Time `json:"paid_at,omitempty"`
	Notes         *string    `json:"notes,omitempty"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type EarningsSummary struct {
	Period            string      `json:"period"`
	GrossEarnings     money.Cents `json:"gross_earnings"`
	ProjectedEarnings money.Cents `json:"projected_earnings"`
	ActualEarnings    money.Cents `json:"actual_earnings"`
	ShiftCount        int         `json:"shift_count"`

	// Per-workplace breakdown
	ByWorkplace []WorkplaceEarnings `json:"by_workplace"`
}

type WorkplaceEarnings struct {
	WorkplaceID   uuid.UUID   `json:"workplace_id"`
	WorkplaceName string      `json:"workplace_name"`
	Color         string      `json:"color"`
	Gross         money.Cents `json:"gross"`
	ShiftCount    int         `json:"shift_count"`
	Hours         float64     `json:"hours"`
	PatientsSeen  int         `json:"patients_seen"`
	OutsideVisits int         `json:"outside_visits"`
}

type TaxEstimate struct {
	FiscalYear int `json:"fiscal_year"`

	GrossAnnualIncome money.Cents `json:"gross_annual_income"`
	TaxableIncome     money.Cents `json:"taxable_income"`

	IRSAmount        money.Cents `json:"irs_amount"`
	IRSEffectiveRate float64     `json:"irs_effective_rate"`

	SocialSecurity     money.Cents `json:"social_security"`
	SSMonthlyBase      money.Cents `json:"ss_monthly_base"`
	SSQuarterlyPayment money.Cents `json:"ss_quarterly_payment"`

	WithholdingTotal money.Cents `json:"withholding_total"`

	NetAnnualIncome money.Cents `json:"net_annual_income"`
	MonthlyNet      money.Cents `json:"monthly_net"`

	BracketBreakdown []BracketDetail `json:"bracket_breakdown"`
}

type BracketDetail struct {
	BracketLabel   string      `json:"bracket_label"`
	TaxableInBrack money.Cents `json:"taxable_in_bracket"`
	Rate           float64     `json:"rate"`
	TaxAmount      money.Cents `json:"tax_amount"`
}

type Projection struct {
	Month          string      `json:"month"` // YYYY-MM
	ProjectedGross money.Cents `json:"projected_gross"`
	ActualGross    money.Cents `json:"actual_gross"`
	Difference     money.Cents `json:"difference"`
	IsActual       bool        `json:"is_actual"` // true if month has passed
}

type CreateInvoiceInput struct {
	WorkplaceID      uuid.UUID  `json:"workplace_id" validate:"required"`
	PeriodStart      time.Time  `json:"period_start" validate:"required"`
	PeriodEnd        time.Time  `json:"period_end" validate:"required"`
	GrossAmountCents int64      `json:"gross_amount_cents" validate:"required,min=0"`
	WithholdingRate  float64    `json:"withholding_rate" validate:"min=0,max=1"`
	IVARate          float64    `json:"iva_rate" validate:"min=0,max=1"`
	InvoiceNumber    *string    `json:"invoice_number"`
	IssuedAt         *time.Time `json:"issued_at"`
	Notes            *string    `json:"notes"`
}
