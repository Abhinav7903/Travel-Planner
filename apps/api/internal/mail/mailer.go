package mail

import (
	"context"
	"encoding/base64"
	"mime"
	"net/mail"
	"strings"
	"time"
)

type Mailer interface {
	SendOTP(ctx context.Context, to, code string, expires time.Time) error
	SendInvitation(ctx context.Context, to, inviter, tripTitle, role, link string, expires time.Time) error
}

type DevMailer struct{}

func (DevMailer) SendOTP(context.Context, string, string, time.Time) error { return nil }
func (DevMailer) SendInvitation(context.Context, string, string, string, string, string, time.Time) error {
	return nil
}

func buildMessage(from, to mail.Address, subject, textBody, htmlBody string) string {
	var b strings.Builder
	b.WriteString("From: " + from.String() + "\r\n")
	b.WriteString("To: " + to.String() + "\r\n")
	b.WriteString("Subject: " + mime.QEncoding.Encode("utf-8", subject) + "\r\n")
	b.WriteString("MIME-Version: 1.0\r\n")
	b.WriteString("Date: " + time.Now().UTC().Format(time.RFC1123Z) + "\r\n")
	b.WriteString("Content-Type: multipart/alternative; boundary=\"wayfarer-boundary\"\r\n\r\n")
	b.WriteString("--wayfarer-boundary\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n")
	writeBase64(&b, textBody)
	b.WriteString("--wayfarer-boundary\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n")
	writeBase64(&b, htmlBody)
	b.WriteString("--wayfarer-boundary--\r\n")
	return b.String()
}

func writeBase64(b *strings.Builder, body string) {
	encoded := base64.StdEncoding.EncodeToString([]byte(body))
	for len(encoded) > 76 {
		b.WriteString(encoded[:76] + "\r\n")
		encoded = encoded[76:]
	}
	b.WriteString(encoded + "\r\n")
}
