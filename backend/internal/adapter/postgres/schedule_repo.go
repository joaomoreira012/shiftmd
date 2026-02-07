package postgres

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/joao-moreira/doctor-tracker/internal/domain/schedule"
	"github.com/joao-moreira/doctor-tracker/pkg/money"
)

type ScheduleRepository struct {
	db *DB
}

func NewScheduleRepository(db *DB) *ScheduleRepository {
	return &ScheduleRepository{db: db}
}

func (r *ScheduleRepository) CreateShift(ctx context.Context, shift *schedule.Shift) error {
	_, err := r.db.Pool.Exec(ctx, `
		INSERT INTO shifts (id, user_id, workplace_id, start_time, end_time, timezone, status,
			recurrence_rule_id, original_start_time, is_recurrence_exception,
			gcal_event_id, gcal_etag, title, notes, patients_seen, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
	`, shift.ID, shift.UserID, shift.WorkplaceID, shift.StartTime, shift.EndTime, shift.Timezone,
		shift.Status, shift.RecurrenceRuleID, shift.OriginalStartTime, shift.IsRecurrenceException,
		shift.GCalEventID, shift.GCalEtag, shift.Title, shift.Notes, shift.PatientsSeen, shift.CreatedAt, shift.UpdatedAt)
	return err
}

func (r *ScheduleRepository) GetShiftByID(ctx context.Context, id uuid.UUID) (*schedule.Shift, error) {
	shift := &schedule.Shift{}
	err := r.db.Pool.QueryRow(ctx, `
		SELECT id, user_id, workplace_id, start_time, end_time, timezone, status,
			recurrence_rule_id, original_start_time, is_recurrence_exception,
			gcal_event_id, gcal_etag, last_synced_at, title, notes, patients_seen, created_at, updated_at
		FROM shifts WHERE id = $1
	`, id).Scan(
		&shift.ID, &shift.UserID, &shift.WorkplaceID, &shift.StartTime, &shift.EndTime,
		&shift.Timezone, &shift.Status, &shift.RecurrenceRuleID, &shift.OriginalStartTime,
		&shift.IsRecurrenceException, &shift.GCalEventID, &shift.GCalEtag, &shift.LastSyncedAt,
		&shift.Title, &shift.Notes, &shift.PatientsSeen, &shift.CreatedAt, &shift.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, schedule.ErrShiftNotFound
	}
	return shift, err
}

func (r *ScheduleRepository) ListShifts(ctx context.Context, filter schedule.ShiftFilter) ([]*schedule.Shift, error) {
	query := `
		SELECT id, user_id, workplace_id, start_time, end_time, timezone, status,
			recurrence_rule_id, original_start_time, is_recurrence_exception,
			gcal_event_id, gcal_etag, last_synced_at, title, notes, patients_seen, created_at, updated_at
		FROM shifts WHERE user_id = $1 AND start_time >= $2 AND end_time <= $3 AND status != 'cancelled'`

	args := []interface{}{filter.UserID, filter.Start, filter.End}
	argIdx := 4

	if filter.WorkplaceID != nil {
		query += ` AND workplace_id = $` + string(rune('0'+argIdx))
		args = append(args, *filter.WorkplaceID)
		argIdx++
	}

	query += ` ORDER BY start_time`

	rows, err := r.db.Pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var shifts []*schedule.Shift
	for rows.Next() {
		shift := &schedule.Shift{}
		if err := rows.Scan(
			&shift.ID, &shift.UserID, &shift.WorkplaceID, &shift.StartTime, &shift.EndTime,
			&shift.Timezone, &shift.Status, &shift.RecurrenceRuleID, &shift.OriginalStartTime,
			&shift.IsRecurrenceException, &shift.GCalEventID, &shift.GCalEtag, &shift.LastSyncedAt,
			&shift.Title, &shift.Notes, &shift.PatientsSeen, &shift.CreatedAt, &shift.UpdatedAt,
		); err != nil {
			return nil, err
		}
		shifts = append(shifts, shift)
	}
	return shifts, nil
}

func (r *ScheduleRepository) UpdateShift(ctx context.Context, shift *schedule.Shift) error {
	_, err := r.db.Pool.Exec(ctx, `
		UPDATE shifts SET
			start_time = $2, end_time = $3, status = $4, title = $5, notes = $6,
			patients_seen = $7, is_recurrence_exception = $8, gcal_event_id = $9, gcal_etag = $10,
			last_synced_at = $11, updated_at = $12
		WHERE id = $1
	`, shift.ID, shift.StartTime, shift.EndTime, shift.Status, shift.Title, shift.Notes,
		shift.PatientsSeen, shift.IsRecurrenceException, shift.GCalEventID, shift.GCalEtag,
		shift.LastSyncedAt, shift.UpdatedAt)
	return err
}

func (r *ScheduleRepository) DeleteShift(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.Pool.Exec(ctx, `DELETE FROM shifts WHERE id = $1`, id)
	return err
}

