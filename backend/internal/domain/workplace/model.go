package workplace

import (
	"time"

	"github.com/google/uuid"
	"github.com/joao-moreira/doctor-tracker/pkg/money"
)

type PayModel string

const (
	PayModelHourly  PayModel = "hourly"
	PayModelPerTurn PayModel = "per_turn"
	PayModelMonthly PayModel = "monthly"
)

type DayOfWeek string

const (
	Monday    DayOfWeek = "mon"
	Tuesday   DayOfWeek = "tue"
	Wednesday DayOfWeek = "wed"
	Thursday  DayOfWeek = "thu"
	Friday    DayOfWeek = "fri"
	Saturday  DayOfWeek = "sat"
	Sunday    DayOfWeek = "sun"
)

var Weekdays = []DayOfWeek{Monday, Tuesday, Wednesday, Thursday, Friday}
var Weekend = []DayOfWeek{Saturday, Sunday}
var AllDays = []DayOfWeek{Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday}

type Workplace struct {
	ID       uuid.UUID `json:"id"`
	UserID   uuid.UUID `json:"user_id"`
	Name     string    `json:"name"`
	Address  *string   `json:"address,omitempty"`
	Color    *string   `json:"color,omitempty"`
	PayModel PayModel  `json:"pay_model"`

	BaseRateCents money.Cents `json:"base_rate_cents"`
	Currency      string      `json:"currency"`

	MonthlyExpectedHours *float64 `json:"monthly_expected_hours,omitempty"`
	HasConsultationPay   bool     `json:"has_consultation_pay"`
	HasOutsideVisitPay   bool     `json:"has_outside_visit_pay"`

	ContactName  *string `json:"contact_name,omitempty"`
	ContactPhone *string `json:"contact_phone,omitempty"`
	ContactEmail *string `json:"contact_email,omitempty"`
	Notes        *string `json:"notes,omitempty"`

	IsActive  bool      `json:"is_active"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type PricingRule struct {
	ID          uuid.UUID `json:"id"`
	WorkplaceID uuid.UUID `json:"workplace_id"`

	Name     string `json:"name"`
	Priority int    `json:"priority"`

	TimeStart *string     `json:"time_start,omitempty"` // HH:MM format
	TimeEnd   *string     `json:"time_end,omitempty"`   // HH:MM format
	DaysOfWeek []DayOfWeek `json:"days_of_week,omitempty"`
	SpecificDates []string `json:"specific_dates,omitempty"` // YYYY-MM-DD format

	RateCents              *money.Cents `json:"rate_cents,omitempty"`
	RateMultiplier         *float64     `json:"rate_multiplier,omitempty"`
	ConsultationRateCents  *money.Cents `json:"consultation_rate_cents,omitempty"`
	OutsideVisitRateCents  *money.Cents `json:"outside_visit_rate_cents,omitempty"`

	IsActive  bool      `json:"is_active"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type CreateWorkplaceInput struct {
	Name                 string   `json:"name" validate:"required"`
	Address              *string  `json:"address"`
	Color                *string  `json:"color"`
	PayModel             PayModel `json:"pay_model" validate:"required,oneof=hourly per_turn monthly"`
	BaseRateCents        int64    `json:"base_rate_cents" validate:"required,min=0"`
	Currency             string   `json:"currency" validate:"required,len=3"`
	MonthlyExpectedHours *float64 `json:"monthly_expected_hours"`
	HasConsultationPay   *bool    `json:"has_consultation_pay"`
	HasOutsideVisitPay   *bool    `json:"has_outside_visit_pay"`
	ContactName          *string  `json:"contact_name"`
	ContactPhone         *string  `json:"contact_phone"`
	ContactEmail         *string  `json:"contact_email"`
	Notes                *string  `json:"notes"`
}

type UpdateWorkplaceInput struct {
	Name                 *string   `json:"name"`
	Address              *string   `json:"address"`
	Color                *string   `json:"color"`
	PayModel             *PayModel `json:"pay_model" validate:"omitempty,oneof=hourly per_turn monthly"`
	BaseRateCents        *int64    `json:"base_rate_cents" validate:"omitempty,min=0"`
	MonthlyExpectedHours *float64  `json:"monthly_expected_hours"`
	HasConsultationPay   *bool     `json:"has_consultation_pay"`
	HasOutsideVisitPay   *bool     `json:"has_outside_visit_pay"`
	ContactName          *string   `json:"contact_name"`
	ContactPhone         *string   `json:"contact_phone"`
	ContactEmail         *string   `json:"contact_email"`
	Notes                *string   `json:"notes"`
}

type CreatePricingRuleInput struct {
	Name                  string      `json:"name" validate:"required"`
	Priority              int         `json:"priority" validate:"min=0"`
	TimeStart             *string     `json:"time_start"`
	TimeEnd               *string     `json:"time_end"`
	DaysOfWeek            []DayOfWeek `json:"days_of_week"`
	SpecificDates         []string    `json:"specific_dates"`
	RateCents             *int64      `json:"rate_cents"`
	RateMultiplier        *float64    `json:"rate_multiplier"`
	ConsultationRateCents *int64      `json:"consultation_rate_cents"`
	OutsideVisitRateCents *int64      `json:"outside_visit_rate_cents"`
}

type UpdatePricingRuleInput struct {
	Name                  *string     `json:"name"`
	Priority              *int        `json:"priority"`
	TimeStart             *string     `json:"time_start"`
	TimeEnd               *string     `json:"time_end"`
	DaysOfWeek            []DayOfWeek `json:"days_of_week"`
	SpecificDates         []string    `json:"specific_dates"`
	RateCents             *int64      `json:"rate_cents"`
	RateMultiplier        *float64    `json:"rate_multiplier"`
	ConsultationRateCents *int64      `json:"consultation_rate_cents"`
	OutsideVisitRateCents *int64      `json:"outside_visit_rate_cents"`
}
