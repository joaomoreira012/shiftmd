.PHONY: build run dev test lint migrate-up migrate-down migrate-create sqlc docker-up docker-down

# Variables
BINARY_NAME=doctor-tracker
DB_DSN=postgres://doctor_tracker:doctor_tracker@localhost:5432/doctor_tracker?sslmode=disable

# Build
build:
	go build -o bin/$(BINARY_NAME) ./cmd/server

run: build
	set -a && [ -f ../.env ] && . ../.env; set +a && DT_JWT_SECRET=dev-secret-change-me ./bin/$(BINARY_NAME)

dev:
	set -a && [ -f ../.env ] && . ../.env; set +a && DT_JWT_SECRET=dev-secret-change-me go run ./cmd/server

# Testing
test:
	go test ./... -v -race

test-coverage:
	go test ./... -coverprofile=coverage.out
	go tool cover -html=coverage.out

# Linting
lint:
	golangci-lint run ./...

# Database migrations
migrate-up:
	migrate -path db/migrations -database "$(DB_DSN)" up

migrate-down:
	migrate -path db/migrations -database "$(DB_DSN)" down 1

migrate-create:
	@read -p "Migration name: " name; \
	migrate create -ext sql -dir db/migrations -seq $$name

# sqlc
sqlc:
	sqlc generate

# Docker
docker-up:
	docker compose -f ../docker-compose.yml up -d

docker-down:
	docker compose -f ../docker-compose.yml down

# All-in-one
setup: docker-up
	@echo "Waiting for PostgreSQL..."
	@sleep 3
	$(MAKE) migrate-up
	@echo "Setup complete!"

# Clean
clean:
	rm -rf bin/
	rm -f coverage.out
