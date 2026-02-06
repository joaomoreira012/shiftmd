package testutil

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/testcontainers/testcontainers-go"
	"github.com/testcontainers/testcontainers-go/wait"
)

func NewTestDB(ctx context.Context) (*pgxpool.Pool, func(), error) {
	req := testcontainers.ContainerRequest{
		Image:        "postgres:16-alpine",
		ExposedPorts: []string{"5432/tcp"},
		Env: map[string]string{
			"POSTGRES_DB":       "test_db",
			"POSTGRES_USER":     "test_user",
			"POSTGRES_PASSWORD": "test_pass",
		},
		WaitingFor: wait.ForListeningPort("5432/tcp").WithStartupTimeout(60 * time.Second),
	}

	container, err := testcontainers.GenericContainer(ctx, testcontainers.GenericContainerRequest{
		ContainerRequest: req,
		Started:          true,
	})
	if err != nil {
		return nil, nil, fmt.Errorf("starting container: %w", err)
	}

	host, _ := container.Host(ctx)
	port, _ := container.MappedPort(ctx, "5432")

	dsn := fmt.Sprintf("postgres://test_user:test_pass@%s:%s/test_db?sslmode=disable", host, port.Port())

	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		container.Terminate(ctx)
		return nil, nil, fmt.Errorf("connecting to db: %w", err)
	}

	// Run migrations
	migrationSQL, err := os.ReadFile("../../db/migrations/000001_initial_schema.up.sql")
	if err != nil {
		// Try alternative path
		migrationSQL, err = os.ReadFile("../../../db/migrations/000001_initial_schema.up.sql")
		if err != nil {
			pool.Close()
			container.Terminate(ctx)
			return nil, nil, fmt.Errorf("reading migration: %w", err)
		}
	}

	if _, err := pool.Exec(ctx, string(migrationSQL)); err != nil {
		pool.Close()
		container.Terminate(ctx)
		return nil, nil, fmt.Errorf("running migration: %w", err)
	}

	cleanup := func() {
		pool.Close()
		container.Terminate(ctx)
	}

	return pool, cleanup, nil
}
