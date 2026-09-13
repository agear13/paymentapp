-- Lifecycle email send state table for idempotency, suppression, and delivery tracking.
CREATE TABLE IF NOT EXISTS "lifecycle_email_sends" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" VARCHAR(255) NOT NULL,
    "organization_id" UUID,
    "email" VARCHAR(255) NOT NULL,
    "campaign_key" VARCHAR(64) NOT NULL,
    "status" VARCHAR(32) NOT NULL,
    "sent_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "provider_message_id" VARCHAR(255),
    "error_message" TEXT,
    "metadata" JSONB,

    CONSTRAINT "lifecycle_email_sends_pkey" PRIMARY KEY ("id")
);

-- Foreign key to organizations
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'lifecycle_email_sends_organization_id_fkey'
    ) THEN
        ALTER TABLE "lifecycle_email_sends"
        ADD CONSTRAINT "lifecycle_email_sends_organization_id_fkey"
        FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- Idempotency and search indexes
CREATE UNIQUE INDEX IF NOT EXISTS "lifecycle_email_sends_user_id_campaign_key_key" ON "lifecycle_email_sends"("user_id", "campaign_key");
CREATE INDEX IF NOT EXISTS "lifecycle_email_sends_email_campaign_key_idx" ON "lifecycle_email_sends"("email", "campaign_key");
CREATE INDEX IF NOT EXISTS "lifecycle_email_sends_organization_id_idx" ON "lifecycle_email_sends"("organization_id");
CREATE INDEX IF NOT EXISTS "lifecycle_email_sends_status_created_at_idx" ON "lifecycle_email_sends"("status", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "lifecycle_email_sends_campaign_key_status_idx" ON "lifecycle_email_sends"("campaign_key", "status");
