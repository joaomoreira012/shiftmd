package handler

import (
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/joao-moreira/doctor-tracker/internal/adapter/http/dto"
	"github.com/joao-moreira/doctor-tracker/internal/adapter/http/middleware"
	"github.com/joao-moreira/doctor-tracker/internal/domain/schedule"
)

type ScheduleHandler struct {
	service *schedule.Service
}

func NewScheduleHandler(service *schedule.Service) *ScheduleHandler {
	return &ScheduleHandler{service: service}
}

func (h *ScheduleHandler) List(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())

	startStr := r.URL.Query().Get("start")
	endStr := r.URL.Query().Get("end")

	start, err := time.Parse(time.RFC3339, startStr)
	if err != nil {
		dto.Error(w, http.StatusBadRequest, "invalid start date (use RFC3339 format)")
		return
	}

	end, err := time.Parse(time.RFC3339, endStr)
	if err != nil {
		dto.Error(w, http.StatusBadRequest, "invalid end date (use RFC3339 format)")
		return
	}

	filter := schedule.ShiftFilter{
		UserID: userID,
		Start:  start,
		End:    end,
	}

	if wpID := r.URL.Query().Get("workplace_id"); wpID != "" {
		id, err := uuid.Parse(wpID)
		if err == nil {
			filter.WorkplaceID = &id
		}
	}

	shifts, err := h.service.ListShifts(r.Context(), filter)
	if err != nil {
		dto.Error(w, http.StatusInternalServerError, "failed to list shifts")
		return
	}

	dto.JSON(w, http.StatusOK, shifts)
}

func (h *ScheduleHandler) Create(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())

	var input schedule.CreateShiftInput
	if err := dto.Decode(r, &input); err != nil {
		dto.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}

	shift, err := h.service.CreateShift(r.Context(), userID, input)
	if err != nil {
		dto.Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	dto.JSON(w, http.StatusCreated, shift)
}

func (h *ScheduleHandler) Get(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		dto.Error(w, http.StatusBadRequest, "invalid shift id")
		return
	}

	shift, err := h.service.GetShift(r.Context(), id)
	if err != nil {
		dto.Error(w, http.StatusNotFound, err.Error())
		return
	}

	dto.JSON(w, http.StatusOK, shift)
}

func (h *ScheduleHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		dto.Error(w, http.StatusBadRequest, "invalid shift id")
		return
	}

	var input schedule.UpdateShiftInput
	if err := dto.Decode(r, &input); err != nil {
		dto.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}

	shift, err := h.service.UpdateShift(r.Context(), id, input)
	if err != nil {
		dto.Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	dto.JSON(w, http.StatusOK, shift)
}

func (h *ScheduleHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		dto.Error(w, http.StatusBadRequest, "invalid shift id")
		return
	}

	if err := h.service.DeleteShift(r.Context(), id); err != nil {
		dto.Error(w, http.StatusInternalServerError, "failed to delete shift")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *ScheduleHandler) BulkCreate(w http.ResponseWriter, r *http.Request) {
	// TODO: Implement bulk shift creation
	dto.Error(w, http.StatusNotImplemented, "bulk create not yet implemented")
}

func (h *ScheduleHandler) GetEarnings(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		dto.Error(w, http.StatusBadRequest, "invalid shift id")
		return
	}

	shift, err := h.service.GetShift(r.Context(), id)
	if err != nil {
		dto.Error(w, http.StatusNotFound, err.Error())
		return
	}

	dto.JSON(w, http.StatusOK, map[string]interface{}{
		"shift_id":       shift.ID,
		"earnings":       shift.Earnings,
		"total_earnings": shift.TotalEarnings,
	})
}
