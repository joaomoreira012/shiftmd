package postgres

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/joao-moreira/doctor-tracker/internal/domain/auth"
)

type AuthRepository struct {
	db *DB
}

func NewAuthRepository(db *DB) *AuthRepository {
	return &AuthRepository{db: db}
}

func (r *AuthRepository) CreateUser(ctx context.Context, user *auth.User) error {
	_, err := r.db.Pool.Exec(ctx, `
		INSERT INTO users (id, email, password_hash, full_name, nif, tax_regime, activity_code, irs_category, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
	`, user.ID, user.Email, user.PasswordHash, user.FullName, user.NIF,
		user.TaxRegime, user.ActivityCode, user.IRSCategory, user.CreatedAt, user.UpdatedAt)
	return err
}

func (r *AuthRepository) GetUserByID(ctx context.Context, id uuid.UUID) (*auth.User, error) {
	user := &auth.User{}
	err := r.db.Pool.QueryRow(ctx, `
		SELECT id, email, password_hash, full_name, nif, tax_regime, activity_code, irs_category,
		       gcal_access_token, gcal_refresh_token, gcal_token_expiry, gcal_calendar_id,
		       created_at, updated_at
		FROM users WHERE id = $1
	`, id).Scan(
		&user.ID, &user.Email, &user.PasswordHash, &user.FullName, &user.NIF,
		&user.TaxRegime, &user.ActivityCode, &user.IRSCategory,
		&user.GCalAccessToken, &user.GCalRefreshToken, &user.GCalTokenExpiry, &user.GCalCalendarID,
		&user.CreatedAt, &user.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, auth.ErrUserNotFound
	}
	return user, err
}

func (r *AuthRepository) GetUserByEmail(ctx context.Context, email string) (*auth.User, error) {
	user := &auth.User{}
	err := r.db.Pool.QueryRow(ctx, `
		SELECT id, email, password_hash, full_name, nif, tax_regime, activity_code, irs_category,
		       created_at, updated_at
		FROM users WHERE email = $1
	`, email).Scan(
		&user.ID, &user.Email, &user.PasswordHash, &user.FullName, &user.NIF,
		&user.TaxRegime, &user.ActivityCode, &user.IRSCategory,
		&user.CreatedAt, &user.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, auth.ErrUserNotFound
	}
	return user, err
}

func (r *AuthRepository) UpdateUser(ctx context.Context, user *auth.User) error {
	_, err := r.db.Pool.Exec(ctx, `
		UPDATE users SET
			full_name = $2, nif = $3, tax_regime = $4, activity_code = $5, irs_category = $6,
			gcal_access_token = $7, gcal_refresh_token = $8, gcal_token_expiry = $9, gcal_calendar_id = $10,
			updated_at = $11
		WHERE id = $1
	`, user.ID, user.FullName, user.NIF, user.TaxRegime, user.ActivityCode, user.IRSCategory,
		user.GCalAccessToken, user.GCalRefreshToken, user.GCalTokenExpiry, user.GCalCalendarID,
		time.Now())
	return err
}

func (r *AuthRepository) CreateRefreshToken(ctx context.Context, token *auth.RefreshToken) error {
	_, err := r.db.Pool.Exec(ctx, `
		INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, created_at, user_agent, ip_address)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`, token.ID, token.UserID, token.TokenHash, token.ExpiresAt, token.CreatedAt,
		token.UserAgent, token.IPAddress)
	return err
}

func (r *AuthRepository) GetRefreshTokenByHash(ctx context.Context, hash string) (*auth.RefreshToken, error) {
	token := &auth.RefreshToken{}
	err := r.db.Pool.QueryRow(ctx, `
		SELECT id, user_id, token_hash, expires_at, revoked_at, created_at
		FROM refresh_tokens WHERE token_hash = $1
	`, hash).Scan(
		&token.ID, &token.UserID, &token.TokenHash, &token.ExpiresAt, &token.RevokedAt, &token.CreatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, auth.ErrInvalidToken
	}
	return token, err
}

func (r *AuthRepository) RevokeRefreshToken(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.Pool.Exec(ctx, `
		UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1
	`, id)
	return err
}

func (r *AuthRepository) RevokeAllUserRefreshTokens(ctx context.Context, userID uuid.UUID) error {
	_, err := r.db.Pool.Exec(ctx, `
		UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL
	`, userID)
	return err
}
