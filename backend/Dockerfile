# Stage 1: Build
FROM golang:1.24-alpine AS build

WORKDIR /src

# Download dependencies first (cacheable layer)
COPY go.mod go.sum ./
RUN go mod download

# Copy source and build
COPY . .
RUN CGO_ENABLED=0 go build -o /app ./cmd/server

# Stage 2: Runtime
FROM alpine:3.20

RUN apk add --no-cache ca-certificates tzdata

COPY --from=build /app /app
COPY --from=build /src/db/migrations /migrations

EXPOSE 8080

ENTRYPOINT ["/app"]
