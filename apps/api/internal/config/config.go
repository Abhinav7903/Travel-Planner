package config

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	Env              string
	Port             string
	DatabaseURL      string
	DBMaxConns       int32
	WebOrigins       []string
	PublicWebURL     string
	OTPHMACSecret    []byte
	SessionSecret    []byte
	InternalAPIToken string
	SessionTTL       time.Duration
	OTPTTL           time.Duration
	OTPMaxAttempts   int
	OTPCooldown      time.Duration
	OTPEmailLimit    int
	OTPIPLimit       int
	InviteTTL        time.Duration
	MailMode         string
	SMTPHost         string
	SMTPPort         int
	SMTPUsername     string
	SMTPPassword     string
	MailFrom         string
	TrustProxyHeader bool
	AllowedOriginSet map[string]bool
}

type fileConfig struct {
	AppEnv             string   `json:"app_env"`
	Port               string   `json:"port"`
	DatabaseURL        string   `json:"database_url"`
	DBMaxConns         *int     `json:"db_max_conns"`
	WebOrigins         []string `json:"web_origins"`
	PublicWebURL       string   `json:"public_web_url"`
	OTPHMACSecret      string   `json:"otp_hmac_secret"`
	SessionSecret      string   `json:"session_secret"`
	InternalAPIToken   string   `json:"internal_api_token"`
	SessionTTLHours    *int     `json:"session_ttl_hours"`
	OTPTTLMinutes      *int     `json:"otp_ttl_minutes"`
	OTPMaxAttempts     *int     `json:"otp_max_attempts"`
	OTPCooldownSeconds *int     `json:"otp_cooldown_seconds"`
	OTPEmailLimit      *int     `json:"otp_email_limit"`
	OTPIPLimit         *int     `json:"otp_ip_limit"`
	InviteTTLHours     *int     `json:"invite_ttl_hours"`
	MailMode           string   `json:"mail_mode"`
	SMTPHost           string   `json:"smtp_host"`
	SMTPPort           *int     `json:"smtp_port"`
	SMTPUsername       string   `json:"smtp_username"`
	SMTPPassword       string   `json:"smtp_password"`
	MailFrom           string   `json:"mail_from"`
	TrustProxyHeader   *bool    `json:"trust_proxy_header"`
}

