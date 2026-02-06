package main

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/joao-moreira/doctor-tracker/internal/adapter/gcal"
	httpAdapter "github.com/joao-moreira/doctor-tracker/internal/adapter/http"
	"github.com/joao-moreira/doctor-tracker/internal/adapter/postgres"
	"github.com/joao-moreira/doctor-tracker/internal/config"
	"github.com/joao-moreira/doctor-tracker/internal/domain/auth"
	"github.com/joao-moreira/doctor-tracker/internal/domain/finance"
	"github.com/joao-moreira/doctor-tracker/internal/domain/schedule"
	"github.com/joao-moreira/doctor-tracker/internal/domain/workplace"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	}))
	slog.SetDefault(logger)

	cfg, err := config.Load()
	if err != nil {
		slog.Error("failed to load config", "error", err)
		os.Exit(1)
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Database
	db, err := postgres.NewDB(ctx, cfg.Database)
	if err != nil {
		slog.Error("failed to connect to database", "error", err)
		os.Exit(1)
	}
	defer db.Close()

	// Repositories
	authRepo := postgres.NewAuthRepository(db)
	workplaceRepo := postgres.NewWorkplaceRepository(db)
	scheduleRepo := postgres.NewScheduleRepository(db)
	financeRepo := postgres.NewFinanceRepository(db)
	gcalSyncRepo := postgres.NewGCalSyncStateRepository(db)

	// Services
	authService := auth.NewService(authRepo, cfg.JWT)
	workplaceService := workplace.NewService(workplaceRepo)
	scheduleService := schedule.NewService(scheduleRepo, workplaceRepo)
	financeService := finance.NewService(financeRepo, workplaceRepo, scheduleRepo)
	gcalService := gcal.NewService(cfg.Google, authRepo, gcalSyncRepo)

	// HTTP Server
	router := httpAdapter.NewServer(cfg, authService, workplaceService, scheduleService, financeService, gcalService, scheduleRepo)

	srv := &http.Server{
		Addr:         fmt.Sprintf(":%d", cfg.Server.Port),
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Graceful shutdown
	go func() {
		sigCh := make(chan os.Signal, 1)
		signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
		<-sigCh

		slog.Info("shutting down server...")
		shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer shutdownCancel()

		if err := srv.Shutdown(shutdownCtx); err != nil {
			slog.Error("server shutdown error", "error", err)
		}
		cancel()
	}()

	slog.Info("starting server", "port", cfg.Server.Port)
	if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		slog.Error("server error", "error", err)
		os.Exit(1)
	}

	slog.Info("server stopped")
}
