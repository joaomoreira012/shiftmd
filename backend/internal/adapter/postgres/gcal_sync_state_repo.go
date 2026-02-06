package postgres

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/joao-moreira/doctor-tracker/internal/adapter/gcal"
)

type GCalSyncStateRepository struct {
	db *DB
}

func NewGCalSyncStateRepository(db *DB) *GCalSyncStateRepository {
	return &GCalSyncStateRepository{db: db}
}

func (r *GCalSyncStateRepository) GetByUserID(ctx context.Context, userID uuid.UUID) (*gcal.SyncState, error) {
	state := &gcal.SyncState{}
	err := r.db.Pool.QueryRow(ctx, `
		SELECT id, user_id, sync_token, page_token, channel_id, resource_id,
		       channel_expiry, last_full_sync, last_incremental_sync
		FROM gcal_sync_state WHERE user_id = $1
	`, userID).Scan(
		&state.ID, &state.UserID, &state.SyncToken, &state.PageToken,
		&state.ChannelID, &state.ResourceID, &state.ChannelExpiry,
		&state.LastFullSync, &state.LastIncrementalSync,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return state, err
}

func (r *GCalSyncStateRepository) Upsert(ctx context.Context, state *gcal.SyncState) error {
	now := time.Now()
	_, err := r.db.Pool.Exec(ctx, `
		INSERT INTO gcal_sync_state (id, user_id, sync_token, page_token, channel_id, resource_id,
			channel_expiry, last_full_sync, last_incremental_sync, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)
		ON CONFLICT (user_id) DO UPDATE SET
			sync_token = EXCLUDED.sync_token,
			page_token = EXCLUDED.page_token,
			channel_id = EXCLUDED.channel_id,
			resource_id = EXCLUDED.resource_id,
			channel_expiry = EXCLUDED.channel_expiry,
			last_full_sync = EXCLUDED.last_full_sync,
			last_incremental_sync = EXCLUDED.last_incremental_sync,
			updated_at = EXCLUDED.updated_at
	`, state.ID, state.UserID, state.SyncToken, state.PageToken,
		state.ChannelID, state.ResourceID, state.ChannelExpiry,
		state.LastFullSync, state.LastIncrementalSync, now)
	return err
}

func (r *GCalSyncStateRepository) Delete(ctx context.Context, userID uuid.UUID) error {
	_, err := r.db.Pool.Exec(ctx, `DELETE FROM gcal_sync_state WHERE user_id = $1`, userID)
	return err
}
