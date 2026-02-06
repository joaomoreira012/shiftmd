package finance

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/joao-moreira/doctor-tracker/internal/domain/workplace"
	"github.com/joao-moreira/doctor-tracker/internal/domain/schedule"
	"github.com/joao-moreira/doctor-tracker/pkg/money"
)

type Service struct {
	repo          Repository
	workplaceRepo workplace.Repository
	scheduleRepo  schedule.Repository
}

func NewService(repo Repository, workplaceRepo workplace.Repository, scheduleRepo schedule.Repository) *Service {
	return &Service{
		repo:          repo,
		workplaceRepo: workplaceRepo,
		scheduleRepo:  scheduleRepo,
	}
}

func (s *Service) GetMonthlySummary(ctx context.Context, userID uuid.UUID, year, month int) (*EarningsSummary, error) {
	start := time.Date(year, time.Month(month), 1, 0, 0, 0, 0, time.UTC)
	end := start.AddDate(0, 1, 0).Add(-time.Nanosecond)
	return s.repo.GetEarningsSummary(ctx, userID, start, end)
}

func (s *Service) GetYearlySummary(ctx context.Context, userID uuid.UUID, year int) (*EarningsSummary, error) {
	return s.repo.GetYearlyEarnings(ctx, userID, year)
}

func (s *Service) GetMonthlyBreakdown(ctx context.Context, userID uuid.UUID, year int) ([]EarningsSummary, error) {
	return s.repo.GetMonthlyEarnings(ctx, userID, year)
}

func (s *Service) GetProjections(ctx context.Context, userID uuid.UUID, year int) ([]Projection, error) {
	return s.repo.GetProjections(ctx, userID, year)
}

// Invoice management

func (s *Service) CreateInvoice(ctx context.Context, userID uuid.UUID, input CreateInvoiceInput) (*Invoice, error) {
	gross := money.Cents(input.GrossAmountCents)
	withholding := money.Cents(float64(gross) * input.WithholdingRate)
	iva := money.Cents(float64(gross) * input.IVARate)
	net := gross - withholding + iva

	invoice := &Invoice{
		ID:               uuid.New(),
		UserID:           userID,
		WorkplaceID:      input.WorkplaceID,
		PeriodStart:      input.PeriodStart,
		PeriodEnd:        input.PeriodEnd,
		GrossAmountCents: gross,
		WithholdingRate:  input.WithholdingRate,
		WithholdingCents: withholding,
		IVARate:          input.IVARate,
		IVACents:         iva,
		NetAmountCents:   net,
		InvoiceNumber:    input.InvoiceNumber,
		IssuedAt:         input.IssuedAt,
		Notes:            input.Notes,
		CreatedAt:        time.Now(),
		UpdatedAt:        time.Now(),
	}

	if err := s.repo.CreateInvoice(ctx, invoice); err != nil {
		return nil, err
	}
	return invoice, nil
}

func (s *Service) ListInvoices(ctx context.Context, userID uuid.UUID, workplaceID *uuid.UUID, start, end time.Time) ([]*Invoice, error) {
	return s.repo.ListInvoices(ctx, userID, workplaceID, start, end)
}

func (s *Service) GetInvoice(ctx context.Context, id uuid.UUID) (*Invoice, error) {
	return s.repo.GetInvoiceByID(ctx, id)
}

func (s *Service) DeleteInvoice(ctx context.Context, id uuid.UUID) error {
	return s.repo.DeleteInvoice(ctx, id)
}
