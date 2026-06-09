-- Agreement Analyzer marketing attribution (Ticket 10D.1)

ALTER TABLE "obligation_report_leads"
  ADD COLUMN IF NOT EXISTS "utm_source" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "utm_medium" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "utm_campaign" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "utm_content" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "utm_term" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "referrer" TEXT,
  ADD COLUMN IF NOT EXISTS "landing_page" TEXT,
  ADD COLUMN IF NOT EXISTS "first_touch_at" TIMESTAMPTZ(6);

CREATE INDEX IF NOT EXISTS "obligation_report_leads_utm_source_idx"
  ON "obligation_report_leads" ("utm_source");

CREATE INDEX IF NOT EXISTS "obligation_report_leads_utm_campaign_idx"
  ON "obligation_report_leads" ("utm_campaign");
