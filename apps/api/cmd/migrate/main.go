package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"

	"wayfarer/api/internal/config"
)

func main() {
	_ = config.LoadEnvFile(".env")
	dir := flag.String("dir", envOr("MIGRATIONS_DIR", "../../db/migrations"), "directory containing versioned .sql migrations")
	flag.Parse()

	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		log.Fatal("DATABASE_URL is required")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	conn, err := pgx.Connect(ctx, dsn)
	if err != nil {
		log.Fatalf("connect: %v", err)
	}
	defer conn.Close(ctx)

	if _, err := conn.Exec(ctx, `SELECT pg_advisory_lock(918273645)`); err != nil {
		log.Fatalf("lock: %v", err)
	}
	defer conn.Exec(context.Background(), `SELECT pg_advisory_unlock(918273645)`) //nolint:errcheck

	if _, err := conn.Exec(ctx, `CREATE TABLE IF NOT EXISTS schema_migrations (
		version text PRIMARY KEY,
		applied_at timestamptz NOT NULL DEFAULT now()
	)`); err != nil {
		log.Fatalf("create schema_migrations: %v", err)
	}

	files, err := filepath.Glob(filepath.Join(*dir, "*.sql"))
	if err != nil {
		log.Fatalf("list migrations: %v", err)
	}
	sort.Strings(files)
	applied := 0
	for _, file := range files {
		if strings.HasSuffix(file, ".down.sql") {
			continue
		}
		version := filepath.Base(file)
		var exists bool
		if err := conn.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE version=$1)`, version).Scan(&exists); err != nil {
			log.Fatalf("check %s: %v", version, err)
		}
		if exists {
			continue
		}
		sqlBytes, err := os.ReadFile(file)
		if err != nil {
			log.Fatalf("read %s: %v", version, err)
		}
		tx, err := conn.Begin(ctx)
		if err != nil {
			log.Fatalf("begin %s: %v", version, err)
		}
		if _, err := tx.Exec(ctx, string(sqlBytes)); err != nil {
			_ = tx.Rollback(ctx)
			log.Fatalf("apply %s: %v", version, err)
		}
		if _, err := tx.Exec(ctx, `INSERT INTO schema_migrations (version) VALUES ($1)`, version); err != nil {
			_ = tx.Rollback(ctx)
			log.Fatalf("record %s: %v", version, err)
		}
		if err := tx.Commit(ctx); err != nil {
			log.Fatalf("commit %s: %v", version, err)
		}
		fmt.Printf("applied %s\n", version)
		applied++
	}
	fmt.Printf("%d migration(s) applied; database is up to date\n", applied)
}

func envOr(key, fallback string) string {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		return v
	}
	return fallback
}
