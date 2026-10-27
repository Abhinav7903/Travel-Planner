# syntax=docker/dockerfile:1.7
# Build from the repository root:
#   docker build -f apps/api/Dockerfile -t wayfarer-api .
FROM golang:1.24-alpine AS build
WORKDIR /src/apps/api
RUN apk add --no-cache ca-certificates tzdata
COPY apps/api/go.mod apps/api/go.sum ./
RUN go mod download
COPY apps/api ./
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/server ./cmd/server \
 && CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/migrate ./cmd/migrate \
 && CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/seed ./cmd/seed

FROM alpine:3.21 AS runtime
RUN apk add --no-cache ca-certificates tzdata \
 && addgroup -S wayfarer && adduser -S -G wayfarer -H -h /app wayfarer
WORKDIR /app
COPY --from=build /out/server /app/server
COPY --from=build /out/migrate /app/migrate
COPY --from=build /out/seed /app/seed
COPY db/migrations /app/migrations
ENV APP_ENV=production \
    PORT=8080 \
    MIGRATIONS_DIR=/app/migrations
USER wayfarer
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/healthz" >/dev/null || exit 1
ENTRYPOINT ["/app/server"]
