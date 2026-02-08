package gcal

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/google/uuid"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
	"google.golang.org/api/calendar/v3"
	"google.golang.org/api/option"

	"github.com/joao-moreira/doctor-tracker/internal/config"
	"github.com/joao-moreira/doctor-tracker/internal/domain/auth"
)

// Service handles Google Calendar OAuth and sync operations.
type Service struct {
	oauthCfg    *oauth2.Config
	authRepo    auth.Repository
	syncRepo    SyncStateRepository
	calendarID  string
}

// SyncState tracks the state of Google Calendar sync per user.
type SyncState struct {
	ID                    uuid.UUID
	UserID                uuid.UUID
	SyncToken             *string
	PageToken             *string
	ChannelID             *string
	ResourceID            *string
	ChannelExpiry         *time.Time
	LastFullSync          *time.Time
	LastIncrementalSync   *time.Time
}

// SyncStatus is returned to the frontend.
type SyncStatus struct {
	Connected          bool       `json:"connected"`
	CalendarID         *string    `json:"calendar_id,omitempty"`
	LastSync           *time.Time `json:"last_sync,omitempty"`
	ChannelActive      bool       `json:"channel_active"`
	ChannelExpiry      *time.Time `json:"channel_expiry,omitempty"`
}

func NewService(cfg config.GoogleConfig, authRepo auth.Repository, syncRepo SyncStateRepository) *Service {
	oauthCfg := &oauth2.Config{
		ClientID:     cfg.ClientID,
		ClientSecret: cfg.ClientSecret,
		RedirectURL:  cfg.RedirectURL,
		Scopes:       []string{calendar.CalendarScope},
		Endpoint:     google.Endpoint,
	}

	return &Service{
		oauthCfg: oauthCfg,
		authRepo: authRepo,
		syncRepo: syncRepo,
	}
}

// GetAuthURL returns the OAuth2 consent URL.
func (s *Service) GetAuthURL(state string) string {
	return s.oauthCfg.AuthCodeURL(state, oauth2.AccessTypeOffline, oauth2.ApprovalForce)
}

// HandleCallback exchanges the authorization code for tokens and stores them on the user.
func (s *Service) HandleCallback(ctx context.Context, userID uuid.UUID, code string) error {
	token, err := s.oauthCfg.Exchange(ctx, code)
	if err != nil {
		return fmt.Errorf("exchanging oauth code: %w", err)
	}

	user, err := s.authRepo.GetUserByID(ctx, userID)
	if err != nil {
		return fmt.Errorf("getting user: %w", err)
	}

	user.GCalAccessToken = &token.AccessToken
	user.GCalRefreshToken = &token.RefreshToken
	user.GCalTokenExpiry = &token.Expiry

	// Create a dedicated ShiftMD calendar
	calSvc, calErr := s.getCalendarService(ctx, user)
	if calErr == nil {
		newCal, insertErr := calSvc.Calendars.Insert(&calendar.Calendar{
			Summary:     "ShiftMD",
			Description: "Shifts managed by ShiftMD",
			TimeZone:    "Europe/Lisbon",
		}).Context(ctx).Do()
		if insertErr == nil {
			user.GCalCalendarID = &newCal.Id
		} else {
			slog.Warn("failed to create ShiftMD calendar, falling back to primary", "error", insertErr)
			primary := "primary"
			user.GCalCalendarID = &primary
		}
	} else {
		slog.Warn("failed to get calendar service, falling back to primary", "error", calErr)
		primary := "primary"
		user.GCalCalendarID = &primary
	}

	if err := s.authRepo.UpdateUser(ctx, user); err != nil {
		return fmt.Errorf("saving oauth tokens: %w", err)
	}

	// Initialize sync state
	syncState := &SyncState{
		ID:     uuid.New(),
		UserID: userID,
	}
	if err := s.syncRepo.Upsert(ctx, syncState); err != nil {
		slog.Warn("failed to init sync state", "error", err)
	}

	return nil
}

