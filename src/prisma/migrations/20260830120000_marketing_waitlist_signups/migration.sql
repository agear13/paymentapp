-- Public campaign waitlist. Isolated from accounts and Agreement Analyzer leads.
-- No raw Referer: only a fixed landing_page attribution value is stored.

CREATE TABLE IF NOT EXISTS "marketing_waitlist_signups" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" VARCHAR(320) NOT NULL,
    "source" VARCHAR(64) NOT NULL,
    "landing_page" VARCHAR(255),
    "privacy_acknowledged_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketing_waitlist_signups_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "marketing_waitlist_signups_email_source_key"
  ON "marketing_waitlist_signups"("email", "source");

CREATE INDEX IF NOT EXISTS "marketing_waitlist_signups_source_idx"
  ON "marketing_waitlist_signups"("source");

CREATE INDEX IF NOT EXISTS "marketing_waitlist_signups_created_at_idx"
  ON "marketing_waitlist_signups"("created_at" DESC);
