package postgres

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joao-moreira/doctor-tracker/internal/config"
)

// Custom enum types that need to be registered with pgx so it can
// encode/decode Go values for these PostgreSQL types.
var customTypes = []string{
	"day_of_week",
	"_day_of_week",
	"pay_model",
	"_pay_model",
	"shift_status",
	"_shift_status",
	"earning_status",
	"_earning_status",
}

type DB struct {
	Pool *pgxpool.Pool
}

func NewDB(ctx context.Context, cfg config.DatabaseConfig) (*DB, error) {
	poolConfig, err := pgxpool.ParseConfig(cfg.DSN())
	if err != nil {
		return nil, fmt.Errorf("parsing database config: %w", err)
	}

	poolConfig.MaxConns = 10
	poolConfig.AfterConnect = registerCustomTypes

	pool, err := pgxpool.NewWithConfig(ctx, poolConfig)
	if err != nil {
		return nil, fmt.Errorf("creating connection pool: %w", err)
	}

	if err := pool.Ping(ctx); err != nil {
		return nil, fmt.Errorf("pinging database: %w", err)
	}

	return &DB{Pool: pool}, nil
}

func (db *DB) Close() {
	db.Pool.Close()
}

func registerCustomTypes(ctx context.Context, conn *pgx.Conn) error {
	for _, typeName := range customTypes {
		dt, err := conn.LoadType(ctx, typeName)
		if err != nil {
			return fmt.Errorf("loading type %q: %w", typeName, err)
		}
		conn.TypeMap().RegisterType(dt)
	}
	return nil
}
