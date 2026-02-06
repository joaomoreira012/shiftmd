package schedule

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/joao-moreira/doctor-tracker/internal/domain/workplace"
	"github.com/joao-moreira/doctor-tracker/pkg/money"
)

// ---------------------------------------------------------------------------
// Mock schedule repository
// ---------------------------------------------------------------------------

type mockScheduleRepo struct {
	mu     sync.Mutex
	shifts map[uuid.UUID]*Shift
}

func newMockScheduleRepo() *mockScheduleRepo {
	return &mockScheduleRepo{
		shifts: make(map[uuid.UUID]*Shift),
	}
}

func (m *mockScheduleRepo) CreateShift(_ context.Context, shift *Shift) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.shifts[shift.ID] = shift
	return nil
}

func (m *mockScheduleRepo) GetShiftByID(_ context.Context, id uuid.UUID) (*Shift, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	s, ok := m.shifts[id]
	if !ok {
		return nil, errors.New("shift not found")
	}
	return s, nil
}

func (m *mockScheduleRepo) ListShifts(_ context.Context, _ ShiftFilter) ([]*Shift, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	var result []*Shift
	for _, s := range m.shifts {
		result = append(result, s)
	}
	return result, nil
}

func (m *mockScheduleRepo) UpdateShift(_ context.Context, shift *Shift) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if _, ok := m.shifts[shift.ID]; !ok {
		return errors.New("shift not found")
	}
	m.shifts[shift.ID] = shift
	return nil
}

func (m *mockScheduleRepo) DeleteShift(_ context.Context, id uuid.UUID) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.shifts, id)
	return nil
}

func (m *mockScheduleRepo) BulkCreateShifts(_ context.Context, shifts []*Shift) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, s := range shifts {
		m.shifts[s.ID] = s
	}
	return nil
}

func (m *mockScheduleRepo) CreateRecurrenceRule(_ context.Context, _ *RecurrenceRule) error {
	return nil
}

func (m *mockScheduleRepo) GetRecurrenceRuleByID(_ context.Context, _ uuid.UUID) (*RecurrenceRule, error) {
	return nil, errors.New("not found")
}

func (m *mockScheduleRepo) UpdateRecurrenceRule(_ context.Context, _ *RecurrenceRule) error {
	return nil
}

func (m *mockScheduleRepo) DeleteRecurrenceRule(_ context.Context, _ uuid.UUID) error {
	return nil
}

func (m *mockScheduleRepo) CreateShiftEarnings(_ context.Context, _ []*ShiftEarning) error {
	return nil
}

func (m *mockScheduleRepo) GetShiftEarnings(_ context.Context, _ uuid.UUID) ([]*ShiftEarning, error) {
	return nil, nil
}

func (m *mockScheduleRepo) DeleteShiftEarnings(_ context.Context, _ uuid.UUID) error {
	return nil
}

func (m *mockScheduleRepo) UpdateEarningStatus(_ context.Context, _ uuid.UUID, _ EarningStatus) error {
	return nil
}

// ---------------------------------------------------------------------------
// Mock workplace repository
// ---------------------------------------------------------------------------

type mockWorkplaceRepo struct {
	mu         sync.Mutex
	workplaces map[uuid.UUID]*workplace.Workplace
}

func newMockWorkplaceRepo() *mockWorkplaceRepo {
	return &mockWorkplaceRepo{
		workplaces: make(map[uuid.UUID]*workplace.Workplace),
	}
}

// addWorkplace is a test helper to seed a workplace into the mock.
func (m *mockWorkplaceRepo) addWorkplace(wp *workplace.Workplace) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.workplaces[wp.ID] = wp
}

func (m *mockWorkplaceRepo) CreateWorkplace(_ context.Context, w *workplace.Workplace) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.workplaces[w.ID] = w
	return nil
}

func (m *mockWorkplaceRepo) GetWorkplaceByID(_ context.Context, id uuid.UUID) (*workplace.Workplace, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	w, ok := m.workplaces[id]
	if !ok {
		return nil, errors.New("workplace not found")
	}
	return w, nil
}

func (m *mockWorkplaceRepo) ListWorkplacesByUser(_ context.Context, _ uuid.UUID, _ bool) ([]*workplace.Workplace, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	var result []*workplace.Workplace
	for _, w := range m.workplaces {
		result = append(result, w)
	}
	return result, nil
}

func (m *mockWorkplaceRepo) UpdateWorkplace(_ context.Context, w *workplace.Workplace) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.workplaces[w.ID] = w
	return nil
}

func (m *mockWorkplaceRepo) ArchiveWorkplace(_ context.Context, id uuid.UUID) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if w, ok := m.workplaces[id]; ok {
		w.IsActive = false
	}
	return nil
}

func (m *mockWorkplaceRepo) CreatePricingRule(_ context.Context, _ *workplace.PricingRule) error {
	return nil
}

