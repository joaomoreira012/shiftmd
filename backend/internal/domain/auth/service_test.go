package auth

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/joao-moreira/doctor-tracker/internal/config"
)

// ---------------------------------------------------------------------------
// Mock repository
// ---------------------------------------------------------------------------

type mockAuthRepo struct {
	mu            sync.Mutex
	users         map[uuid.UUID]*User
	usersByEmail  map[string]*User
	refreshTokens map[string]*RefreshToken // keyed by token hash
}

func newMockAuthRepo() *mockAuthRepo {
	return &mockAuthRepo{
		users:         make(map[uuid.UUID]*User),
		usersByEmail:  make(map[string]*User),
		refreshTokens: make(map[string]*RefreshToken),
	}
}

func (m *mockAuthRepo) CreateUser(_ context.Context, user *User) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if _, exists := m.usersByEmail[user.Email]; exists {
		return errors.New("duplicate email")
	}
	m.users[user.ID] = user
	m.usersByEmail[user.Email] = user
	return nil
}

func (m *mockAuthRepo) GetUserByID(_ context.Context, id uuid.UUID) (*User, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	u, ok := m.users[id]
	if !ok {
		return nil, errors.New("user not found")
	}
	return u, nil
}

func (m *mockAuthRepo) GetUserByEmail(_ context.Context, email string) (*User, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	u, ok := m.usersByEmail[email]
	if !ok {
		return nil, errors.New("user not found")
	}
	return u, nil
}

func (m *mockAuthRepo) UpdateUser(_ context.Context, user *User) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.users[user.ID] = user
	m.usersByEmail[user.Email] = user
	return nil
}

func (m *mockAuthRepo) CreateRefreshToken(_ context.Context, token *RefreshToken) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.refreshTokens[token.TokenHash] = token
	return nil
}

func (m *mockAuthRepo) GetRefreshTokenByHash(_ context.Context, hash string) (*RefreshToken, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	rt, ok := m.refreshTokens[hash]
	if !ok {
		return nil, errors.New("refresh token not found")
	}
	return rt, nil
}

func (m *mockAuthRepo) RevokeRefreshToken(_ context.Context, id uuid.UUID) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, rt := range m.refreshTokens {
		if rt.ID == id {
			now := time.Now()
			rt.RevokedAt = &now
			return nil
		}
	}
	return errors.New("refresh token not found")
}

func (m *mockAuthRepo) RevokeAllUserRefreshTokens(_ context.Context, userID uuid.UUID) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	now := time.Now()
	for _, rt := range m.refreshTokens {
		if rt.UserID == userID {
			rt.RevokedAt = &now
		}
	}
	return nil
}

// ---------------------------------------------------------------------------
// Helper to build a test service
// ---------------------------------------------------------------------------

func testJWTConfig() config.JWTConfig {
	return config.JWTConfig{
		Secret:          "test-jwt-secret",
		AccessTokenTTL:  15 * time.Minute,
		RefreshTokenTTL: 7 * 24 * time.Hour,
	}
}

