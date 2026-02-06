package handler

import (
	"crypto/rand"
	"encoding/hex"
	"net/http"

	"github.com/joao-moreira/doctor-tracker/internal/adapter/gcal"
	"github.com/joao-moreira/doctor-tracker/internal/adapter/http/dto"
	"github.com/joao-moreira/doctor-tracker/internal/adapter/http/middleware"
	"github.com/joao-moreira/doctor-tracker/internal/domain/schedule"
)

type GCalHandler struct {
	gcalService  *gcal.Service
	scheduleRepo schedule.Repository
}

func NewGCalHandler(gcalService *gcal.Service, scheduleRepo schedule.Repository) *GCalHandler {
	return &GCalHandler{
		gcalService:  gcalService,
		scheduleRepo: scheduleRepo,
	}
}

// GetAuthURL returns the Google OAuth2 consent URL.
func (h *GCalHandler) GetAuthURL(w http.ResponseWriter, r *http.Request) {
	if !h.gcalService.Enabled() {
		dto.Error(w, http.StatusServiceUnavailable, "Google Calendar integration is not configured")
		return
	}

	// Generate a random state parameter for CSRF protection
	stateBytes := make([]byte, 16)
	if _, err := rand.Read(stateBytes); err != nil {
		dto.Error(w, http.StatusInternalServerError, "failed to generate state")
		return
	}
	state := hex.EncodeToString(stateBytes)

	url := h.gcalService.GetAuthURL(state)
	dto.JSON(w, http.StatusOK, map[string]string{
		"url":   url,
		"state": state,
	})
}

// HandleCallback exchanges the OAuth2 authorization code for tokens.
func (h *GCalHandler) HandleCallback(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())

	var input struct {
		Code string `json:"code"`
	}
	if err := dto.Decode(r, &input); err != nil || input.Code == "" {
		dto.Error(w, http.StatusBadRequest, "authorization code is required")
		return
	}

	if err := h.gcalService.HandleCallback(r.Context(), userID, input.Code); err != nil {
		dto.Error(w, http.StatusInternalServerError, "failed to connect Google Calendar")
		return
	}

	dto.JSON(w, http.StatusOK, map[string]string{
		"message": "Google Calendar connected successfully",
	})
}

// GetStatus returns the Google Calendar sync status.
func (h *GCalHandler) GetStatus(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())

	status, err := h.gcalService.GetStatus(r.Context(), userID)
	if err != nil {
		dto.Error(w, http.StatusInternalServerError, "failed to get sync status")
		return
	}

	dto.JSON(w, http.StatusOK, status)
}

// TriggerSync manually triggers a Google Calendar sync.
func (h *GCalHandler) TriggerSync(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())

	result, err := h.gcalService.TriggerSync(r.Context(), userID, h.scheduleRepo)
	if err != nil {
		dto.Error(w, http.StatusInternalServerError, "sync failed")
		return
	}

	dto.JSON(w, http.StatusOK, result)
}

// Disconnect removes the Google Calendar connection.
func (h *GCalHandler) Disconnect(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())

	if err := h.gcalService.Disconnect(r.Context(), userID); err != nil {
		dto.Error(w, http.StatusInternalServerError, "failed to disconnect Google Calendar")
		return
	}

	dto.JSON(w, http.StatusOK, map[string]string{
		"message": "Google Calendar disconnected",
	})
}
