package finance

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type Repository interface {
	// Invoices
	CreateInvoice(ctx context.Context, invoice *Invoice) error
	GetInvoiceByID(ctx context.Context, id uuid.UUID) (*Invoice, error)
	ListInvoices(ctx context.Context, userID uuid.UUID, workplaceID *uuid.UUID, start, end time.Time) ([]*Invoice, error)
	UpdateInvoice(ctx context.Context, invoice *Invoice) error
	DeleteInvoice(ctx context.Context, id uuid.UUID) error

	// Earnings aggregation
	GetEarningsSummary(ctx context.Context, userID uuid.UUID, start, end time.Time) (*EarningsSummary, error)
	GetMonthlyEarnings(ctx context.Context, userID uuid.UUID, year int) ([]EarningsSummary, error)
	GetYearlyEarnings(ctx context.Context, userID uuid.UUID, year int) (*EarningsSummary, error)

	// Projections
	GetProjections(ctx context.Context, userID uuid.UUID, year int) ([]Projection, error)
}
