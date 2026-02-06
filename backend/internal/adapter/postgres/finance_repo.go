package postgres

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/joao-moreira/doctor-tracker/internal/domain/finance"
	"github.com/joao-moreira/doctor-tracker/pkg/money"
)

type FinanceRepository struct {
	db *DB
}

func NewFinanceRepository(db *DB) *FinanceRepository {
	return &FinanceRepository{db: db}
}

func (r *FinanceRepository) CreateInvoice(ctx context.Context, invoice *finance.Invoice) error {
	_, err := r.db.Pool.Exec(ctx, `
		INSERT INTO invoices (id, user_id, workplace_id, period_start, period_end,
			gross_amount_cents, withholding_rate, withholding_cents, iva_rate, iva_cents,
			net_amount_cents, invoice_number, issued_at, paid_at, notes, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
	`, invoice.ID, invoice.UserID, invoice.WorkplaceID, invoice.PeriodStart, invoice.PeriodEnd,
		int64(invoice.GrossAmountCents), invoice.WithholdingRate, int64(invoice.WithholdingCents),
		invoice.IVARate, int64(invoice.IVACents), int64(invoice.NetAmountCents),
		invoice.InvoiceNumber, invoice.IssuedAt, invoice.PaidAt, invoice.Notes,
		invoice.CreatedAt, invoice.UpdatedAt)
	return err
}

func (r *FinanceRepository) GetInvoiceByID(ctx context.Context, id uuid.UUID) (*finance.Invoice, error) {
	inv := &finance.Invoice{}
	var gross, withholding, iva, net int64
	err := r.db.Pool.QueryRow(ctx, `
		SELECT id, user_id, workplace_id, period_start, period_end,
			gross_amount_cents, withholding_rate, withholding_cents, iva_rate, iva_cents,
			net_amount_cents, invoice_number, issued_at, paid_at, notes, created_at, updated_at
		FROM invoices WHERE id = $1
	`, id).Scan(
		&inv.ID, &inv.UserID, &inv.WorkplaceID, &inv.PeriodStart, &inv.PeriodEnd,
		&gross, &inv.WithholdingRate, &withholding, &inv.IVARate, &iva,
		&net, &inv.InvoiceNumber, &inv.IssuedAt, &inv.PaidAt, &inv.Notes,
		&inv.CreatedAt, &inv.UpdatedAt,
	)
	inv.GrossAmountCents = money.Cents(gross)
	inv.WithholdingCents = money.Cents(withholding)
	inv.IVACents = money.Cents(iva)
	inv.NetAmountCents = money.Cents(net)

	if errors.Is(err, pgx.ErrNoRows) {
		return nil, err
	}
	return inv, err
}

func (r *FinanceRepository) ListInvoices(ctx context.Context, userID uuid.UUID, workplaceID *uuid.UUID, start, end time.Time) ([]*finance.Invoice, error) {
	query := `
		SELECT id, user_id, workplace_id, period_start, period_end,
			gross_amount_cents, withholding_rate, withholding_cents, iva_rate, iva_cents,
			net_amount_cents, invoice_number, issued_at, paid_at, notes, created_at, updated_at
		FROM invoices WHERE user_id = $1 AND period_start >= $2 AND period_end <= $3`

	args := []interface{}{userID, start, end}
	if workplaceID != nil {
		query += ` AND workplace_id = $4`
		args = append(args, *workplaceID)
	}
	query += ` ORDER BY period_start DESC`

	rows, err := r.db.Pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var invoices []*finance.Invoice
	for rows.Next() {
		inv := &finance.Invoice{}
		var gross, withholding, iva, net int64
		if err := rows.Scan(
			&inv.ID, &inv.UserID, &inv.WorkplaceID, &inv.PeriodStart, &inv.PeriodEnd,
			&gross, &inv.WithholdingRate, &withholding, &inv.IVARate, &iva,
			&net, &inv.InvoiceNumber, &inv.IssuedAt, &inv.PaidAt, &inv.Notes,
			&inv.CreatedAt, &inv.UpdatedAt,
		); err != nil {
			return nil, err
		}
		inv.GrossAmountCents = money.Cents(gross)
		inv.WithholdingCents = money.Cents(withholding)
		inv.IVACents = money.Cents(iva)
		inv.NetAmountCents = money.Cents(net)
		invoices = append(invoices, inv)
	}
	return invoices, nil
}

