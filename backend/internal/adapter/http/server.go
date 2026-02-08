package http

import (
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	chiMiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/joao-moreira/doctor-tracker/internal/adapter/gcal"
	"github.com/joao-moreira/doctor-tracker/internal/adapter/http/handler"
	"github.com/joao-moreira/doctor-tracker/internal/adapter/http/middleware"
	"github.com/joao-moreira/doctor-tracker/internal/config"
	"github.com/joao-moreira/doctor-tracker/internal/domain/auth"
	"github.com/joao-moreira/doctor-tracker/internal/domain/finance"
	"github.com/joao-moreira/doctor-tracker/internal/domain/schedule"
	"github.com/joao-moreira/doctor-tracker/internal/domain/workplace"
)

func NewServer(
	cfg *config.Config,
	authService *auth.Service,
	workplaceService *workplace.Service,
	scheduleService *schedule.Service,
	financeService *finance.Service,
	gcalService *gcal.Service,
	scheduleRepo schedule.Repository,
) http.Handler {
	r := chi.NewRouter()

	// Global middleware
	r.Use(chiMiddleware.RequestID)
	r.Use(chiMiddleware.RealIP)
	r.Use(chiMiddleware.Logger)
	r.Use(chiMiddleware.Recoverer)
	r.Use(chiMiddleware.Timeout(30 * time.Second))
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   cfg.CORS.AllowedOrigins,
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	// Handlers
	authHandler := handler.NewAuthHandler(authService)
	workplaceHandler := handler.NewWorkplaceHandler(workplaceService)
	scheduleHandler := handler.NewScheduleHandler(scheduleService)
	financeHandler := handler.NewFinanceHandler(financeService)
	gcalHandler := handler.NewGCalHandler(gcalService, scheduleRepo)

	// Auth middleware
	authMiddleware := middleware.NewAuthMiddleware(authService)

	// Routes
	r.Route("/api/v1", func(r chi.Router) {
		// Public routes
		r.Group(func(r chi.Router) {
			r.Post("/auth/register", authHandler.Register)
			r.Post("/auth/login", authHandler.Login)
			r.Post("/auth/refresh", authHandler.RefreshToken)
		})

		// Protected routes
		r.Group(func(r chi.Router) {
			r.Use(authMiddleware.Authenticate)

			// Auth
			r.Post("/auth/logout", authHandler.Logout)
			r.Get("/auth/me", authHandler.GetMe)

			// Workplaces
			r.Get("/workplaces", workplaceHandler.List)
			r.Post("/workplaces", workplaceHandler.Create)
			r.Get("/workplaces/{id}", workplaceHandler.Get)
			r.Put("/workplaces/{id}", workplaceHandler.Update)
			r.Delete("/workplaces/{id}", workplaceHandler.Archive)
			r.Get("/workplaces/{id}/pricing-rules", workplaceHandler.ListPricingRules)
			r.Post("/workplaces/{id}/pricing-rules", workplaceHandler.CreatePricingRule)
			r.Put("/workplaces/{id}/pricing-rules/{ruleId}", workplaceHandler.UpdatePricingRule)
			r.Delete("/workplaces/{id}/pricing-rules/{ruleId}", workplaceHandler.DeletePricingRule)
			r.Post("/workplaces/{id}/pricing-rules/reorder", workplaceHandler.ReorderPricingRules)

			// Shifts
			r.Get("/shifts", scheduleHandler.List)
			r.Post("/shifts", scheduleHandler.Create)
			r.Get("/shifts/{id}", scheduleHandler.Get)
			r.Put("/shifts/{id}", scheduleHandler.Update)
			r.Delete("/shifts/{id}", scheduleHandler.Delete)
			r.Post("/shifts/bulk", scheduleHandler.BulkCreate)
			r.Get("/shifts/{id}/earnings", scheduleHandler.GetEarnings)

			// Finance
			r.Get("/finance/summary", financeHandler.GetSummary)
			r.Get("/finance/summary/monthly/{year}/{month}", financeHandler.GetMonthlySummary)
			r.Get("/finance/summary/yearly/{year}", financeHandler.GetYearlySummary)
			r.Get("/finance/monthly-breakdown/{year}", financeHandler.GetMonthlyBreakdown)
			r.Get("/finance/projections", financeHandler.GetProjections)
			r.Get("/finance/tax-estimate/{year}", financeHandler.GetTaxEstimate)

			// Invoices
			r.Get("/invoices", financeHandler.ListInvoices)
			r.Post("/invoices", financeHandler.CreateInvoice)
			r.Get("/invoices/{id}", financeHandler.GetInvoice)
			r.Delete("/invoices/{id}", financeHandler.DeleteInvoice)

			// Google Calendar
			r.Get("/gcal/auth-url", gcalHandler.GetAuthURL)
			r.Post("/gcal/callback", gcalHandler.HandleCallback)
			r.Get("/gcal/status", gcalHandler.GetStatus)
			r.Post("/gcal/sync", gcalHandler.TriggerSync)
			r.Delete("/gcal/disconnect", gcalHandler.Disconnect)
		})

		// Health check
		r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(`{"status":"ok"}`))
		})
	})

	return r
}
