package auth

import (
	"time"

	"github.com/google/uuid"
)

type User struct {
	ID           uuid.UUID `json:"id"`
	Email        string    `json:"email"`
	PasswordHash string    `json:"-"`
	FullName     string    `json:"full_name"`
	NIF          *string   `json:"nif,omitempty"`

	// Tax configuration
	TaxRegime    string `json:"tax_regime"`    // "simplified" or "organized"
	ActivityCode *string `json:"activity_code,omitempty"` // CAE/CIRS article 151
	IRSCategory  string `json:"irs_category"`  // Default "B" for independent

	// Google Calendar OAuth (stored encrypted, never returned in JSON)
	GCalAccessToken  *string    `json:"-"`
	GCalRefreshToken *string    `json:"-"`
	GCalTokenExpiry  *time.Time `json:"-"`
	GCalCalendarID   *string    `json:"gcal_calendar_id,omitempty"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type TokenPair struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresAt    int64  `json:"expires_at"`
}

type RefreshToken struct {
	ID        uuid.UUID  `json:"id"`
	UserID    uuid.UUID  `json:"user_id"`
	TokenHash string     `json:"-"`
	ExpiresAt time.Time  `json:"expires_at"`
	RevokedAt *time.Time `json:"revoked_at,omitempty"`
	CreatedAt time.Time  `json:"created_at"`
	UserAgent *string    `json:"user_agent,omitempty"`
	IPAddress *string    `json:"ip_address,omitempty"`
}

type RegisterInput struct {
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required,min=8"`
	FullName string `json:"full_name" validate:"required"`
}

type LoginInput struct {
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required"`
}
