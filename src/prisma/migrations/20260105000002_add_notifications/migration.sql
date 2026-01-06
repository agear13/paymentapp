-- Add notifications system (idempotent)
-- Safe to run even if tables already exist

-- Create NotificationType enum if not exists
DO $$ BEGIN
  CREATE TYPE "NotificationType" AS ENUM (
    'PAYMENT_CONFIRMED',
    'PAYMENT_FAILED',
    'PAYMENT_EXPIRED',
    'XERO_SYNC_FAILED',
    'RECONCILIATION_ISSUE',
    'SECURITY_ALERT',
    'WEEKLY_SUMMARY',
    'SYSTEM_ALERT'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create EmailStatus enum if not exists
DO $$ BEGIN
  CREATE TYPE "EmailStatus" AS ENUM (
    'PENDING',
    'SENT',
    'DELIVERED',
    'OPENED',
    'CLICKED',
    'BOUNCED',
    'FAILED'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add notifications table for in-app and email notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_email VARCHAR(255),
  type "NotificationType" NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  data JSONB,
  read BOOLEAN NOT NULL DEFAULT false,
  email_sent BOOLEAN NOT NULL DEFAULT false,
  email_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS notifications_organization_id_created_at_idx ON notifications(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_user_email_created_at_idx ON notifications(user_email, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_read_idx ON notifications(read);
CREATE INDEX IF NOT EXISTS notifications_type_idx ON notifications(type);

-- Add email_logs table for tracking email delivery
CREATE TABLE IF NOT EXISTS email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID REFERENCES notifications(id) ON DELETE SET NULL,
  to_email VARCHAR(255) NOT NULL,
  from_email VARCHAR(255) NOT NULL,
  subject VARCHAR(500) NOT NULL,
  template_name VARCHAR(100) NOT NULL,
  template_data JSONB,
  status "EmailStatus" NOT NULL DEFAULT 'PENDING',
  provider_id VARCHAR(255),
  provider_response JSONB,
  error_message TEXT,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  bounced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS email_logs_status_created_at_idx ON email_logs(status, created_at DESC);
CREATE INDEX IF NOT EXISTS email_logs_to_email_idx ON email_logs(to_email);
CREATE INDEX IF NOT EXISTS email_logs_notification_id_idx ON email_logs(notification_id);

-- Add notification_preferences table
CREATE TABLE IF NOT EXISTS notification_preferences (
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
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add unique constraint only if it doesn't exist
DO $$ BEGIN
  ALTER TABLE notification_preferences ADD CONSTRAINT notification_preferences_organization_id_user_email_key UNIQUE(organization_id, user_email);
EXCEPTION
  WHEN duplicate_object THEN null;
  WHEN duplicate_table THEN null;
END $$;

CREATE INDEX IF NOT EXISTS notification_preferences_organization_id_user_email_idx ON notification_preferences(organization_id, user_email);
