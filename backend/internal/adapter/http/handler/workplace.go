package handler

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/joao-moreira/doctor-tracker/internal/adapter/http/dto"
	"github.com/joao-moreira/doctor-tracker/internal/adapter/http/middleware"
	"github.com/joao-moreira/doctor-tracker/internal/domain/workplace"
)

type WorkplaceHandler struct {
	service *workplace.Service
}

func NewWorkplaceHandler(service *workplace.Service) *WorkplaceHandler {
	return &WorkplaceHandler{service: service}
}

func (h *WorkplaceHandler) List(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	workplaces, err := h.service.ListWorkplaces(r.Context(), userID, true)
	if err != nil {
		dto.Error(w, http.StatusInternalServerError, "failed to list workplaces")
		return
	}
	dto.JSON(w, http.StatusOK, workplaces)
}

func (h *WorkplaceHandler) Create(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())

	var input workplace.CreateWorkplaceInput
	if err := dto.Decode(r, &input); err != nil {
		dto.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}

	wp, err := h.service.CreateWorkplace(r.Context(), userID, input)
	if err != nil {
		dto.Error(w, http.StatusInternalServerError, "failed to create workplace")
		return
	}

	dto.JSON(w, http.StatusCreated, wp)
}

func (h *WorkplaceHandler) Get(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		dto.Error(w, http.StatusBadRequest, "invalid workplace id")
		return
	}

	wp, err := h.service.GetWorkplace(r.Context(), id)
	if err != nil {
		dto.Error(w, http.StatusNotFound, err.Error())
		return
	}

	dto.JSON(w, http.StatusOK, wp)
}

func (h *WorkplaceHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		dto.Error(w, http.StatusBadRequest, "invalid workplace id")
		return
	}

	var input workplace.UpdateWorkplaceInput
	if err := dto.Decode(r, &input); err != nil {
		dto.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}

	wp, err := h.service.UpdateWorkplace(r.Context(), id, input)
	if err != nil {
		dto.Error(w, http.StatusInternalServerError, "failed to update workplace")
		return
	}

	dto.JSON(w, http.StatusOK, wp)
}

func (h *WorkplaceHandler) Archive(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		dto.Error(w, http.StatusBadRequest, "invalid workplace id")
		return
	}

	if err := h.service.ArchiveWorkplace(r.Context(), id); err != nil {
		dto.Error(w, http.StatusInternalServerError, "failed to archive workplace")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *WorkplaceHandler) ListPricingRules(w http.ResponseWriter, r *http.Request) {
	wpID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		dto.Error(w, http.StatusBadRequest, "invalid workplace id")
		return
	}

	rules, err := h.service.ListPricingRules(r.Context(), wpID)
	if err != nil {
		dto.Error(w, http.StatusInternalServerError, "failed to list pricing rules")
		return
	}

	dto.JSON(w, http.StatusOK, rules)
}

func (h *WorkplaceHandler) CreatePricingRule(w http.ResponseWriter, r *http.Request) {
	wpID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		dto.Error(w, http.StatusBadRequest, "invalid workplace id")
		return
	}

	var input workplace.CreatePricingRuleInput
	if err := dto.Decode(r, &input); err != nil {
		dto.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}

	rule, err := h.service.CreatePricingRule(r.Context(), wpID, input)
	if err != nil {
		dto.Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	dto.JSON(w, http.StatusCreated, rule)
}

func (h *WorkplaceHandler) UpdatePricingRule(w http.ResponseWriter, r *http.Request) {
	ruleID, err := uuid.Parse(chi.URLParam(r, "ruleId"))
	if err != nil {
		dto.Error(w, http.StatusBadRequest, "invalid rule id")
		return
	}

	var input workplace.UpdatePricingRuleInput
	if err := dto.Decode(r, &input); err != nil {
		dto.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}

	rule, err := h.service.UpdatePricingRule(r.Context(), ruleID, input)
	if err != nil {
		dto.Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	dto.JSON(w, http.StatusOK, rule)
}

func (h *WorkplaceHandler) DeletePricingRule(w http.ResponseWriter, r *http.Request) {
	ruleID, err := uuid.Parse(chi.URLParam(r, "ruleId"))
	if err != nil {
		dto.Error(w, http.StatusBadRequest, "invalid rule id")
		return
	}

	if err := h.service.DeletePricingRule(r.Context(), ruleID); err != nil {
		dto.Error(w, http.StatusInternalServerError, "failed to delete pricing rule")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *WorkplaceHandler) ReorderPricingRules(w http.ResponseWriter, r *http.Request) {
	wpID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		dto.Error(w, http.StatusBadRequest, "invalid workplace id")
		return
	}

	var body struct {
		RuleIDs []uuid.UUID `json:"rule_ids"`
	}
	if err := dto.Decode(r, &body); err != nil {
		dto.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if err := h.service.ReorderPricingRules(r.Context(), wpID, body.RuleIDs); err != nil {
		dto.Error(w, http.StatusInternalServerError, "failed to reorder pricing rules")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
