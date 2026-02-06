package gcal

import (
	"context"

	"github.com/google/uuid"
)

// SyncStateRepository manages Google Calendar sync state persistence.
type SyncStateRepository interface {
	GetByUserID(ctx context.Context, userID uuid.UUID) (*SyncState, error)
	Upsert(ctx context.Context, state *SyncState) error
	Delete(ctx context.Context, userID uuid.UUID) error
}
