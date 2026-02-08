package postgres

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/joao-moreira/doctor-tracker/internal/domain/workplace"
	"github.com/joao-moreira/doctor-tracker/pkg/money"
)

type WorkplaceRepository struct {
	db *DB
}

func NewWorkplaceRepository(db *DB) *WorkplaceRepository {
	return &WorkplaceRepository{db: db}
}

func (r *WorkplaceRepository) CreateWorkplace(ctx context.Context, w *workplace.Workplace) error {
	_, err := r.db.Pool.Exec(ctx, `
		INSERT INTO workplaces (id, user_id, name, address, color, pay_model, base_rate_cents, currency,
			monthly_expected_hours, has_consultation_pay, has_outside_visit_pay, withholding_rate,
			contact_name, contact_phone, contact_email, notes, is_active, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
	`, w.ID, w.UserID, w.Name, w.Address, w.Color, w.PayModel, int64(w.BaseRateCents), w.Currency,
		w.MonthlyExpectedHours, w.HasConsultationPay, w.HasOutsideVisitPay, w.WithholdingRate,
		w.ContactName, w.ContactPhone, w.ContactEmail, w.Notes,
		w.IsActive, w.CreatedAt, w.UpdatedAt)
	return err
}

func (r *WorkplaceRepository) GetWorkplaceByID(ctx context.Context, id uuid.UUID) (*workplace.Workplace, error) {
	w := &workplace.Workplace{}
	var baseRateCents int64
	err := r.db.Pool.QueryRow(ctx, `
		SELECT id, user_id, name, address, color, pay_model, base_rate_cents, currency,
			monthly_expected_hours, has_consultation_pay, has_outside_visit_pay, withholding_rate,
			contact_name, contact_phone, contact_email, notes,
			is_active, created_at, updated_at
		FROM workplaces WHERE id = $1
	`, id).Scan(
		&w.ID, &w.UserID, &w.Name, &w.Address, &w.Color, &w.PayModel, &baseRateCents, &w.Currency,
		&w.MonthlyExpectedHours, &w.HasConsultationPay, &w.HasOutsideVisitPay, &w.WithholdingRate,
		&w.ContactName, &w.ContactPhone, &w.ContactEmail, &w.Notes,
		&w.IsActive, &w.CreatedAt, &w.UpdatedAt,
	)
	w.BaseRateCents = money.Cents(baseRateCents)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, workplace.ErrWorkplaceNotFound
	}
	return w, err
}

func (r *WorkplaceRepository) ListWorkplacesByUser(ctx context.Context, userID uuid.UUID, activeOnly bool) ([]*workplace.Workplace, error) {
	query := `
		SELECT id, user_id, name, address, color, pay_model, base_rate_cents, currency,
			monthly_expected_hours, has_consultation_pay, has_outside_visit_pay, withholding_rate,
			contact_name, contact_phone, contact_email, notes,
			is_active, created_at, updated_at
		FROM workplaces WHERE user_id = $1`
	if activeOnly {
		query += ` AND is_active = true`
	}
	query += ` ORDER BY name`

	rows, err := r.db.Pool.Query(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var workplaces []*workplace.Workplace
	for rows.Next() {
		w := &workplace.Workplace{}
		var baseRateCents int64
		if err := rows.Scan(
			&w.ID, &w.UserID, &w.Name, &w.Address, &w.Color, &w.PayModel, &baseRateCents, &w.Currency,
			&w.MonthlyExpectedHours, &w.HasConsultationPay, &w.HasOutsideVisitPay, &w.WithholdingRate,
			&w.ContactName, &w.ContactPhone, &w.ContactEmail, &w.Notes,
			&w.IsActive, &w.CreatedAt, &w.UpdatedAt,
		); err != nil {
			return nil, err
		}
		w.BaseRateCents = money.Cents(baseRateCents)
		workplaces = append(workplaces, w)
	}
	return workplaces, nil
}

func (r *WorkplaceRepository) UpdateWorkplace(ctx context.Context, w *workplace.Workplace) error {
	_, err := r.db.Pool.Exec(ctx, `
		UPDATE workplaces SET
			name = $2, address = $3, color = $4, pay_model = $5, base_rate_cents = $6,
			monthly_expected_hours = $7, has_consultation_pay = $8, has_outside_visit_pay = $9,
			withholding_rate = $10,
			contact_name = $11, contact_phone = $12, contact_email = $13, notes = $14, updated_at = $15
		WHERE id = $1
	`, w.ID, w.Name, w.Address, w.Color, w.PayModel, int64(w.BaseRateCents),
		w.MonthlyExpectedHours, w.HasConsultationPay, w.HasOutsideVisitPay, w.WithholdingRate,
		w.ContactName, w.ContactPhone, w.ContactEmail, w.Notes, w.UpdatedAt)
	return err
}

func (r *WorkplaceRepository) ArchiveWorkplace(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.Pool.Exec(ctx, `UPDATE workplaces SET is_active = false, updated_at = NOW() WHERE id = $1`, id)
	return err
}

func (r *WorkplaceRepository) CreatePricingRule(ctx context.Context, rule *workplace.PricingRule) error {
	var rateCents *int64
	if rule.RateCents != nil {
		v := int64(*rule.RateCents)
		rateCents = &v
	}
	var consultationRateCents *int64
	if rule.ConsultationRateCents != nil {
		v := int64(*rule.ConsultationRateCents)
		consultationRateCents = &v
	}
	var outsideVisitRateCents *int64
	if rule.OutsideVisitRateCents != nil {
		v := int64(*rule.OutsideVisitRateCents)
		outsideVisitRateCents = &v
	}
	_, err := r.db.Pool.Exec(ctx, `
		INSERT INTO pricing_rules (id, workplace_id, name, priority, time_start, time_end,
			days_of_week, specific_dates, rate_cents, rate_multiplier,
			consultation_rate_cents, outside_visit_rate_cents, is_active, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
	`, rule.ID, rule.WorkplaceID, rule.Name, rule.Priority, rule.TimeStart, rule.TimeEnd,
		rule.DaysOfWeek, rule.SpecificDates, rateCents, rule.RateMultiplier,
		consultationRateCents, outsideVisitRateCents,
		rule.IsActive, rule.CreatedAt, rule.UpdatedAt)
	return err
}

func (r *WorkplaceRepository) GetPricingRuleByID(ctx context.Context, id uuid.UUID) (*workplace.PricingRule, error) {
	rule := &workplace.PricingRule{}
	var rateCents *int64
	var consultationRateCents *int64
	var outsideVisitRateCents *int64
	err := r.db.Pool.QueryRow(ctx, `
		SELECT id, workplace_id, name, priority, time_start, time_end,
			days_of_week, specific_dates, rate_cents, rate_multiplier,
			consultation_rate_cents, outside_visit_rate_cents,
			is_active, created_at, updated_at
		FROM pricing_rules WHERE id = $1
	`, id).Scan(
		&rule.ID, &rule.WorkplaceID, &rule.Name, &rule.Priority, &rule.TimeStart, &rule.TimeEnd,
		&rule.DaysOfWeek, &rule.SpecificDates, &rateCents, &rule.RateMultiplier,
		&consultationRateCents, &outsideVisitRateCents,
		&rule.IsActive, &rule.CreatedAt, &rule.UpdatedAt,
	)
	if rateCents != nil {
		c := money.Cents(*rateCents)
		rule.RateCents = &c
	}
	if consultationRateCents != nil {
		c := money.Cents(*consultationRateCents)
		rule.ConsultationRateCents = &c
	}
	if outsideVisitRateCents != nil {
		c := money.Cents(*outsideVisitRateCents)
		rule.OutsideVisitRateCents = &c
	}
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, workplace.ErrPricingRuleNotFound
	}
	return rule, err
}

