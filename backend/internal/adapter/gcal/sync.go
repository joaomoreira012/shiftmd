package gcal

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/google/uuid"
	"google.golang.org/api/calendar/v3"

	"github.com/joao-moreira/doctor-tracker/internal/domain/schedule"
)

const (
	extPropKey       = "doctorTrackerId"
	extPropSource    = "doctorTrackerSource"
	extPropSourceVal = "doctor-tracker"
)

// SyncResult contains details about a sync operation.
type SyncResult struct {
	Created  int `json:"created"`
	Updated  int `json:"updated"`
	Deleted  int `json:"deleted"`
	Errors   int `json:"errors"`
}

// TriggerSync performs a full or incremental sync for a user.
func (s *Service) TriggerSync(ctx context.Context, userID uuid.UUID, scheduleRepo schedule.Repository) (*SyncResult, error) {
	user, err := s.authRepo.GetUserByID(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("getting user: %w", err)
	}

	calSvc, err := s.getCalendarService(ctx, user)
	if err != nil {
		return nil, fmt.Errorf("creating calendar service: %w", err)
	}

	calendarID := "primary"
	if user.GCalCalendarID != nil {
		calendarID = *user.GCalCalendarID
	}

	syncState, _ := s.syncRepo.GetByUserID(ctx, userID)
	if syncState == nil {
		syncState = &SyncState{
			ID:     uuid.New(),
			UserID: userID,
		}
	}

	result := &SyncResult{}

	// Step 1: Push local shifts to Google Calendar
	if pushErr := s.pushLocalShifts(ctx, calSvc, calendarID, userID, scheduleRepo); pushErr != nil {
		slog.Warn("push to google failed", "error", pushErr, "user_id", userID)
		result.Errors++
	}

	// Step 2: Pull changes from Google Calendar
	pullResult, pullErr := s.pullGoogleEvents(ctx, calSvc, calendarID, userID, syncState, scheduleRepo)
	if pullErr != nil {
		slog.Warn("pull from google failed", "error", pullErr, "user_id", userID)
		result.Errors++
	} else {
		result.Created += pullResult.Created
		result.Updated += pullResult.Updated
		result.Deleted += pullResult.Deleted
	}

	// Update sync state
	now := time.Now()
	if syncState.SyncToken != nil {
		syncState.LastIncrementalSync = &now
	} else {
		syncState.LastFullSync = &now
	}
	if err := s.syncRepo.Upsert(ctx, syncState); err != nil {
		slog.Warn("failed to update sync state", "error", err)
	}

	return result, nil
}

// pushLocalShifts pushes unsynced local shifts to Google Calendar.
func (s *Service) pushLocalShifts(ctx context.Context, calSvc *calendar.Service, calendarID string, userID uuid.UUID, scheduleRepo schedule.Repository) error {
	// Get recent and future shifts (last 30 days + next year)
	shifts, err := scheduleRepo.ListShifts(ctx, schedule.ShiftFilter{
		UserID: userID,
		Start:  time.Now().AddDate(0, -1, 0),
		End:    time.Now().AddDate(1, 0, 0),
	})
	if err != nil {
		return fmt.Errorf("listing shifts: %w", err)
	}

	for _, shift := range shifts {
		if shift.GCalEventID != nil {
			continue // Already synced
		}
		if shift.Status == schedule.ShiftStatusCancelled {
			continue
		}

		event := shiftToEvent(shift)
		created, err := calSvc.Events.Insert(calendarID, event).Context(ctx).Do()
		if err != nil {
			slog.Warn("failed to push shift to gcal", "shift_id", shift.ID, "error", err)
			continue
		}

		shift.GCalEventID = &created.Id
		etag := created.Etag
		shift.GCalEtag = &etag
		now := time.Now()
		shift.LastSyncedAt = &now
		shift.UpdatedAt = now

		if err := scheduleRepo.UpdateShift(ctx, shift); err != nil {
			slog.Warn("failed to update shift with gcal id", "shift_id", shift.ID, "error", err)
		}
	}

	return nil
}

// pullGoogleEvents uses incremental sync to pull changes from Google Calendar.
func (s *Service) pullGoogleEvents(ctx context.Context, calSvc *calendar.Service, calendarID string, userID uuid.UUID, syncState *SyncState, scheduleRepo schedule.Repository) (*SyncResult, error) {
	result := &SyncResult{}

	listCall := calSvc.Events.List(calendarID).
		SingleEvents(true).
		ShowDeleted(true).
		Context(ctx)

	if syncState.SyncToken != nil && *syncState.SyncToken != "" {
		listCall = listCall.SyncToken(*syncState.SyncToken)
	} else {
		// Full sync: only get events from last 30 days
		timeMin := time.Now().AddDate(0, -1, 0).Format(time.RFC3339)
		listCall = listCall.TimeMin(timeMin)
	}

	pageToken := ""
	for {
		if pageToken != "" {
			listCall = listCall.PageToken(pageToken)
		}

		events, err := listCall.Do()
		if err != nil {
			// If sync token is invalid, do a full sync
			if syncState.SyncToken != nil {
				slog.Info("sync token expired, performing full sync", "user_id", userID)
				syncState.SyncToken = nil
				return s.pullGoogleEvents(ctx, calSvc, calendarID, userID, syncState, scheduleRepo)
			}
			return nil, fmt.Errorf("listing events: %w", err)
		}

		for _, event := range events.Items {
			// Skip events we created (avoid echo)
			if isOurEvent(event) {
				continue
			}

			if event.Status == "cancelled" {
				result.Deleted++
				continue
			}

			// For now, we only display external events as read-only in the calendar
			// Full bidirectional mapping could be added later
			result.Created++
		}

		if events.NextPageToken == "" {
			if events.NextSyncToken != "" {
				syncState.SyncToken = &events.NextSyncToken
			}
			break
		}
		pageToken = events.NextPageToken
	}

	return result, nil
}

func isOurEvent(event *calendar.Event) bool {
	if event.ExtendedProperties != nil && event.ExtendedProperties.Private != nil {
		if val, ok := event.ExtendedProperties.Private[extPropSource]; ok {
			return val == extPropSourceVal
		}
	}
	return false
}

func shiftToEvent(shift *schedule.Shift) *calendar.Event {
	title := "Shift"
	if shift.Title != nil {
		title = *shift.Title
	}

	event := &calendar.Event{
		Summary:     title,
		Description: stringVal(shift.Notes),
		Start: &calendar.EventDateTime{
			DateTime: shift.StartTime.Format(time.RFC3339),
			TimeZone: shift.Timezone,
		},
		End: &calendar.EventDateTime{
			DateTime: shift.EndTime.Format(time.RFC3339),
			TimeZone: shift.Timezone,
		},
		ExtendedProperties: &calendar.EventExtendedProperties{
			Private: map[string]string{
				extPropKey:    shift.ID.String(),
				extPropSource: extPropSourceVal,
			},
		},
	}

	return event
}

func stringVal(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}