// Disconnect removes OAuth tokens and sync state.
func (s *Service) Disconnect(ctx context.Context, userID uuid.UUID) error {
	user, err := s.authRepo.GetUserByID(ctx, userID)
	if err != nil {
		return fmt.Errorf("getting user: %w", err)
	}

	// Delete the dedicated ShiftMD calendar (if not "primary")
	if user.GCalCalendarID != nil && *user.GCalCalendarID != "primary" {
		calSvc, calErr := s.getCalendarService(ctx, user)
		if calErr == nil {
			if delErr := calSvc.Calendars.Delete(*user.GCalCalendarID).Context(ctx).Do(); delErr != nil {
				slog.Warn("failed to delete ShiftMD calendar", "calendar_id", *user.GCalCalendarID, "error", delErr)
			}
		}
	}

	user.GCalAccessToken = nil
	user.GCalRefreshToken = nil
	user.GCalTokenExpiry = nil
	user.GCalCalendarID = nil

	if err := s.authRepo.UpdateUser(ctx, user); err != nil {
		return fmt.Errorf("clearing oauth tokens: %w", err)
	}

	if err := s.syncRepo.Delete(ctx, userID); err != nil {
		slog.Warn("failed to delete sync state", "error", err)
	}

	return nil
}

// GetStatus returns the sync status for a user.
func (s *Service) GetStatus(ctx context.Context, userID uuid.UUID) (*SyncStatus, error) {
	user, err := s.authRepo.GetUserByID(ctx, userID)
	if err != nil {
		return nil, err
	}

	connected := user.GCalAccessToken != nil && *user.GCalAccessToken != ""

	status := &SyncStatus{
		Connected:  connected,
		CalendarID: user.GCalCalendarID,
	}

	if connected {
		syncState, err := s.syncRepo.GetByUserID(ctx, userID)
		if err == nil && syncState != nil {
			if syncState.LastIncrementalSync != nil {
				status.LastSync = syncState.LastIncrementalSync
			} else if syncState.LastFullSync != nil {
				status.LastSync = syncState.LastFullSync
			}
			status.ChannelActive = syncState.ChannelID != nil
			status.ChannelExpiry = syncState.ChannelExpiry
		}
	}

	return status, nil
}

// getCalendarService creates a Google Calendar API client for a user.
func (s *Service) getCalendarService(ctx context.Context, user *auth.User) (*calendar.Service, error) {
	if user.GCalAccessToken == nil || user.GCalRefreshToken == nil {
		return nil, fmt.Errorf("user has no google calendar tokens")
	}

	token := &oauth2.Token{
		AccessToken:  *user.GCalAccessToken,
		RefreshToken: *user.GCalRefreshToken,
		TokenType:    "Bearer",
	}
	if user.GCalTokenExpiry != nil {
		token.Expiry = *user.GCalTokenExpiry
	}

	// TokenSource will auto-refresh if expired
	tokenSource := s.oauthCfg.TokenSource(ctx, token)

	// Check if token was refreshed and save new tokens
	newToken, err := tokenSource.Token()
	if err != nil {
		return nil, fmt.Errorf("getting oauth token: %w", err)
	}

	if newToken.AccessToken != *user.GCalAccessToken {
		user.GCalAccessToken = &newToken.AccessToken
		user.GCalTokenExpiry = &newToken.Expiry
		if newToken.RefreshToken != "" {
			user.GCalRefreshToken = &newToken.RefreshToken
		}
		if err := s.authRepo.UpdateUser(ctx, user); err != nil {
			slog.Warn("failed to save refreshed token", "error", err)
		}
	}

	svc, err := calendar.NewService(ctx, option.WithTokenSource(tokenSource))
	if err != nil {
		return nil, fmt.Errorf("creating calendar service: %w", err)
	}

	return svc, nil
}

// Enabled returns true if Google Calendar OAuth is configured.
func (s *Service) Enabled() bool {
	return s.oauthCfg.ClientID != "" && s.oauthCfg.ClientSecret != ""
}