func (r *FinanceRepository) UpdateInvoice(ctx context.Context, invoice *finance.Invoice) error {
	_, err := r.db.Pool.Exec(ctx, `
		UPDATE invoices SET
			period_start = $2, period_end = $3, gross_amount_cents = $4,
			withholding_rate = $5, withholding_cents = $6, iva_rate = $7, iva_cents = $8,
			net_amount_cents = $9, invoice_number = $10, issued_at = $11, paid_at = $12,
			notes = $13, updated_at = $14
		WHERE id = $1
	`, invoice.ID, invoice.PeriodStart, invoice.PeriodEnd, int64(invoice.GrossAmountCents),
		invoice.WithholdingRate, int64(invoice.WithholdingCents), invoice.IVARate, int64(invoice.IVACents),
		int64(invoice.NetAmountCents), invoice.InvoiceNumber, invoice.IssuedAt, invoice.PaidAt,
		invoice.Notes, time.Now())
	return err
}

func (r *FinanceRepository) DeleteInvoice(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.Pool.Exec(ctx, `DELETE FROM invoices WHERE id = $1`, id)
	return err
}

func (r *FinanceRepository) GetEarningsSummary(ctx context.Context, userID uuid.UUID, start, end time.Time) (*finance.EarningsSummary, error) {
	summary := &finance.EarningsSummary{
		Period: start.Format("2006-01"),
	}

	// Get total earnings from shift_earnings for shifts in the date range
	var totalCents int64
	var shiftCount int
	err := r.db.Pool.QueryRow(ctx, `
		SELECT COALESCE(SUM(se.amount_cents), 0), COUNT(DISTINCT s.id)
		FROM shift_earnings se
		JOIN shifts s ON se.shift_id = s.id
		WHERE s.user_id = $1 AND s.start_time >= $2 AND s.end_time <= $3 AND s.status != 'cancelled'
	`, userID, start, end).Scan(&totalCents, &shiftCount)
	if err != nil {
		return nil, err
	}

	summary.GrossEarnings = money.Cents(totalCents)
	summary.ShiftCount = shiftCount

	// Get per-workplace breakdown
	rows, err := r.db.Pool.Query(ctx, `
		SELECT w.id, w.name, COALESCE(w.color, '#3B82F6'),
			COALESCE(SUM(se.amount_cents), 0), COUNT(DISTINCT s.id),
			COALESCE(SUM(se.hours), 0)
		FROM shifts s
		JOIN workplaces w ON s.workplace_id = w.id
		LEFT JOIN shift_earnings se ON se.shift_id = s.id
		WHERE s.user_id = $1 AND s.start_time >= $2 AND s.end_time <= $3 AND s.status != 'cancelled'
		GROUP BY w.id, w.name, w.color
		ORDER BY SUM(se.amount_cents) DESC
	`, userID, start, end)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var we finance.WorkplaceEarnings
		var grossCents int64
		if err := rows.Scan(&we.WorkplaceID, &we.WorkplaceName, &we.Color,
			&grossCents, &we.ShiftCount, &we.Hours); err != nil {
			return nil, err
		}
		we.Gross = money.Cents(grossCents)
		summary.ByWorkplace = append(summary.ByWorkplace, we)
	}

	return summary, nil
}

func (r *FinanceRepository) GetMonthlyEarnings(ctx context.Context, userID uuid.UUID, year int) ([]finance.EarningsSummary, error) {
	var summaries []finance.EarningsSummary
	for month := 1; month <= 12; month++ {
		start := time.Date(year, time.Month(month), 1, 0, 0, 0, 0, time.UTC)
		end := start.AddDate(0, 1, 0).Add(-time.Nanosecond)
		s, err := r.GetEarningsSummary(ctx, userID, start, end)
		if err != nil {
			return nil, err
		}
		summaries = append(summaries, *s)
	}
	return summaries, nil
}

func (r *FinanceRepository) GetYearlyEarnings(ctx context.Context, userID uuid.UUID, year int) (*finance.EarningsSummary, error) {
	start := time.Date(year, 1, 1, 0, 0, 0, 0, time.UTC)
	end := time.Date(year, 12, 31, 23, 59, 59, 0, time.UTC)
	return r.GetEarningsSummary(ctx, userID, start, end)
}

func (r *FinanceRepository) GetProjections(ctx context.Context, userID uuid.UUID, year int) ([]finance.Projection, error) {
	now := time.Now()
	var projections []finance.Projection

	for month := 1; month <= 12; month++ {
		start := time.Date(year, time.Month(month), 1, 0, 0, 0, 0, time.UTC)
		end := start.AddDate(0, 1, 0).Add(-time.Nanosecond)
		isActual := start.Before(now) && end.Before(now)

		summary, err := r.GetEarningsSummary(ctx, userID, start, end)
		if err != nil {
			return nil, err
		}

		projections = append(projections, finance.Projection{
			Month:          start.Format("2006-01"),
			ProjectedGross: summary.ProjectedEarnings,
			ActualGross:    summary.GrossEarnings,
			Difference:     summary.GrossEarnings - summary.ProjectedEarnings,
			IsActual:       isActual,
		})
	}

	return projections, nil
}