func Load() (Config, error) {
	cfg := Config{
		Env:              env("APP_ENV", "development"),
		Port:             env("PORT", "8080"),
		DatabaseURL:      os.Getenv("DATABASE_URL"),
		WebOrigins:       splitList(env("WEB_ORIGIN", "http://localhost:3000")),
		PublicWebURL:     strings.TrimRight(env("PUBLIC_WEB_URL", "http://localhost:3000"), "/"),
		OTPHMACSecret:    []byte(os.Getenv("OTP_HMAC_SECRET")),
		SessionSecret:    []byte(os.Getenv("SESSION_SECRET")),
		InternalAPIToken: os.Getenv("INTERNAL_API_TOKEN"),
		SessionTTL:       14 * 24 * time.Hour,
		OTPTTL:           10 * time.Minute,
		OTPMaxAttempts:   5,
		OTPCooldown:      60 * time.Second,
		OTPEmailLimit:    5,
		OTPIPLimit:       20,
		InviteTTL:        7 * 24 * time.Hour,
		MailMode:         env("MAIL_MODE", "dev"),
		SMTPHost:         os.Getenv("SMTP_HOST"),
		SMTPPort:         587,
		SMTPUsername:     os.Getenv("SMTP_USERNAME"),
		SMTPPassword:     os.Getenv("SMTP_PASSWORD"),
		MailFrom:         os.Getenv("MAIL_FROM"),
	}

	var err error
	if cfg.DBMaxConns, err = parseInt32(env("DB_MAX_CONNS", "10")); err != nil {
		return cfg, err
	}
	if value := strings.TrimSpace(os.Getenv("SMTP_PORT")); value != "" {
		cfg.SMTPPort, err = strconv.Atoi(value)
		if err != nil {
			return cfg, errors.New("SMTP_PORT must be a number")
		}
	}
	cfg.TrustProxyHeader = env("TRUST_PROXY_HEADER", "true") == "true"

	configPath := findConfigFile()
	if configPath != "" {
		raw, err := os.ReadFile(configPath)
		if err != nil {
			return cfg, fmt.Errorf("read %s: %w", configPath, err)
		}
		var file fileConfig
		if err := json.Unmarshal(raw, &file); err != nil {
			return cfg, fmt.Errorf("parse %s: %w", configPath, err)
		}
		applyFileConfig(&cfg, file)
	}

	if cfg.DBMaxConns < 1 || cfg.DBMaxConns > 100 {
		return cfg, errors.New("db_max_conns must be between 1 and 100")
	}
	if cfg.DatabaseURL == "" {
		return cfg, errors.New("DATABASE_URL is required")
	}
	if cfg.Env == "production" {
		if len(cfg.OTPHMACSecret) < 32 || len(cfg.SessionSecret) < 32 || len(cfg.InternalAPIToken) < 32 {
			return cfg, errors.New("OTP_HMAC_SECRET, SESSION_SECRET and INTERNAL_API_TOKEN must each be at least 32 characters in production")
		}
		if cfg.MailMode != "smtp" {
			return cfg, errors.New("MAIL_MODE must be smtp in production")
		}
		if cfg.SMTPHost == "" || cfg.SMTPUsername == "" || cfg.SMTPPassword == "" || cfg.MailFrom == "" {
			return cfg, errors.New("SMTP_HOST, SMTP_USERNAME, SMTP_PASSWORD and MAIL_FROM are required in production")
		}
		if !strings.HasPrefix(cfg.PublicWebURL, "https://") {
			return cfg, errors.New("PUBLIC_WEB_URL must use HTTPS in production")
		}
	} else {
		if len(cfg.OTPHMACSecret) == 0 {
			cfg.OTPHMACSecret = []byte("development-only-otp-hmac-secret-change-me")
		}
		if len(cfg.SessionSecret) == 0 {
			cfg.SessionSecret = []byte("development-only-session-secret-change-me")
		}
	}

	if cfg.MailMode != "smtp" && cfg.MailMode != "dev" {
		return cfg, errors.New("MAIL_MODE must be smtp or dev")
	}
	if cfg.SMTPPort < 1 || cfg.SMTPPort > 65535 {
		return cfg, errors.New("SMTP_PORT must be between 1 and 65535")
	}
	if cfg.MailMode == "smtp" {
		if cfg.SMTPHost == "" || cfg.SMTPUsername == "" || cfg.SMTPPassword == "" || cfg.MailFrom == "" {
			return cfg, errors.New("SMTP_HOST, SMTP_USERNAME, SMTP_PASSWORD and MAIL_FROM are required for smtp mode")
		}
	}

	cfg.AllowedOriginSet = map[string]bool{}
	for _, origin := range cfg.WebOrigins {
		u, err := url.Parse(origin)
		if err != nil || u.Scheme == "" || u.Host == "" {
			return cfg, fmt.Errorf("invalid web origin %q", origin)
		}
		cfg.AllowedOriginSet[strings.TrimRight(origin, "/")] = true
	}
	if len(cfg.AllowedOriginSet) == 0 {
		return cfg, errors.New("WEB_ORIGIN must contain at least one origin")
	}
	return cfg, nil
}

func findConfigFile() string {
	for _, path := range []string{"config.json", filepath.Join("apps", "api", "config.json")} {
		info, err := os.Stat(path)
		if err == nil && info.Mode().IsRegular() {
			return path
		}
	}
	return ""
}