func (r *ScheduleRepository) BulkCreateShifts(ctx context.Context, shifts []*schedule.Shift) error {
	tx, err := r.db.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	for _, shift := range shifts {
		_, err := tx.Exec(ctx, `
			INSERT INTO shifts (id, user_id, workplace_id, start_time, end_time, timezone, status,
				recurrence_rule_id, original_start_time, is_recurrence_exception,
				title, notes, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
		`, shift.ID, shift.UserID, shift.WorkplaceID, shift.StartTime, shift.EndTime, shift.Timezone,
			shift.Status, shift.RecurrenceRuleID, shift.OriginalStartTime, shift.IsRecurrenceException,
			shift.Title, shift.Notes, shift.CreatedAt, shift.UpdatedAt)
		if err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
}

// Recurrence Rules

func (r *ScheduleRepository) CreateRecurrenceRule(ctx context.Context, rule *schedule.RecurrenceRule) error {
	_, err := r.db.Pool.Exec(ctx, `
		INSERT INTO recurrence_rules (id, rrule_string, frequency, interval_value,
			by_day, by_month_day, dtstart, until_date, count, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
	`, rule.ID, rule.RRuleString, rule.Frequency, rule.IntervalValue,
		rule.ByDay, rule.ByMonthDay, rule.DTStart, rule.UntilDate, rule.Count, rule.CreatedAt)
	return err
}

func (r *ScheduleRepository) GetRecurrenceRuleByID(ctx context.Context, id uuid.UUID) (*schedule.RecurrenceRule, error) {
	rule := &schedule.RecurrenceRule{}
	err := r.db.Pool.QueryRow(ctx, `
		SELECT id, rrule_string, frequency, interval_value, by_day, by_month_day,
			dtstart, until_date, count, created_at
		FROM recurrence_rules WHERE id = $1
	`, id).Scan(
		&rule.ID, &rule.RRuleString, &rule.Frequency, &rule.IntervalValue,
		&rule.ByDay, &rule.ByMonthDay, &rule.DTStart, &rule.UntilDate, &rule.Count, &rule.CreatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, err
	}
	return rule, err
}

func (r *ScheduleRepository) UpdateRecurrenceRule(ctx context.Context, rule *schedule.RecurrenceRule) error {
	_, err := r.db.Pool.Exec(ctx, `
		UPDATE recurrence_rules SET
			rrule_string = $2, frequency = $3, interval_value = $4,
			by_day = $5, by_month_day = $6, until_date = $7, count = $8
		WHERE id = $1
	`, rule.ID, rule.RRuleString, rule.Frequency, rule.IntervalValue,
		rule.ByDay, rule.ByMonthDay, rule.UntilDate, rule.Count)
	return err
}

func (r *ScheduleRepository) DeleteRecurrenceRule(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.Pool.Exec(ctx, `DELETE FROM recurrence_rules WHERE id = $1`, id)
	return err
}

// Shift Earnings

func (r *ScheduleRepository) CreateShiftEarnings(ctx context.Context, earnings []*schedule.ShiftEarning) error {
	tx, err := r.db.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	for _, e := range earnings {
		_, err := tx.Exec(ctx, `
			INSERT INTO shift_earnings (id, shift_id, pricing_rule_id, segment_start, segment_end,
				hours, rate_cents, amount_cents, status, notes, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
		`, e.ID, e.ShiftID, e.PricingRuleID, e.SegmentStart, e.SegmentEnd,
			e.Hours, int64(e.RateCents), int64(e.AmountCents), e.Status, e.Notes,
			e.CreatedAt, e.UpdatedAt)
		if err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
}

func (r *ScheduleRepository) GetShiftEarnings(ctx context.Context, shiftID uuid.UUID) ([]*schedule.ShiftEarning, error) {
	rows, err := r.db.Pool.Query(ctx, `
		SELECT id, shift_id, pricing_rule_id, segment_start, segment_end,
			hours, rate_cents, amount_cents, status, notes, created_at, updated_at
		FROM shift_earnings WHERE shift_id = $1 ORDER BY segment_start
	`, shiftID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var earnings []*schedule.ShiftEarning
	for rows.Next() {
		e := &schedule.ShiftEarning{}
		var rateCents, amountCents int64
		if err := rows.Scan(
			&e.ID, &e.ShiftID, &e.PricingRuleID, &e.SegmentStart, &e.SegmentEnd,
			&e.Hours, &rateCents, &amountCents, &e.Status, &e.Notes,
			&e.CreatedAt, &e.UpdatedAt,
		); err != nil {
			return nil, err
		}
		e.RateCents = money.Cents(rateCents)
		e.AmountCents = money.Cents(amountCents)
		earnings = append(earnings, e)
	}
	return earnings, nil
}

func (r *ScheduleRepository) DeleteShiftEarnings(ctx context.Context, shiftID uuid.UUID) error {
	_, err := r.db.Pool.Exec(ctx, `DELETE FROM shift_earnings WHERE shift_id = $1`, shiftID)
	return err
}

func (r *ScheduleRepository) UpdateEarningStatus(ctx context.Context, shiftID uuid.UUID, status schedule.EarningStatus) error {
	_, err := r.db.Pool.Exec(ctx, `
		UPDATE shift_earnings SET status = $2, updated_at = NOW() WHERE shift_id = $1
	`, shiftID, status)
	return err
}
