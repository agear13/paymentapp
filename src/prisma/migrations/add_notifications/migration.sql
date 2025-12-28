-- Add notifications table for in-app and email notifications
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_email VARCHAR(255),
  type VARCHAR(100) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  data JSONB,
  read BOOLEAN NOT NULL DEFAULT false,
  email_sent BOOLEAN NOT NULL DEFAULT false,
  email_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_organization ON notifications(organization_id, created_at DESC);
CREATE INDEX idx_notifications_user_email ON notifications(user_email, created_at DESC);
CREATE INDEX idx_notifications_read ON notifications(read);
CREATE INDEX idx_notifications_type ON notifications(type);

-- Add email_logs table for tracking email delivery
CREATE TABLE email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID REFERENCES notifications(id) ON DELETE SET NULL,
  to_email VARCHAR(255) NOT NULL,
  from_email VARCHAR(255) NOT NULL,
  subject VARCHAR(500) NOT NULL,
  template_name VARCHAR(100) NOT NULL,
  template_data JSONB,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  provider_id VARCHAR(255),
  provider_response JSONB,
  error_message TEXT,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  bounced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_email_logs_status ON email_logs(status, created_at DESC);
CREATE INDEX idx_email_logs_to_email ON email_logs(to_email);
CREATE INDEX idx_email_logs_notification ON email_logs(notification_id);

-- Add notification_preferences table
CREATE TABLE notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_email VARCHAR(255) NOT NULL,
  payment_confirmed_email BOOLEAN NOT NULL DEFAULT true,
  payment_failed_email BOOLEAN NOT NULL DEFAULT true,
  xero_sync_failed_email BOOLEAN NOT NULL DEFAULT true,
  reconciliation_issue_email BOOLEAN NOT NULL DEFAULT true,
  weekly_summary_email BOOLEAN NOT NULL DEFAULT true,
  security_alert_email BOOLEAN NOT NULL DEFAULT true,
  payment_confirmed_inapp BOOLEAN NOT NULL DEFAULT true,
  payment_failed_inapp BOOLEAN NOT NULL DEFAULT true,
  xero_sync_failed_inapp BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(organization_id, user_email)
);

CREATE INDEX idx_notification_preferences_org_user ON notification_preferences(organization_id, user_email);







