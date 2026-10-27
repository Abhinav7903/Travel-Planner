-- Authentication audit trail for login analytics and security review.
-- Never stores OTP codes, session tokens, or invitation tokens.

CREATE TABLE auth_audit_events (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event      text NOT NULL CHECK (event IN (
    'otp_requested',
    'otp_request_failed',
    'otp_verify_failed',
    'login_succeeded',
    'logout'
  )),
  outcome    text NOT NULL CHECK (outcome IN ('success', 'failure')),
  email      citext,
  user_id    uuid REFERENCES users(id) ON DELETE SET NULL,
  ip         inet,
  user_agent text NOT NULL DEFAULT '' CHECK (length(user_agent) <= 500),
  reason     text NOT NULL DEFAULT '' CHECK (length(reason) <= 80),
  request_id text NOT NULL DEFAULT '' CHECK (length(request_id) <= 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (event <> 'login_succeeded' OR user_id IS NOT NULL)
);
CREATE INDEX auth_audit_events_created_idx ON auth_audit_events (created_at DESC);
CREATE INDEX auth_audit_events_event_created_idx ON auth_audit_events (event, created_at DESC);
CREATE INDEX auth_audit_events_email_created_idx ON auth_audit_events (email, created_at DESC);
CREATE INDEX auth_audit_events_ip_created_idx ON auth_audit_events (ip, created_at DESC);
CREATE INDEX auth_audit_events_user_created_idx ON auth_audit_events (user_id, created_at DESC);

CREATE VIEW auth_audit_daily AS
SELECT
  date_trunc('day', created_at) AS day,
  event,
  outcome,
  count(*) AS events,
  count(DISTINCT email) AS unique_emails,
  count(DISTINCT ip) AS unique_ips
FROM auth_audit_events
GROUP BY 1, 2, 3;