func (m *mockWorkplaceRepo) GetPricingRuleByID(_ context.Context, _ uuid.UUID) (*workplace.PricingRule, error) {
	return nil, errors.New("not found")
}

func (m *mockWorkplaceRepo) ListPricingRules(_ context.Context, _ uuid.UUID, _ bool) ([]*workplace.PricingRule, error) {
	// Return empty rules so earnings calculation uses base rate only.
	return nil, nil
}

func (m *mockWorkplaceRepo) UpdatePricingRule(_ context.Context, _ *workplace.PricingRule) error {
	return nil
}

func (m *mockWorkplaceRepo) DeletePricingRule(_ context.Context, _ uuid.UUID) error {
	return nil
}

func (m *mockWorkplaceRepo) ReorderPricingRules(_ context.Context, _ uuid.UUID, _ []uuid.UUID) error {
	return nil
}

// ---------------------------------------------------------------------------
// Helper to build a test service with seeded data
// ---------------------------------------------------------------------------

func newTestScheduleService() (*Service, *mockScheduleRepo, *mockWorkplaceRepo) {
	schedRepo := newMockScheduleRepo()
	wpRepo := newMockWorkplaceRepo()
	svc := NewService(schedRepo, wpRepo)
	return svc, schedRepo, wpRepo
}

