package schedule

import (
	"context"
	"errors"
	"log/slog"
	"time"

	"github.com/google/uuid"
	"github.com/joao-moreira/doctor-tracker/internal/domain/workplace"
)

var (
	ErrShiftNotFound      = errors.New("shift not found")
	ErrShiftOverlap       = errors.New("shift overlaps with an existing shift")
	ErrInvalidTimeRange   = errors.New("end time must be after start time")
)

// CalendarSyncer pushes shift changes to an external calendar (e.g. Google Calendar).
type CalendarSyncer interface {
	SyncShift(ctx context.Context, userID uuid.UUID, shift *Shift) error
	RemoveShift(ctx context.Context, userID uuid.UUID, shift *Shift) error
}

type Service struct {
	repo           Repository
	workplaceRepo  workplace.Repository
	calendarSyncer CalendarSyncer
}

func NewService(repo Repository, workplaceRepo workplace.Repository, calendarSyncer CalendarSyncer) *Service {
	return &Service{repo: repo, workplaceRepo: workplaceRepo, calendarSyncer: calendarSyncer}
}

func (s *Service) CreateShift(ctx context.Context, userID uuid.UUID, input CreateShiftInput) (*Shift, error) {
	if !input.EndTime.After(input.StartTime) {
		return nil, ErrInvalidTimeRange
	}

	tz := input.Timezone
	if tz == "" {
		tz = "Europe/Lisbon"
	}

	shift := &Shift{
		ID:           uuid.New(),
		UserID:       userID,
		WorkplaceID:  input.WorkplaceID,
		StartTime:    input.StartTime,
		EndTime:      input.EndTime,
		Timezone:     tz,
		Status:       ShiftStatusScheduled,
		Title:         input.Title,
		Notes:         input.Notes,
		PatientsSeen:  input.PatientsSeen,
		OutsideVisits: input.OutsideVisits,
		CreatedAt:     time.Now(),
		UpdatedAt:    time.Now(),
	}

	if err := s.repo.CreateShift(ctx, shift); err != nil {
		return nil, err
	}

	// Calculate and store earnings
	if err := s.calculateAndStoreEarnings(ctx, shift); err != nil {
		return nil, err
	}

	s.syncToCalendar(ctx, shift)

	return shift, nil
}

func (s *Service) GetShift(ctx context.Context, id uuid.UUID) (*Shift, error) {
	shift, err := s.repo.GetShiftByID(ctx, id)
	if err != nil {
		return nil, ErrShiftNotFound
	}

	// Populate workplace and earnings
	wp, _ := s.workplaceRepo.GetWorkplaceByID(ctx, shift.WorkplaceID)
	shift.Workplace = wp

	earnings, _ := s.repo.GetShiftEarnings(ctx, shift.ID)
	for _, e := range earnings {
		shift.Earnings = append(shift.Earnings, workplace.EarningSegment{
			Start:  e.SegmentStart,
			End:    e.SegmentEnd,
			Hours:  e.Hours,
			Rate:   e.RateCents,
			Amount: e.AmountCents,
		})
	}
	shift.TotalEarnings = workplace.TotalEarnings(shift.Earnings)

	return shift, nil
}

func (s *Service) ListShifts(ctx context.Context, filter ShiftFilter) ([]*Shift, error) {
	return s.repo.ListShifts(ctx, filter)
}

