package auth

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/joao-moreira/doctor-tracker/internal/config"
	"golang.org/x/crypto/bcrypt"
)

var (
	ErrInvalidCredentials = errors.New("invalid credentials")
	ErrUserAlreadyExists  = errors.New("user with this email already exists")
	ErrInvalidToken       = errors.New("invalid or expired token")
	ErrUserNotFound       = errors.New("user not found")
)

type Service struct {
	repo   Repository
	jwtCfg config.JWTConfig
}

func NewService(repo Repository, jwtCfg config.JWTConfig) *Service {
	return &Service{repo: repo, jwtCfg: jwtCfg}
}

func (s *Service) Register(ctx context.Context, input RegisterInput) (*User, *TokenPair, error) {
	existing, _ := s.repo.GetUserByEmail(ctx, input.Email)
	if existing != nil {
		return nil, nil, ErrUserAlreadyExists
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, nil, err
	}

	user := &User{
		ID:           uuid.New(),
		Email:        input.Email,
		PasswordHash: string(hash),
		FullName:     input.FullName,
		TaxRegime:    "simplified",
		IRSCategory:  "B",
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}

	if err := s.repo.CreateUser(ctx, user); err != nil {
		return nil, nil, err
	}

	tokens, err := s.generateTokens(ctx, user)
	if err != nil {
		return nil, nil, err
	}

	return user, tokens, nil
}

func (s *Service) Login(ctx context.Context, input LoginInput) (*User, *TokenPair, error) {
	user, err := s.repo.GetUserByEmail(ctx, input.Email)
	if err != nil {
		return nil, nil, ErrInvalidCredentials
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(input.Password)); err != nil {
		return nil, nil, ErrInvalidCredentials
	}

	tokens, err := s.generateTokens(ctx, user)
	if err != nil {
		return nil, nil, err
	}

	return user, tokens, nil
}

func (s *Service) RefreshTokens(ctx context.Context, refreshTokenStr string) (*TokenPair, error) {
	hash := hashToken(refreshTokenStr)
	rt, err := s.repo.GetRefreshTokenByHash(ctx, hash)
	if err != nil {
		return nil, ErrInvalidToken
	}

	if rt.RevokedAt != nil || rt.ExpiresAt.Before(time.Now()) {
		return nil, ErrInvalidToken
	}

	// Revoke the old refresh token (rotation)
	if err := s.repo.RevokeRefreshToken(ctx, rt.ID); err != nil {
		return nil, err
	}

	user, err := s.repo.GetUserByID(ctx, rt.UserID)
	if err != nil {
		return nil, err
	}

	return s.generateTokens(ctx, user)
}

func (s *Service) Logout(ctx context.Context, refreshTokenStr string) error {
	hash := hashToken(refreshTokenStr)
	rt, err := s.repo.GetRefreshTokenByHash(ctx, hash)
	if err != nil {
		return nil // Silently ignore invalid tokens on logout
	}
	return s.repo.RevokeRefreshToken(ctx, rt.ID)
}

func (s *Service) GetUserByID(ctx context.Context, id uuid.UUID) (*User, error) {
	return s.repo.GetUserByID(ctx, id)
}

func (s *Service) ValidateAccessToken(tokenStr string) (uuid.UUID, error) {
	token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, ErrInvalidToken
		}
		return []byte(s.jwtCfg.Secret), nil
	})
	if err != nil {
		return uuid.Nil, ErrInvalidToken
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok || !token.Valid {
		return uuid.Nil, ErrInvalidToken
	}

	sub, err := claims.GetSubject()
	if err != nil {
		return uuid.Nil, ErrInvalidToken
	}

	return uuid.Parse(sub)
}

func (s *Service) generateTokens(ctx context.Context, user *User) (*TokenPair, error) {
	now := time.Now()
	accessExpiry := now.Add(s.jwtCfg.AccessTokenTTL)

	accessClaims := jwt.MapClaims{
		"sub":   user.ID.String(),
		"email": user.Email,
		"name":  user.FullName,
		"iat":   now.Unix(),
		"exp":   accessExpiry.Unix(),
	}

	accessToken := jwt.NewWithClaims(jwt.SigningMethodHS256, accessClaims)
	accessTokenStr, err := accessToken.SignedString([]byte(s.jwtCfg.Secret))
	if err != nil {
		return nil, err
	}

	// Generate refresh token (opaque random token)
	refreshTokenID := uuid.New()
	refreshTokenStr := refreshTokenID.String()
	refreshHash := hashToken(refreshTokenStr)

	rt := &RefreshToken{
		ID:        uuid.New(),
		UserID:    user.ID,
		TokenHash: refreshHash,
		ExpiresAt: now.Add(s.jwtCfg.RefreshTokenTTL),
		CreatedAt: now,
	}

	if err := s.repo.CreateRefreshToken(ctx, rt); err != nil {
		return nil, err
	}

	return &TokenPair{
		AccessToken:  accessTokenStr,
		RefreshToken: refreshTokenStr,
		ExpiresAt:    accessExpiry.Unix(),
	}, nil
}

func hashToken(token string) string {
	h := sha256.Sum256([]byte(token))
	return hex.EncodeToString(h[:])
}