func applyFileConfig(cfg *Config, file fileConfig) {
	if file.AppEnv != "" {
		cfg.Env = file.AppEnv
	}
	if file.Port != "" {
		cfg.Port = file.Port
	}
	if file.DatabaseURL != "" {
		cfg.DatabaseURL = file.DatabaseURL
	}
	if file.DBMaxConns != nil {
		cfg.DBMaxConns = int32(*file.DBMaxConns)
	}
	if len(file.WebOrigins) > 0 {
		cfg.WebOrigins = cleanList(file.WebOrigins)
	}
	if file.PublicWebURL != "" {
		cfg.PublicWebURL = strings.TrimRight(file.PublicWebURL, "/")
	}
	if file.OTPHMACSecret != "" {
		cfg.OTPHMACSecret = []byte(file.OTPHMACSecret)
	}
	if file.SessionSecret != "" {
		cfg.SessionSecret = []byte(file.SessionSecret)
	}
	if file.InternalAPIToken != "" {
		cfg.InternalAPIToken = file.InternalAPIToken
	}
	if file.SessionTTLHours != nil {
		cfg.SessionTTL = time.Duration(*file.SessionTTLHours) * time.Hour
	}
	if file.OTPTTLMinutes != nil {
		cfg.OTPTTL = time.Duration(*file.OTPTTLMinutes) * time.Minute
	}
	if file.OTPMaxAttempts != nil {
		cfg.OTPMaxAttempts = *file.OTPMaxAttempts
	}
	if file.OTPCooldownSeconds != nil {
		cfg.OTPCooldown = time.Duration(*file.OTPCooldownSeconds) * time.Second
	}
	if file.OTPEmailLimit != nil {
		cfg.OTPEmailLimit = *file.OTPEmailLimit
	}
	if file.OTPIPLimit != nil {
		cfg.OTPIPLimit = *file.OTPIPLimit
	}
	if file.InviteTTLHours != nil {
		cfg.InviteTTL = time.Duration(*file.InviteTTLHours) * time.Hour
	}
	if file.MailMode != "" {
		cfg.MailMode = file.MailMode
	}
	if file.SMTPHost != "" {
		cfg.SMTPHost = file.SMTPHost
	}
	if file.SMTPPort != nil {
		cfg.SMTPPort = *file.SMTPPort
	}
	if file.SMTPUsername != "" {
		cfg.SMTPUsername = file.SMTPUsername
	}
	if file.SMTPPassword != "" {
		cfg.SMTPPassword = file.SMTPPassword
	}
	if file.MailFrom != "" {
		cfg.MailFrom = file.MailFrom
	}
	if file.TrustProxyHeader != nil {
		cfg.TrustProxyHeader = *file.TrustProxyHeader
	}
}

func cleanList(values []string) []string {
	out := make([]string, 0, len(values))
	for _, value := range values {
		if value = strings.TrimSpace(value); value != "" {
			out = append(out, strings.TrimRight(value, "/"))
		}
	}
	return out
}

func (c Config) IsProduction() bool { return c.Env == "production" }

func (c Config) DevMailSink() bool { return c.MailMode == "dev" && !c.IsProduction() }

func env(key, fallback string) string {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		return v
	}
	return fallback
}

func splitList(v string) []string {
	parts := strings.Split(v, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if p = strings.TrimSpace(p); p != "" {
			out = append(out, strings.TrimRight(p, "/"))
		}
	}
	return out
}

func parseInt32(v string) (int32, error) {
	n, err := strconv.Atoi(v)
	if err != nil || n < 1 || n > 100 {
		return 0, errors.New("DB_MAX_CONNS must be between 1 and 100")
	}
	return int32(n), nil
}

// LoadEnvFile loads simple KEY=VALUE lines from a local .env file without
// overriding variables already present in the process environment. It is
// intended for development convenience; production uses platform secrets.
func LoadEnvFile(path string) error {
	b, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}
	for _, line := range strings.Split(string(b), "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		key, value, ok := strings.Cut(line, "=")
		if !ok {
			continue
		}
		key = strings.TrimSpace(key)
		value = strings.TrimSpace(value)
		if key == "" {
			continue
		}
		if len(value) >= 2 && ((value[0] == '"' && value[len(value)-1] == '"') || (value[0] == '\'' && value[len(value)-1] == '\'')) {
			value = value[1 : len(value)-1]
		}
		if _, exists := os.LookupEnv(key); !exists {
			_ = os.Setenv(key, value)
		}
	}
	return nil
}