func newTestService() (*Service, *mockAuthRepo) {
	repo := newMockAuthRepo()
	svc := NewService(repo, testJWTConfig())
	return svc, repo
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

func TestRegister_Success(t *testing.T) {
	svc, _ := newTestService()
	ctx := context.Background()

	user, tokens, err := svc.Register(ctx, RegisterInput{
		Email:    "doc@example.com",
		Password: "secure123",
		FullName: "Dr. Test",
	})
	if err != nil {
		t.Fatalf("Register returned unexpected error: %v", err)
	}
	if user == nil {
		t.Fatal("Register returned nil user")
	}
	if tokens == nil {
		t.Fatal("Register returned nil tokens")
	}
	if user.Email != "doc@example.com" {
		t.Errorf("expected email %q, got %q", "doc@example.com", user.Email)
	}
	if user.FullName != "Dr. Test" {
		t.Errorf("expected full name %q, got %q", "Dr. Test", user.FullName)
	}
	// Password hash must NOT be the plaintext password
	if user.PasswordHash == "secure123" {
		t.Error("password was stored as plaintext, expected a bcrypt hash")
	}
	if user.PasswordHash == "" {
		t.Error("password hash is empty")
	}
	if tokens.AccessToken == "" {
		t.Error("access token is empty")
	}
	if tokens.RefreshToken == "" {
		t.Error("refresh token is empty")
	}
	if tokens.ExpiresAt == 0 {
		t.Error("expires_at is zero")
	}
}

func TestRegister_DuplicateEmail(t *testing.T) {
	svc, _ := newTestService()
	ctx := context.Background()

	input := RegisterInput{
		Email:    "doc@example.com",
		Password: "secure123",
		FullName: "Dr. Test",
	}

	_, _, err := svc.Register(ctx, input)
	if err != nil {
		t.Fatalf("first Register failed: %v", err)
	}

	_, _, err = svc.Register(ctx, input)
	if !errors.Is(err, ErrUserAlreadyExists) {
		t.Fatalf("expected ErrUserAlreadyExists, got: %v", err)
	}
}

func TestLogin_ValidCredentials(t *testing.T) {
	svc, _ := newTestService()
	ctx := context.Background()

	_, _, err := svc.Register(ctx, RegisterInput{
		Email:    "doc@example.com",
		Password: "secure123",
		FullName: "Dr. Test",
	})
	if err != nil {
		t.Fatalf("Register failed: %v", err)
	}

	user, tokens, err := svc.Login(ctx, LoginInput{
		Email:    "doc@example.com",
		Password: "secure123",
	})
	if err != nil {
		t.Fatalf("Login returned unexpected error: %v", err)
	}
	if user == nil {
		t.Fatal("Login returned nil user")
	}
	if tokens == nil {
		t.Fatal("Login returned nil tokens")
	}
	if user.Email != "doc@example.com" {
		t.Errorf("expected email %q, got %q", "doc@example.com", user.Email)
	}
	if tokens.AccessToken == "" {
		t.Error("access token is empty")
	}
	if tokens.RefreshToken == "" {
		t.Error("refresh token is empty")
	}
}

func TestLogin_InvalidPassword(t *testing.T) {
	svc, _ := newTestService()
	ctx := context.Background()

	_, _, err := svc.Register(ctx, RegisterInput{
		Email:    "doc@example.com",
		Password: "secure123",
		FullName: "Dr. Test",
	})
	if err != nil {
		t.Fatalf("Register failed: %v", err)
	}

	_, _, err = svc.Login(ctx, LoginInput{
		Email:    "doc@example.com",
		Password: "wrongpassword",
	})
	if !errors.Is(err, ErrInvalidCredentials) {
		t.Fatalf("expected ErrInvalidCredentials, got: %v", err)
	}
}

func TestLogin_NonExistentEmail(t *testing.T) {
	svc, _ := newTestService()
	ctx := context.Background()

	_, _, err := svc.Login(ctx, LoginInput{
		Email:    "nobody@example.com",
		Password: "anything",
	})
	if !errors.Is(err, ErrInvalidCredentials) {
		t.Fatalf("expected ErrInvalidCredentials, got: %v", err)
	}
}

func TestValidateAccessToken_Valid(t *testing.T) {
	svc, _ := newTestService()
	ctx := context.Background()

	user, tokens, err := svc.Register(ctx, RegisterInput{
		Email:    "doc@example.com",
		Password: "secure123",
		FullName: "Dr. Test",
	})
	if err != nil {
		t.Fatalf("Register failed: %v", err)
	}

	userID, err := svc.ValidateAccessToken(tokens.AccessToken)
	if err != nil {
		t.Fatalf("ValidateAccessToken returned unexpected error: %v", err)
	}
	if userID != user.ID {
		t.Errorf("expected user ID %s, got %s", user.ID, userID)
	}
}

func TestValidateAccessToken_InvalidToken(t *testing.T) {
	svc, _ := newTestService()

	_, err := svc.ValidateAccessToken("not-a-valid-jwt")
	if err == nil {
		t.Fatal("expected error for invalid token, got nil")
	}
}

func TestValidateAccessToken_WrongSecret(t *testing.T) {
	svc, _ := newTestService()
	ctx := context.Background()

	_, tokens, err := svc.Register(ctx, RegisterInput{
		Email:    "doc@example.com",
		Password: "secure123",
		FullName: "Dr. Test",
	})
	if err != nil {
		t.Fatalf("Register failed: %v", err)
	}

	// Create a second service with a different secret
	otherCfg := testJWTConfig()
	otherCfg.Secret = "completely-different-secret"
	otherRepo := newMockAuthRepo()
	otherSvc := NewService(otherRepo, otherCfg)

	_, err = otherSvc.ValidateAccessToken(tokens.AccessToken)
	if err == nil {
		t.Fatal("expected error when validating token with wrong secret, got nil")
	}
}
