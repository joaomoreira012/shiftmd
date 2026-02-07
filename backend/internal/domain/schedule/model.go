package schedule

import (
	"time"

	"github.com/google/uuid"
	"github.com/joao-moreira/doctor-tracker/internal/domain/workplace"
	"github.com/joao-moreira/doctor-tracker/pkg/money"
)

type ShiftStatus string

const (
	ShiftStatusScheduled ShiftStatus = "scheduled"
	ShiftStatusConfirmed ShiftStatus = "confirmed"
	ShiftStatusCompleted ShiftStatus = "completed"
	ShiftStatusCancelled ShiftStatus = "cancelled"
)

type Shift struct {
	ID          uuid.UUID   `json:"id"`
	UserID      uuid.UUID   `json:"user_id"`
	WorkplaceID uuid.UUID   `json:"workplace_id"`
	StartTime   time.Time   `json:"start_time"`
	EndTime     time.Time   `json:"end_time"`
	Timezone    string      `json:"timezone"`
	Status      ShiftStatus `json:"status"`

	RecurrenceRuleID      *uuid.UUID `json:"recurrence_rule_id,omitempty"`
	OriginalStartTime     *time.Time `json:"original_start_time,omitempty"`
	IsRecurrenceException bool       `json:"is_recurrence_exception"`

	GCalEventID  *string    `json:"gcal_event_id,omitempty"`
	GCalEtag     *string    `json:"gcal_etag,omitempty"`
	LastSyncedAt *time.Time `json:"last_synced_at,omitempty"`

	Title        *string `json:"title,omitempty"`
	Notes        *string `json:"notes,omitempty"`
	PatientsSeen *int    `json:"patients_seen,omitempty"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`

	// Populated by service layer
	Workplace *workplace.Workplace       `json:"workplace,omitempty"`
	Earnings  []workplace.EarningSegment `json:"earnings,omitempty"`
	TotalEarnings money.Cents            `json:"total_earnings,omitempty"`
}

type RecurrenceRule struct {
	ID          uuid.UUID `json:"id"`
	RRuleString string    `json:"rrule_string"`

	Frequency     string                `json:"frequency"`
	IntervalValue int                   `json:"interval_value"`
	ByDay         []workplace.DayOfWeek `json:"by_day,omitempty"`
	ByMonthDay    []int                 `json:"by_month_day,omitempty"`

	DTStart   time.Time  `json:"dtstart"`
	UntilDate *time.Time `json:"until_date,omitempty"`
	Count     *int       `json:"count,omitempty"`

	CreatedAt time.Time `json:"created_at"`
}

type EarningStatus string

const (
	EarningStatusProjected EarningStatus = "projected"
	EarningStatusConfirmed EarningStatus = "confirmed"
	EarningStatusPaid      EarningStatus = "paid"
)

type ShiftEarning struct {
	ID            uuid.UUID     `json:"id"`
	ShiftID       uuid.UUID     `json:"shift_id"`
	PricingRuleID *uuid.UUID    `json:"pricing_rule_id,omitempty"`
	SegmentStart  time.Time     `json:"segment_start"`
	SegmentEnd    time.Time     `json:"segment_end"`
	Hours         float64       `json:"hours"`
	RateCents     money.Cents   `json:"rate_cents"`
	AmountCents   money.Cents   `json:"amount_cents"`
	Status        EarningStatus `json:"status"`
	Notes         *string       `json:"notes,omitempty"`
	CreatedAt     time.Time     `json:"created_at"`
	UpdatedAt     time.Time     `json:"updated_at"`
}

type CreateShiftInput struct {
	WorkplaceID  uuid.UUID `json:"workplace_id" validate:"required"`
	StartTime    time.Time `json:"start_time" validate:"required"`
	EndTime      time.Time `json:"end_time" validate:"required,gtfield=StartTime"`
	Timezone     string    `json:"timezone"`
	Title        *string   `json:"title"`
	Notes        *string   `json:"notes"`
	PatientsSeen *int      `json:"patients_seen"`

	// Recurrence (optional)
	Recurrence *CreateRecurrenceInput `json:"recurrence,omitempty"`
}

type UpdateShiftInput struct {
	StartTime    *time.Time   `json:"start_time"`
	EndTime      *time.Time   `json:"end_time"`
	Status       *ShiftStatus `json:"status"`
	Title        *string      `json:"title"`
	Notes        *string      `json:"notes"`
	PatientsSeen *int         `json:"patients_seen"`
}

type CreateRecurrenceInput struct {
	RRuleString string `json:"rrule_string" validate:"required"`
	UntilDate   *time.Time `json:"until_date,omitempty"`
	Count       *int       `json:"count,omitempty"`
}

type ShiftFilter struct {
	UserID       uuid.UUID
	WorkplaceID  *uuid.UUID
	Start        time.Time
	End          time.Time
	Status       *ShiftStatus
	ExpandRecurrences bool
}
