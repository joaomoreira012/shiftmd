package handler

import (
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/joao-moreira/doctor-tracker/internal/adapter/http/dto"
	"github.com/joao-moreira/doctor-tracker/internal/adapter/http/middleware"
	"github.com/joao-moreira/doctor-tracker/internal/domain/finance"
	"github.com/joao-moreira/doctor-tracker/internal/domain/tax"
)

type FinanceHandler struct {
	service   *finance.Service
	taxEngine tax.Engine
}

func NewFinanceHandler(service *finance.Service) *FinanceHandler {
	return &FinanceHandler{
		service:   service,
		taxEngine: tax.NewPortugalEngine(),
	}
}

func (h *FinanceHandler) GetSummary(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())

	startStr := r.URL.Query().Get("start")
	endStr := r.URL.Query().Get("end")

	start, _ := time.Parse("2006-01-02", startStr)
	end, _ := time.Parse("2006-01-02", endStr)

	if start.IsZero() || end.IsZero() {
		now := time.Now()
		start = time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)
		end = start.AddDate(0, 1, 0).Add(-time.Nanosecond)
	}

	summary, err := h.service.GetMonthlySummary(r.Context(), userID, start.Year(), int(start.Month()))
	if err != nil {
		dto.Error(w, http.StatusInternalServerError, "failed to get summary")
		return
	}

	dto.JSON(w, http.StatusOK, summary)
}

func (h *FinanceHandler) GetMonthlySummary(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	year, _ := strconv.Atoi(chi.URLParam(r, "year"))
	month, _ := strconv.Atoi(chi.URLParam(r, "month"))

	if year == 0 || month == 0 {
		dto.Error(w, http.StatusBadRequest, "invalid year or month")
		return
	}

	summary, err := h.service.GetMonthlySummary(r.Context(), userID, year, month)
	if err != nil {
		dto.Error(w, http.StatusInternalServerError, "failed to get monthly summary")
		return
	}

	dto.JSON(w, http.StatusOK, summary)
}

func (h *FinanceHandler) GetYearlySummary(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	year, _ := strconv.Atoi(chi.URLParam(r, "year"))

	if year == 0 {
		dto.Error(w, http.StatusBadRequest, "invalid year")
		return
	}

	summary, err := h.service.GetYearlySummary(r.Context(), userID, year)
	if err != nil {
		dto.Error(w, http.StatusInternalServerError, "failed to get yearly summary")
		return
	}

	dto.JSON(w, http.StatusOK, summary)
}

func (h *FinanceHandler) GetMonthlyBreakdown(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	year, _ := strconv.Atoi(chi.URLParam(r, "year"))

	if year == 0 {
		dto.Error(w, http.StatusBadRequest, "invalid year")
		return
	}

	breakdown, err := h.service.GetMonthlyBreakdown(r.Context(), userID, year)
	if err != nil {
		dto.Error(w, http.StatusInternalServerError, "failed to get monthly breakdown")
		return
	}

	dto.JSON(w, http.StatusOK, breakdown)
}

func (h *FinanceHandler) GetProjections(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	year := time.Now().Year()
	if y := r.URL.Query().Get("year"); y != "" {
		year, _ = strconv.Atoi(y)
	}

	projections, err := h.service.GetProjections(r.Context(), userID, year)
	if err != nil {
		dto.Error(w, http.StatusInternalServerError, "failed to get projections")
		return
	}

	dto.JSON(w, http.StatusOK, projections)
}

func (h *FinanceHandler) GetTaxEstimate(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	year, _ := strconv.Atoi(chi.URLParam(r, "year"))

	if year == 0 {
		dto.Error(w, http.StatusBadRequest, "invalid year")
		return
	}

	// Get yearly earnings
	summary, err := h.service.GetYearlySummary(r.Context(), userID, year)
	if err != nil {
		dto.Error(w, http.StatusInternalServerError, "failed to get earnings for tax calculation")
		return
	}

	// Get tax config for the year
	var taxConfig tax.YearConfig
	switch year {
	case 2026:
		taxConfig = tax.Portugal2026Config()
	case 2025:
		taxConfig = tax.Portugal2025Config()
	default:
		taxConfig = tax.Portugal2026Config()
		taxConfig.FiscalYear = year
	}

	annualSummary := h.taxEngine.CalculateAnnualSummary(taxConfig, summary.GrossEarnings)

	dto.JSON(w, http.StatusOK, annualSummary)
}

func (h *FinanceHandler) ListInvoices(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())

	startStr := r.URL.Query().Get("start")
	endStr := r.URL.Query().Get("end")
	start, _ := time.Parse("2006-01-02", startStr)
	end, _ := time.Parse("2006-01-02", endStr)

	if start.IsZero() {
		start = time.Date(time.Now().Year(), 1, 1, 0, 0, 0, 0, time.UTC)
	}
	if end.IsZero() {
		end = time.Date(time.Now().Year(), 12, 31, 23, 59, 59, 0, time.UTC)
	}

	var wpID *uuid.UUID
	if wp := r.URL.Query().Get("workplace_id"); wp != "" {
		id, err := uuid.Parse(wp)
		if err == nil {
			wpID = &id
		}
	}

	invoices, err := h.service.ListInvoices(r.Context(), userID, wpID, start, end)
	if err != nil {
		dto.Error(w, http.StatusInternalServerError, "failed to list invoices")
		return
	}

	dto.JSON(w, http.StatusOK, invoices)
}

func (h *FinanceHandler) CreateInvoice(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())

	var input finance.CreateInvoiceInput
	if err := dto.Decode(r, &input); err != nil {
		dto.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}

	invoice, err := h.service.CreateInvoice(r.Context(), userID, input)
	if err != nil {
		dto.Error(w, http.StatusInternalServerError, "failed to create invoice")
		return
	}

	dto.JSON(w, http.StatusCreated, invoice)
}

func (h *FinanceHandler) GetInvoice(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		dto.Error(w, http.StatusBadRequest, "invalid invoice id")
		return
	}

	invoice, err := h.service.GetInvoice(r.Context(), id)
	if err != nil {
		dto.Error(w, http.StatusNotFound, "invoice not found")
		return
	}

	dto.JSON(w, http.StatusOK, invoice)
}

func (h *FinanceHandler) DeleteInvoice(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		dto.Error(w, http.StatusBadRequest, "invalid invoice id")
		return
	}

	if err := h.service.DeleteInvoice(r.Context(), id); err != nil {
		dto.Error(w, http.StatusInternalServerError, "failed to delete invoice")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
