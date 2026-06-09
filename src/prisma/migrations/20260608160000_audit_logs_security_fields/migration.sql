-- Extend audit_logs for security/compliance query fields.

ALTER TABLE "audit_logs"
  ADD COLUMN IF NOT EXISTS "event_type" VARCHAR(128),
  ADD COLUMN IF NOT EXISTS "severity" VARCHAR(32),
  ADD COLUMN IF NOT EXISTS "correlation_id" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "metadata" JSONB;

CREATE INDEX IF NOT EXISTS "audit_logs_event_type_created_at_idx"
  ON "audit_logs" ("event_type", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "audit_logs_correlation_id_idx"
  ON "audit_logs" ("correlation_id")
  WHERE "correlation_id" IS NOT NULL;