func seedWorkplace(wpRepo *mockWorkplaceRepo) *workplace.Workplace {
	wp := &workplace.Workplace{
		ID:            uuid.New(),
		UserID:        uuid.New(),
		Name:          "Hospital Central",
		PayModel:      workplace.PayModelHourly,
		BaseRateCents: money.Cents(2500), // EUR 25.00/h
		Currency:      "EUR",
		IsActive:      true,
		CreatedAt:     time.Now(),
		UpdatedAt:     time.Now(),
	}
	wpRepo.addWorkplace(wp)
	return wp
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

func TestCreateShift_Success(t *testing.T) {
	svc, schedRepo, wpRepo := newTestScheduleService()
	ctx := context.Background()

	wp := seedWorkplace(wpRepo)
	userID := wp.UserID

	start := time.Date(2025, 6, 15, 8, 0, 0, 0, time.UTC)
	end := time.Date(2025, 6, 15, 16, 0, 0, 0, time.UTC)

	shift, err := svc.CreateShift(ctx, userID, CreateShiftInput{
		WorkplaceID: wp.ID,
		StartTime:   start,
		EndTime:     end,
		Timezone:    "Europe/Lisbon",
	})
	if err != nil {
		t.Fatalf("CreateShift returned unexpected error: %v", err)
	}
	if shift == nil {
		t.Fatal("CreateShift returned nil shift")
	}
	if shift.UserID != userID {
		t.Errorf("expected user ID %s, got %s", userID, shift.UserID)
	}
	if shift.WorkplaceID != wp.ID {
		t.Errorf("expected workplace ID %s, got %s", wp.ID, shift.WorkplaceID)
	}
	if shift.Status != ShiftStatusScheduled {
		t.Errorf("expected status %q, got %q", ShiftStatusScheduled, shift.Status)
	}
	if !shift.StartTime.Equal(start) {
		t.Errorf("expected start time %v, got %v", start, shift.StartTime)
	}
	if !shift.EndTime.Equal(end) {
		t.Errorf("expected end time %v, got %v", end, shift.EndTime)
	}
	if shift.Timezone != "Europe/Lisbon" {
		t.Errorf("expected timezone %q, got %q", "Europe/Lisbon", shift.Timezone)
	}

	// Verify shift was persisted in the mock repo
	stored, err := schedRepo.GetShiftByID(ctx, shift.ID)
	if err != nil {
		t.Fatalf("shift not found in repo after creation: %v", err)
	}
	if stored.ID != shift.ID {
		t.Errorf("stored shift ID mismatch: expected %s, got %s", shift.ID, stored.ID)
	}
}

func TestCreateShift_DefaultTimezone(t *testing.T) {
	svc, _, wpRepo := newTestScheduleService()
	ctx := context.Background()

	wp := seedWorkplace(wpRepo)

	start := time.Date(2025, 6, 15, 8, 0, 0, 0, time.UTC)
	end := time.Date(2025, 6, 15, 16, 0, 0, 0, time.UTC)

	shift, err := svc.CreateShift(ctx, wp.UserID, CreateShiftInput{
		WorkplaceID: wp.ID,
		StartTime:   start,
		EndTime:     end,
		// Timezone intentionally left empty
	})
	if err != nil {
		t.Fatalf("CreateShift returned unexpected error: %v", err)
	}
	if shift.Timezone != "Europe/Lisbon" {
		t.Errorf("expected default timezone %q, got %q", "Europe/Lisbon", shift.Timezone)
	}
}

func TestCreateShift_EndBeforeStart(t *testing.T) {
	svc, _, wpRepo := newTestScheduleService()
	ctx := context.Background()

	wp := seedWorkplace(wpRepo)

	start := time.Date(2025, 6, 15, 16, 0, 0, 0, time.UTC)
	end := time.Date(2025, 6, 15, 8, 0, 0, 0, time.UTC) // end is before start

	_, err := svc.CreateShift(ctx, wp.UserID, CreateShiftInput{
		WorkplaceID: wp.ID,
		StartTime:   start,
		EndTime:     end,
	})
	if !errors.Is(err, ErrInvalidTimeRange) {
		t.Fatalf("expected ErrInvalidTimeRange, got: %v", err)
	}
}

func TestCreateShift_EqualStartAndEnd(t *testing.T) {
	svc, _, wpRepo := newTestScheduleService()
	ctx := context.Background()

	wp := seedWorkplace(wpRepo)

	sameTime := time.Date(2025, 6, 15, 10, 0, 0, 0, time.UTC)

	_, err := svc.CreateShift(ctx, wp.UserID, CreateShiftInput{
		WorkplaceID: wp.ID,
		StartTime:   sameTime,
		EndTime:     sameTime,
	})
	if !errors.Is(err, ErrInvalidTimeRange) {
		t.Fatalf("expected ErrInvalidTimeRange for equal start/end, got: %v", err)
	}
}

func TestUpdateShift_Success(t *testing.T) {
	svc, _, wpRepo := newTestScheduleService()
	ctx := context.Background()

	wp := seedWorkplace(wpRepo)
	userID := wp.UserID

	start := time.Date(2025, 6, 15, 8, 0, 0, 0, time.UTC)
	end := time.Date(2025, 6, 15, 16, 0, 0, 0, time.UTC)

	shift, err := svc.CreateShift(ctx, userID, CreateShiftInput{
		WorkplaceID: wp.ID,
		StartTime:   start,
		EndTime:     end,
	})
	if err != nil {
		t.Fatalf("CreateShift failed: %v", err)
	}

	// Update the shift: change times and status
	newStart := time.Date(2025, 6, 15, 9, 0, 0, 0, time.UTC)
	newEnd := time.Date(2025, 6, 15, 17, 0, 0, 0, time.UTC)
	newStatus := ShiftStatusConfirmed

	updated, err := svc.UpdateShift(ctx, shift.ID, UpdateShiftInput{
		StartTime: &newStart,
		EndTime:   &newEnd,
		Status:    &newStatus,
	})
	if err != nil {
		t.Fatalf("UpdateShift returned unexpected error: %v", err)
	}
	if !updated.StartTime.Equal(newStart) {
		t.Errorf("expected start %v, got %v", newStart, updated.StartTime)
	}
	if !updated.EndTime.Equal(newEnd) {
		t.Errorf("expected end %v, got %v", newEnd, updated.EndTime)
	}
	if updated.Status != ShiftStatusConfirmed {
		t.Errorf("expected status %q, got %q", ShiftStatusConfirmed, updated.Status)
	}
}

func TestUpdateShift_PartialUpdate(t *testing.T) {
	svc, _, wpRepo := newTestScheduleService()
	ctx := context.Background()

	wp := seedWorkplace(wpRepo)

	start := time.Date(2025, 6, 15, 8, 0, 0, 0, time.UTC)
	end := time.Date(2025, 6, 15, 16, 0, 0, 0, time.UTC)

	shift, err := svc.CreateShift(ctx, wp.UserID, CreateShiftInput{
		WorkplaceID: wp.ID,
		StartTime:   start,
		EndTime:     end,
	})
	if err != nil {
		t.Fatalf("CreateShift failed: %v", err)
	}

	// Only update the status, leave times unchanged
	newStatus := ShiftStatusCompleted
	updated, err := svc.UpdateShift(ctx, shift.ID, UpdateShiftInput{
		Status: &newStatus,
	})
	if err != nil {
		t.Fatalf("UpdateShift returned unexpected error: %v", err)
	}
	if updated.Status != ShiftStatusCompleted {
		t.Errorf("expected status %q, got %q", ShiftStatusCompleted, updated.Status)
	}
	// Original times should be preserved
	if !updated.StartTime.Equal(start) {
		t.Errorf("expected start time preserved as %v, got %v", start, updated.StartTime)
	}
	if !updated.EndTime.Equal(end) {
		t.Errorf("expected end time preserved as %v, got %v", end, updated.EndTime)
	}
}

func TestUpdateShift_NotFound(t *testing.T) {
	svc, _, _ := newTestScheduleService()
	ctx := context.Background()

	nonExistentID := uuid.New()
	newStatus := ShiftStatusConfirmed

	_, err := svc.UpdateShift(ctx, nonExistentID, UpdateShiftInput{
		Status: &newStatus,
	})
	if !errors.Is(err, ErrShiftNotFound) {
		t.Fatalf("expected ErrShiftNotFound, got: %v", err)
	}
}
