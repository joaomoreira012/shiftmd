package workplace

import (
	"context"

	"github.com/google/uuid"
)

type Repository interface {
	// Workplaces
	CreateWorkplace(ctx context.Context, w *Workplace) error
	GetWorkplaceByID(ctx context.Context, id uuid.UUID) (*Workplace, error)
	ListWorkplacesByUser(ctx context.Context, userID uuid.UUID, activeOnly bool) ([]*Workplace, error)
	UpdateWorkplace(ctx context.Context, w *Workplace) error
	ArchiveWorkplace(ctx context.Context, id uuid.UUID) error

	// Pricing Rules
	CreatePricingRule(ctx context.Context, rule *PricingRule) error
	GetPricingRuleByID(ctx context.Context, id uuid.UUID) (*PricingRule, error)
	ListPricingRules(ctx context.Context, workplaceID uuid.UUID, activeOnly bool) ([]*PricingRule, error)
	UpdatePricingRule(ctx context.Context, rule *PricingRule) error
	DeletePricingRule(ctx context.Context, id uuid.UUID) error
	ReorderPricingRules(ctx context.Context, workplaceID uuid.UUID, ruleIDs []uuid.UUID) error
}