func (r *WorkplaceRepository) ListPricingRules(ctx context.Context, workplaceID uuid.UUID, activeOnly bool) ([]*workplace.PricingRule, error) {
	query := `
		SELECT id, workplace_id, name, priority, time_start, time_end,
			days_of_week, specific_dates, rate_cents, rate_multiplier,
			consultation_rate_cents, outside_visit_rate_cents,
			is_active, created_at, updated_at
		FROM pricing_rules WHERE workplace_id = $1`
	if activeOnly {
		query += ` AND is_active = true`
	}
	query += ` ORDER BY priority`

	rows, err := r.db.Pool.Query(ctx, query, workplaceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var rules []*workplace.PricingRule
	for rows.Next() {
		rule := &workplace.PricingRule{}
		var rateCents *int64
		var consultationRateCents *int64
		var outsideVisitRateCents *int64
		if err := rows.Scan(
			&rule.ID, &rule.WorkplaceID, &rule.Name, &rule.Priority, &rule.TimeStart, &rule.TimeEnd,
			&rule.DaysOfWeek, &rule.SpecificDates, &rateCents, &rule.RateMultiplier,
			&consultationRateCents, &outsideVisitRateCents,
			&rule.IsActive, &rule.CreatedAt, &rule.UpdatedAt,
		); err != nil {
			return nil, err
		}
		if rateCents != nil {
			c := money.Cents(*rateCents)
			rule.RateCents = &c
		}
		if consultationRateCents != nil {
			c := money.Cents(*consultationRateCents)
			rule.ConsultationRateCents = &c
		}
		if outsideVisitRateCents != nil {
			c := money.Cents(*outsideVisitRateCents)
			rule.OutsideVisitRateCents = &c
		}
		rules = append(rules, rule)
	}
	return rules, nil
}

func (r *WorkplaceRepository) UpdatePricingRule(ctx context.Context, rule *workplace.PricingRule) error {
	var rateCents *int64
	if rule.RateCents != nil {
		v := int64(*rule.RateCents)
		rateCents = &v
	}
	var consultationRateCents *int64
	if rule.ConsultationRateCents != nil {
		v := int64(*rule.ConsultationRateCents)
		consultationRateCents = &v
	}
	var outsideVisitRateCents *int64
	if rule.OutsideVisitRateCents != nil {
		v := int64(*rule.OutsideVisitRateCents)
		outsideVisitRateCents = &v
	}
	_, err := r.db.Pool.Exec(ctx, `
		UPDATE pricing_rules SET
			name = $2, priority = $3, time_start = $4, time_end = $5,
			days_of_week = $6, specific_dates = $7, rate_cents = $8,
			rate_multiplier = $9, consultation_rate_cents = $10,
			outside_visit_rate_cents = $11, updated_at = $12
		WHERE id = $1
	`, rule.ID, rule.Name, rule.Priority, rule.TimeStart, rule.TimeEnd,
		rule.DaysOfWeek, rule.SpecificDates, rateCents, rule.RateMultiplier,
		consultationRateCents, outsideVisitRateCents, rule.UpdatedAt)
	return err
}

func (r *WorkplaceRepository) DeletePricingRule(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.Pool.Exec(ctx, `DELETE FROM pricing_rules WHERE id = $1`, id)
	return err
}

func (r *WorkplaceRepository) ReorderPricingRules(ctx context.Context, workplaceID uuid.UUID, ruleIDs []uuid.UUID) error {
	tx, err := r.db.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	for i, id := range ruleIDs {
		_, err := tx.Exec(ctx, `
			UPDATE pricing_rules SET priority = $1, updated_at = NOW()
			WHERE id = $2 AND workplace_id = $3
		`, i, id, workplaceID)
		if err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
}
