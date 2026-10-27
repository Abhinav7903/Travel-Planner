package mail

import (
	"net/mail"
	"strings"
	"testing"
	"time"
)

func TestNewSMTPValidation(t *testing.T) {
	valid := SMTPConfig{Host: "smtp.gmail.com", Port: 587, Username: "sender@example.com", Password: "abcd efgh ijkl mnop", From: "Wayfarer <sender@example.com>"}
	mailer, err := NewSMTP(valid)
	if err != nil {
		t.Fatal(err)
	}
	if mailer.password != "abcdefghijklmnop" {
		t.Fatal("app password whitespace was not removed")
	}
	for name, mutate := range map[string]func(*SMTPConfig){
		"host":     func(c *SMTPConfig) { c.Host = "" },
		"port":     func(c *SMTPConfig) { c.Port = 0 },
		"username": func(c *SMTPConfig) { c.Username = "" },
		"password": func(c *SMTPConfig) { c.Password = "" },
		"from":     func(c *SMTPConfig) { c.From = "not an address" },
	} {
		t.Run(name, func(t *testing.T) {
			cfg := valid
			mutate(&cfg)
			if _, err := NewSMTP(cfg); err == nil {
				t.Fatal("expected validation error")
			}
		})
	}
}

func TestBuildMessage(t *testing.T) {
	from := mail.Address{Name: "Wayfarer", Address: "sender@example.com"}
	to := mail.Address{Name: "Traveller", Address: "recipient@example.com"}
	raw := buildMessage(from, to, "Sign in", "plain text", "<p>html</p>")
	for _, want := range []string{
		"From: \"Wayfarer\" <sender@example.com>",
		"To: \"Traveller\" <recipient@example.com>",
		"Subject: Sign in",
		"MIME-Version: 1.0",
		"multipart/alternative",
	} {
		if !strings.Contains(raw, want) {
			t.Fatalf("message missing %q", want)
		}
	}
	if strings.Contains(raw, "plain text\r\n\r\n<html") {
		t.Fatal("message was not encoded as multipart parts")
	}
}

func TestSMTPTimeoutDefault(t *testing.T) {
	mailer, err := NewSMTP(SMTPConfig{Host: "smtp.gmail.com", Port: 587, Username: "u", Password: "p", From: "a@example.com"})
	if err != nil {
		t.Fatal(err)
	}
	if mailer.timeout != 20*time.Second {
		t.Fatalf("timeout = %v", mailer.timeout)
	}
}

func TestRelativeExpiry(t *testing.T) {
	if got := relativeMinutes(time.Now().Add(9*time.Minute + 50*time.Second)); got != 10 {
		t.Fatalf("relativeMinutes = %d, want 10", got)
	}
	if got := relativeMinutes(time.Now().Add(-time.Minute)); got != 1 {
		t.Fatalf("relativeMinutes minimum = %d, want 1", got)
	}
	if got := relativeDays(time.Now().Add(7*24*time.Hour - time.Hour)); got != 7 {
		t.Fatalf("relativeDays = %d, want 7", got)
	}
	if got := relativeDays(time.Now().Add(-time.Hour)); got != 1 {
		t.Fatalf("relativeDays minimum = %d, want 1", got)
	}
}
