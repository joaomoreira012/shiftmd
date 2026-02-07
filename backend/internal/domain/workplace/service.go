package workplace

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/joao-moreira/doctor-tracker/pkg/money"
)

var (
	ErrWorkplaceNotFound    = errors.New("workplace not found")
	ErrPricingRuleNotFound  = errors.New("pricing rule not found")
	ErrDuplicatePriority    = errors.New("pricing rule with this priority already exists")
	ErrInvalidRateConfig    = errors.New("must set either rate_cents or rate_multiplier, not both")
)

type Service struct {
	repo Repository
}

func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) CreateWorkplace(ctx context.Context, userID uuid.UUID, input CreateWorkplaceInput) (*Workplace, error) {
	hasConsultationPay := false
	if input.HasConsultationPay != nil {
		hasConsultationPay = *input.HasConsultationPay
	}

	w := &Workplace{
		ID:                   uuid.New(),
		UserID:               userID,
		Name:                 input.Name,
		Address:              input.Address,
		Color:                input.Color,
		PayModel:             input.PayModel,
		BaseRateCents:        money.Cents(input.BaseRateCents),
		Currency:             input.Currency,
		MonthlyExpectedHours: input.MonthlyExpectedHours,
		HasConsultationPay:   hasConsultationPay,
		ContactName:          input.ContactName,
		ContactPhone:         input.ContactPhone,
		ContactEmail:         input.ContactEmail,
		Notes:                input.Notes,
		IsActive:             true,
		CreatedAt:            time.Now(),
		UpdatedAt:            time.Now(),
	}

	if err := s.repo.CreateWorkplace(ctx, w); err != nil {
		return nil, err
	}
	return w, nil
}

func (s *Service) GetWorkplace(ctx context.Context, id uuid.UUID) (*Workplace, error) {
	w, err := s.repo.GetWorkplaceByID(ctx, id)
	if err != nil {
		return nil, ErrWorkplaceNotFound
	}
	return w, nil
}

func (s *Service) ListWorkplaces(ctx context.Context, userID uuid.UUID, activeOnly bool) ([]*Workplace, error) {
	return s.repo.ListWorkplacesByUser(ctx, userID, activeOnly)
}

func (s *Service) UpdateWorkplace(ctx context.Context, id uuid.UUID, input UpdateWorkplaceInput) (*Workplace, error) {
	w, err := s.repo.GetWorkplaceByID(ctx, id)
	if err != nil {
		return nil, ErrWorkplaceNotFound
	}

	if input.Name != nil {
		w.Name = *input.Name
	}
	if input.Address != nil {
		w.Address = input.Address
	}
	if input.Color != nil {
		w.Color = input.Color
	}
	if input.PayModel != nil {
		w.PayModel = *input.PayModel
	}
	if input.BaseRateCents != nil {
		w.BaseRateCents = money.Cents(*input.BaseRateCents)
	}
	if input.MonthlyExpectedHours != nil {
		w.MonthlyExpectedHours = input.MonthlyExpectedHours
	}
	if input.HasConsultationPay != nil {
		w.HasConsultationPay = *input.HasConsultationPay
	}
	if input.ContactName != nil {
		w.ContactName = input.ContactName
	}
	if input.ContactPhone != nil {
		w.ContactPhone = input.ContactPhone
	}
	if input.ContactEmail != nil {
		w.ContactEmail = input.ContactEmail
	}
	if input.Notes != nil {
		w.Notes = input.Notes
	}

	w.UpdatedAt = time.Now()

	if err := s.repo.UpdateWorkplace(ctx, w); err != nil {
		return nil, err
	}
	return w, nil
}

func (s *Service) ArchiveWorkplace(ctx context.Context, id uuid.UUID) error {
	return s.repo.ArchiveWorkplace(ctx, id)
}

// Pricing Rules

func (s *Service) CreatePricingRule(ctx context.Context, workplaceID uuid.UUID, input CreatePricingRuleInput) (*PricingRule, error) {
	if (input.RateCents != nil) == (input.RateMultiplier != nil) {
		return nil, ErrInvalidRateConfig
	}

	var rateCents *money.Cents
	if input.RateCents != nil {
		c := money.Cents(*input.RateCents)
		rateCents = &c
	}
	var consultationRateCents *money.Cents
	if input.ConsultationRateCents != nil {
		c := money.Cents(*input.ConsultationRateCents)
		consultationRateCents = &c
	}

	rule := &PricingRule{
		ID:                    uuid.New(),
		WorkplaceID:           workplaceID,
		Name:                  input.Name,
		Priority:              input.Priority,
		TimeStart:             input.TimeStart,
		TimeEnd:               input.TimeEnd,
		DaysOfWeek:            input.DaysOfWeek,
		SpecificDates:         input.SpecificDates,
		RateCents:             rateCents,
		RateMultiplier:        input.RateMultiplier,
		ConsultationRateCents: consultationRateCents,
		IsActive:              true,
		CreatedAt:             time.Now(),
		UpdatedAt:             time.Now(),
	}

	if err := s.repo.CreatePricingRule(ctx, rule); err != nil {
		return nil, err
	}
	return rule, nil
}

func (s *Service) ListPricingRules(ctx context.Context, workplaceID uuid.UUID) ([]*PricingRule, error) {
	return s.repo.ListPricingRules(ctx, workplaceID, true)
}

func (s *Service) UpdatePricingRule(ctx context.Context, id uuid.UUID, input UpdatePricingRuleInput) (*PricingRule, error) {
	rule, err := s.repo.GetPricingRuleByID(ctx, id)
	if err != nil {
		return nil, ErrPricingRuleNotFound
	}

	if input.Name != nil {
		rule.Name = *input.Name
	}
	if input.Priority != nil {
		rule.Priority = *input.Priority
	}
	if input.TimeStart != nil {
		rule.TimeStart = input.TimeStart
	}
	if input.TimeEnd != nil {
		rule.TimeEnd = input.TimeEnd
	}
	if input.DaysOfWeek != nil {
		rule.DaysOfWeek = input.DaysOfWeek
	}
	if input.SpecificDates != nil {
		rule.SpecificDates = input.SpecificDates
	}
	if input.RateCents != nil {
		c := money.Cents(*input.RateCents)
		rule.RateCents = &c
		rule.RateMultiplier = nil
	}
	if input.RateMultiplier != nil {
		rule.RateMultiplier = input.RateMultiplier
		rule.RateCents = nil
	}
	if input.ConsultationRateCents != nil {
		c := money.Cents(*input.ConsultationRateCents)
		rule.ConsultationRateCents = &c
	}

	rule.UpdatedAt = time.Now()

	if err := s.repo.UpdatePricingRule(ctx, rule); err != nil {
		return nil, err
	}
	return rule, nil
}

func (s *Service) DeletePricingRule(ctx context.Context, id uuid.UUID) error {
	return s.repo.DeletePricingRule(ctx, id)
}

func (s *Service) ReorderPricingRules(ctx context.Context, workplaceID uuid.UUID, ruleIDs []uuid.UUID) error {
	return s.repo.ReorderPricingRules(ctx, workplaceID, ruleIDs)
}
