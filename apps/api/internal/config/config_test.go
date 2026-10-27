package config

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestLoadConfigFileOverridesEnvironment(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://environment/database")
	t.Setenv("MAIL_MODE", "dev")

	dir := t.TempDir()
	raw := `{
		"app_env": "development",
		"database_url": "postgres://config/database",
		"db_max_conns": 7,
		"web_origins": ["http://localhost:3111"],
		"public_web_url": "http://localhost:3111/",
		"otp_hmac_secret": "config-otp-secret",
		"session_secret": "config-session-secret",
		"internal_api_token": "config-internal-token",
		"session_ttl_hours": 48,
		"mail_mode": "smtp",
		"smtp_host": "smtp.gmail.com",
		"smtp_port": 587,
		"smtp_username": "travel@example.com",
		"smtp_password": "app-password",
		"mail_from": "Wayfarer <travel@example.com>"
	}`
	if err := os.WriteFile(filepath.Join(dir, "config.json"), []byte(raw), 0o600); err != nil {
		t.Fatal(err)
	}
	t.Chdir(dir)

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}
	if cfg.DatabaseURL != "postgres://config/database" {
		t.Fatalf("DatabaseURL = %q", cfg.DatabaseURL)
	}
	if cfg.DBMaxConns != 7 {
		t.Fatalf("DBMaxConns = %d", cfg.DBMaxConns)
	}
	if cfg.MailMode != "smtp" || cfg.SMTPPassword != "app-password" || cfg.SMTPPort != 587 {
		t.Fatalf("mail config not loaded: %+v", cfg)
	}
	if cfg.SessionTTL != 48*time.Hour {
		t.Fatalf("SessionTTL = %v", cfg.SessionTTL)
	}
	if cfg.PublicWebURL != "http://localhost:3111" {
		t.Fatalf("PublicWebURL = %q", cfg.PublicWebURL)
	}
	if !cfg.AllowedOriginSet["http://localhost:3111"] {
		t.Fatalf("allowed origins = %#v", cfg.AllowedOriginSet)
	}
}

func TestLoadRejectsMalformedConfigFile(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "config.json"), []byte("{"), 0o600); err != nil {
		t.Fatal(err)
	}
	t.Chdir(dir)

	if _, err := Load(); err == nil {
		t.Fatal("Load() succeeded with malformed config.json")
	}
}
