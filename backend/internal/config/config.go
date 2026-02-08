package config

import (
	"fmt"
	"strings"
	"time"

	"github.com/knadh/koanf/parsers/yaml"
	"github.com/knadh/koanf/providers/env"
	"github.com/knadh/koanf/providers/file"
	"github.com/knadh/koanf/v2"
)

type Config struct {
	Server   ServerConfig   `koanf:"server"`
	Database DatabaseConfig `koanf:"database"`
	JWT      JWTConfig      `koanf:"jwt"`
	Google   GoogleConfig   `koanf:"google"`
	CORS     CORSConfig     `koanf:"cors"`
}

type ServerConfig struct {
	Port int    `koanf:"port"`
	Host string `koanf:"host"`
}

type DatabaseConfig struct {
	Host     string `koanf:"host"`
	Port     int    `koanf:"port"`
	User     string `koanf:"user"`
	Password string `koanf:"password"`
	DBName   string `koanf:"dbname"`
	SSLMode  string `koanf:"sslmode"`
}

func (d DatabaseConfig) DSN() string {
	return fmt.Sprintf(
		"postgres://%s:%s@%s:%d/%s?sslmode=%s",
		d.User, d.Password, d.Host, d.Port, d.DBName, d.SSLMode,
	)
}

type JWTConfig struct {
	Secret           string        `koanf:"secret"`
	AccessTokenTTL   time.Duration `koanf:"access_token_ttl"`
	RefreshTokenTTL  time.Duration `koanf:"refresh_token_ttl"`
}

type GoogleConfig struct {
	ClientID     string `koanf:"client_id"`
	ClientSecret string `koanf:"client_secret"`
	RedirectURL  string `koanf:"redirect_url"`
}

type CORSConfig struct {
	AllowedOrigins []string `koanf:"allowed_origins"`
}

func Load() (*Config, error) {
	k := koanf.New(".")

	// Load from config file if exists
	if err := k.Load(file.Provider("config.yaml"), yaml.Parser()); err != nil {
		// Config file is optional, continue with env/defaults
		_ = err
	}

	// Load from environment variables (prefix: DT_)
	// Use __ (double underscore) for nesting, single _ stays literal.
	// e.g., DT_SERVER__PORT=8080, DT_GOOGLE__CLIENT_ID=xxx
	if err := k.Load(env.Provider("DT_", ".", func(s string) string {
		s = strings.TrimPrefix(s, "DT_")
		s = strings.ToLower(s)
		s = strings.ReplaceAll(s, "__", ".")
		return s
	}), nil); err != nil {
		return nil, fmt.Errorf("loading env config: %w", err)
	}

	cfg := &Config{
		Server: ServerConfig{
			Port: 8080,
			Host: "0.0.0.0",
		},
		Database: DatabaseConfig{
			Host:    "localhost",
			Port:    5432,
			User:    "doctor_tracker",
			Password: "doctor_tracker",
			DBName:  "doctor_tracker",
			SSLMode: "disable",
		},
		JWT: JWTConfig{
			AccessTokenTTL:  15 * time.Minute,
			RefreshTokenTTL: 7 * 24 * time.Hour,
		},
		CORS: CORSConfig{
			AllowedOrigins: []string{"http://localhost:5173", "http://localhost:3000"},
		},
	}

	if err := k.Unmarshal("", cfg); err != nil {
		return nil, fmt.Errorf("unmarshalling config: %w", err)
	}

	if cfg.JWT.Secret == "" {
		return nil, fmt.Errorf("JWT secret is required (set DT_JWT_SECRET)")
	}

	return cfg, nil
}
