package schedule

import (
	"context"

	"github.com/google/uuid"
)

type Repository interface {
	// Shifts
	CreateShift(ctx context.Context, shift *Shift) error
	GetShiftByID(ctx context.Context, id uuid.UUID) (*Shift, error)
	ListShifts(ctx context.Context, filter ShiftFilter) ([]*Shift, error)
	UpdateShift(ctx context.Context, shift *Shift) error
	DeleteShift(ctx context.Context, id uuid.UUID) error
	BulkCreateShifts(ctx context.Context, shifts []*Shift) error

	// Recurrence Rules
	CreateRecurrenceRule(ctx context.Context, rule *RecurrenceRule) error
	GetRecurrenceRuleByID(ctx context.Context, id uuid.UUID) (*RecurrenceRule, error)
	UpdateRecurrenceRule(ctx context.Context, rule *RecurrenceRule) error
	DeleteRecurrenceRule(ctx context.Context, id uuid.UUID) error

	// Shift Earnings
	CreateShiftEarnings(ctx context.Context, earnings []*ShiftEarning) error
	GetShiftEarnings(ctx context.Context, shiftID uuid.UUID) ([]*ShiftEarning, error)
	DeleteShiftEarnings(ctx context.Context, shiftID uuid.UUID) error
	UpdateEarningStatus(ctx context.Context, shiftID uuid.UUID, status EarningStatus) error
}