func (s *Service) UpdateShift(ctx context.Context, id uuid.UUID, input UpdateShiftInput) (*Shift, error) {
	shift, err := s.repo.GetShiftByID(ctx, id)
	if err != nil {
		return nil, ErrShiftNotFound
	}

	if input.StartTime != nil {
		shift.StartTime = *input.StartTime
	}
	if input.EndTime != nil {
		shift.EndTime = *input.EndTime
	}
	if input.Status != nil {
		shift.Status = *input.Status
	}
	if input.Title != nil {
		shift.Title = input.Title
	}
	if input.Notes != nil {
		shift.Notes = input.Notes
	}
	if input.PatientsSeen != nil {
		shift.PatientsSeen = input.PatientsSeen
	}
	if input.OutsideVisits != nil {
		shift.OutsideVisits = input.OutsideVisits
	}

	if !shift.EndTime.After(shift.StartTime) {
		return nil, ErrInvalidTimeRange
	}

	shift.UpdatedAt = time.Now()

	if err := s.repo.UpdateShift(ctx, shift); err != nil {
		return nil, err
	}

	// Recalculate earnings if time, patients, or outside visits changed
	if input.StartTime != nil || input.EndTime != nil || input.PatientsSeen != nil || input.OutsideVisits != nil {
		if err := s.calculateAndStoreEarnings(ctx, shift); err != nil {
			return nil, err
		}
	}

	if shift.Status == ShiftStatusCancelled {
		s.removeFromCalendar(ctx, shift)
	} else {
		s.syncToCalendar(ctx, shift)
	}

	return shift, nil
}

func (s *Service) DeleteShift(ctx context.Context, id uuid.UUID) error {
	shift, err := s.repo.GetShiftByID(ctx, id)
	if err != nil {
		return ErrShiftNotFound
	}

	if err := s.repo.DeleteShift(ctx, id); err != nil {
		return err
	}

	s.removeFromCalendar(ctx, shift)

	return nil
}

func (s *Service) syncToCalendar(ctx context.Context, shift *Shift) {
	if s.calendarSyncer == nil {
		return
	}
	if err := s.calendarSyncer.SyncShift(ctx, shift.UserID, shift); err != nil {
		slog.Warn("gcal sync failed", "shift_id", shift.ID, "error", err)
		return
	}
	// Persist gcal fields (event ID, etag, last_synced_at) set by SyncShift
	if err := s.repo.UpdateShift(ctx, shift); err != nil {
		slog.Warn("failed to persist gcal fields after sync", "shift_id", shift.ID, "error", err)
	}
}

func (s *Service) removeFromCalendar(ctx context.Context, shift *Shift) {
	if s.calendarSyncer == nil || shift.GCalEventID == nil {
		return
	}
	if err := s.calendarSyncer.RemoveShift(ctx, shift.UserID, shift); err != nil {
		slog.Warn("gcal delete failed", "shift_id", shift.ID, "error", err)
	}
}

func (s *Service) calculateAndStoreEarnings(ctx context.Context, shift *Shift) error {
	wp, err := s.workplaceRepo.GetWorkplaceByID(ctx, shift.WorkplaceID)
	if err != nil {
		return err
	}

	rules, err := s.workplaceRepo.ListPricingRules(ctx, shift.WorkplaceID, true)
	if err != nil {
		return err
	}

	// Delete existing earnings for this shift
	_ = s.repo.DeleteShiftEarnings(ctx, shift.ID)

	// Calculate new earnings
	patientsSeen := 0
	if shift.PatientsSeen != nil {
		patientsSeen = *shift.PatientsSeen
	}
	outsideVisits := 0
	if shift.OutsideVisits != nil {
		outsideVisits = *shift.OutsideVisits
	}
	segments := workplace.ResolveShiftEarnings(shift.StartTime, shift.EndTime, wp, rules, patientsSeen, outsideVisits)

	var shiftEarnings []*ShiftEarning
	for _, seg := range segments {
		shiftEarnings = append(shiftEarnings, &ShiftEarning{
			ID:           uuid.New(),
			ShiftID:      shift.ID,
			SegmentStart: seg.Start,
			SegmentEnd:   seg.End,
			Hours:        seg.Hours,
			RateCents:    seg.Rate,
			AmountCents:  seg.Amount,
			Status:       EarningStatusProjected,
			CreatedAt:    time.Now(),
			UpdatedAt:    time.Now(),
		})
	}

	if len(shiftEarnings) > 0 {
		return s.repo.CreateShiftEarnings(ctx, shiftEarnings)
	}

	// Update shift with calculated values
	shift.Earnings = segments
	shift.TotalEarnings = workplace.TotalEarnings(segments)
	shift.Workplace = wp

	return nil
}
