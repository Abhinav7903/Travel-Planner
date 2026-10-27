package mail

import (
	"context"
	"crypto/tls"
	"errors"
	"fmt"
	"html"
	"math"
	"net"
	"net/mail"
	"net/smtp"
	"strconv"
	"strings"
	"time"
	"unicode"
)

type SMTPConfig struct {
	Host     string
	Port     int
	Username string
	Password string
	From     string
	Timeout  time.Duration
}

type SMTPMailer struct {
	host     string
	addr     string
	username string
	password string
	from     mail.Address
	timeout  time.Duration
}

func NewSMTP(cfg SMTPConfig) (*SMTPMailer, error) {
	host := strings.TrimSpace(cfg.Host)
	username := strings.TrimSpace(cfg.Username)
	password := normalizeAppPassword(cfg.Password)
	if host == "" || strings.ContainsAny(host, "\r\n \t") {
		return nil, errors.New("SMTP_HOST is required and must not contain whitespace")
	}
	if cfg.Port < 1 || cfg.Port > 65535 {
		return nil, errors.New("SMTP_PORT must be between 1 and 65535")
	}
	if username == "" || strings.ContainsAny(username, "\r\n") {
		return nil, errors.New("SMTP_USERNAME is required")
	}
	if password == "" {
		return nil, errors.New("SMTP_PASSWORD is required")
	}
	if strings.TrimSpace(cfg.From) == "" {
		return nil, errors.New("MAIL_FROM is required")
	}
	from, err := mail.ParseAddress(cfg.From)
	if err != nil {
		return nil, fmt.Errorf("invalid MAIL_FROM: %w", err)
	}
	timeout := cfg.Timeout
	if timeout <= 0 {
		timeout = 20 * time.Second
	}
	return &SMTPMailer{
		host: host, addr: net.JoinHostPort(host, strconv.Itoa(cfg.Port)),
		username: username, password: password, from: *from, timeout: timeout,
	}, nil
}

func (m *SMTPMailer) SendOTP(ctx context.Context, to, code string, expires time.Time) error {
	recipient, err := mail.ParseAddress(to)
	if err != nil {
		return errors.New("invalid recipient")
	}
	subject := "Your Wayfarer sign-in code"
	validFor := relativeMinutes(expires)
	textBody := fmt.Sprintf("Your Wayfarer code is %s.\n\nIt expires in %d minutes and can be used once. If you did not request it, ignore this email.\n", code, validFor)
	htmlBody := fmt.Sprintf(`<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f7f5f0;padding:32px;color:#231f1a">
  <div style="max-width:480px;margin:0 auto;background:#fffdf8;border:1px solid #e6e1d7;border-radius:16px;padding:32px">
    <p style="margin:0 0 8px;font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:#2f6f5e">Wayfarer</p>
    <h1 style="margin:0 0 12px;font-size:24px;font-weight:600">Your sign-in code</h1>
    <p style="margin:0 0 20px;color:#6b655c">Use this one-time code to continue planning.</p>
    <div style="font-size:34px;letter-spacing:.28em;font-weight:600;padding:18px;background:#f2efe8;border-radius:12px;text-align:center">%s</div>
    <p style="margin:20px 0 0;font-size:13px;color:#80796e">Expires in %d minutes. If you did not request this, you can safely ignore it.</p>
  </div>
</div>`, code, validFor)
	return m.send(ctx, *recipient, subject, textBody, htmlBody)
}

func (m *SMTPMailer) SendInvitation(ctx context.Context, to, inviter, tripTitle, role, link string, expires time.Time) error {
	recipient, err := mail.ParseAddress(to)
	if err != nil {
		return errors.New("invalid recipient")
	}
	subject := fmt.Sprintf("%s invited you to %s", inviter, tripTitle)
	validFor := relativeDays(expires)
	textBody := fmt.Sprintf("%s invited you to collaborate on %q as %s.\n\nAccept: %s\n\nThis invitation expires in %d days. Sign in with this email address to accept.\n", inviter, tripTitle, role, link, validFor)
	htmlBody := fmt.Sprintf(`<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f7f5f0;padding:32px;color:#231f1a">
  <div style="max-width:520px;margin:0 auto;background:#fffdf8;border:1px solid #e6e1d7;border-radius:16px;padding:32px">
    <p style="margin:0 0 8px;font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:#2f6f5e">Wayfarer</p>
    <h1 style="margin:0 0 12px;font-size:24px;font-weight:600">%s</h1>
    <p style="margin:0 0 8px;color:#6b655c">%s invited you as <strong>%s</strong>.</p>
    <a href="%s" style="display:inline-block;margin-top:16px;background:#2f6f5e;color:#fff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:600">Review invitation</a>
    <p style="margin:20px 0 0;font-size:13px;color:#80796e">Expires in %d days. Sign in with this email address to accept.</p>
  </div>
</div>`,
		html.EscapeString(tripTitle), html.EscapeString(inviter), html.EscapeString(role), html.EscapeString(link), validFor)
	return m.send(ctx, *recipient, subject, textBody, htmlBody)
}

func (m *SMTPMailer) send(ctx context.Context, to mail.Address, subject, textBody, htmlBody string) error {
	deadline := time.Now().Add(m.timeout)
	if d, ok := ctx.Deadline(); ok && d.Before(deadline) {
		deadline = d
	}
	dialer := net.Dialer{Timeout: m.timeout, Deadline: deadline}
	conn, err := dialer.DialContext(ctx, "tcp", m.addr)
	if err != nil {
		return fmt.Errorf("smtp connect: %w", err)
	}
	defer conn.Close()
	_ = conn.SetDeadline(deadline)

	client, err := smtp.NewClient(conn, m.host)
	if err != nil {
		return fmt.Errorf("smtp handshake: %w", err)
	}
	defer client.Close()
	if ok, _ := client.Extension("STARTTLS"); !ok {
		return errors.New("smtp server does not support STARTTLS")
	}
	if err := client.StartTLS(&tls.Config{ServerName: m.host, MinVersion: tls.VersionTLS12}); err != nil {
		return fmt.Errorf("smtp starttls: %w", err)
	}
	if err := client.Auth(smtp.PlainAuth("", m.username, m.password, m.host)); err != nil {
		return fmt.Errorf("smtp authentication failed: %w", err)
	}
	if err := client.Mail(m.from.Address); err != nil {
		return fmt.Errorf("smtp sender: %w", err)
	}
	if err := client.Rcpt(to.Address); err != nil {
		return fmt.Errorf("smtp recipient: %w", err)
	}
	writer, err := client.Data()
	if err != nil {
		return fmt.Errorf("smtp data: %w", err)
	}
	if _, err := writer.Write([]byte(buildMessage(m.from, to, subject, textBody, htmlBody))); err != nil {
		_ = writer.Close()
		return fmt.Errorf("smtp write: %w", err)
	}
	if err := writer.Close(); err != nil {
		return fmt.Errorf("smtp finish: %w", err)
	}
	if err := client.Quit(); err != nil {
		return fmt.Errorf("smtp quit: %w", err)
	}
	return nil
}

func relativeMinutes(expires time.Time) int {
	minutes := int(time.Until(expires).Round(time.Minute) / time.Minute)
	if minutes < 1 {
		return 1
	}
	return minutes
}

func relativeDays(expires time.Time) int {
	days := int(math.Ceil(time.Until(expires).Hours() / 24))
	if days < 1 {
		return 1
	}
	return days
}

func normalizeAppPassword(value string) string {
	return strings.Map(func(r rune) rune {
		if unicode.IsSpace(r) {
			return -1
		}
		return r
	}, strings.TrimSpace(value))
}
