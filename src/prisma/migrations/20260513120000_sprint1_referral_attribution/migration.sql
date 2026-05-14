-- Sprint 1: minimal attribution + services (launch MVP)

CREATE TYPE "ReferralCodeStatus" AS ENUM ('ACTIVE', 'INACTIVE');

CREATE TYPE "AttributionSource" AS ENUM (
  'REFERRAL_CHECKOUT',
  'REFERRAL_SERVICE_SELECTION',
  'OPERATOR_MANUAL',
  'API_CREATE_PAYMENT_LINK',
  'RECURRING_TEMPLATE'
);

ALTER TABLE "referral_links"
  ADD COLUMN IF NOT EXISTS "slug" VARCHAR(64),
  ADD COLUMN IF NOT EXISTS "expires_at" TIMESTAMPTZ(6);

CREATE UNIQUE INDEX IF NOT EXISTS "referral_links_slug_key" ON "referral_links" ("slug");

CREATE TABLE IF NOT EXISTS "organization_services" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "name" VARCHAR(255) NOT NULL,
  "description" TEXT NOT NULL,
  "price" DECIMAL(18,2) NOT NULL,
  "currency" CHAR(3) NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "organization_services_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "organization_services_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "organization_services_organization_id_active_idx"
  ON "organization_services" ("organization_id", "active");

CREATE TABLE IF NOT EXISTS "referral_codes" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "participant_user_id" VARCHAR(255),
  "referral_link_id" UUID NOT NULL,
  "code" VARCHAR(50) NOT NULL,
  "slug" VARCHAR(64),
  "status" "ReferralCodeStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMPTZ(6),
  CONSTRAINT "referral_codes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "referral_codes_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "referral_codes_referral_link_id_fkey"
    FOREIGN KEY ("referral_link_id") REFERENCES "referral_links"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "referral_codes_referral_link_id_key" ON "referral_codes" ("referral_link_id");
CREATE UNIQUE INDEX IF NOT EXISTS "referral_codes_code_key" ON "referral_codes" ("code");
CREATE UNIQUE INDEX IF NOT EXISTS "referral_codes_slug_key" ON "referral_codes" ("slug");
CREATE INDEX IF NOT EXISTS "referral_codes_organization_id_idx" ON "referral_codes" ("organization_id");
CREATE INDEX IF NOT EXISTS "referral_codes_participant_user_id_idx" ON "referral_codes" ("participant_user_id");
CREATE INDEX IF NOT EXISTS "referral_codes_code_idx" ON "referral_codes" ("code");

INSERT INTO "referral_codes" ("id", "organization_id", "participant_user_id", "referral_link_id", "code", "slug", "status", "created_at", "expires_at")
SELECT gen_random_uuid(),
       rl."organization_id",
       NULLIF(trim(rl."created_by_user_id"), ''),
       rl."id",
       rl."code",
       NULL,
       CASE WHEN rl."status" = 'ACTIVE' THEN 'ACTIVE'::"ReferralCodeStatus" ELSE 'INACTIVE'::"ReferralCodeStatus" END,
       rl."created_at",
       NULL
FROM "referral_links" rl
WHERE NOT EXISTS (SELECT 1 FROM "referral_codes" rc WHERE rc."referral_link_id" = rl."id");

ALTER TABLE "payment_links"
  ADD COLUMN IF NOT EXISTS "referral_code_id" UUID,
  ADD COLUMN IF NOT EXISTS "attribution_referral_code" VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "attributed_participant_user_id" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "attribution_source" "AttributionSource",
  ADD COLUMN IF NOT EXISTS "commission_attribution_snapshot" JSONB,
  ADD COLUMN IF NOT EXISTS "organization_service_id" UUID;

CREATE INDEX IF NOT EXISTS "payment_links_referral_code_id_idx" ON "payment_links" ("referral_code_id");
CREATE INDEX IF NOT EXISTS "payment_links_organization_service_id_idx" ON "payment_links" ("organization_service_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payment_links_referral_code_id_fkey'
  ) THEN
    ALTER TABLE "payment_links"
      ADD CONSTRAINT "payment_links_referral_code_id_fkey"
      FOREIGN KEY ("referral_code_id") REFERENCES "referral_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payment_links_organization_service_id_fkey'
  ) THEN
    ALTER TABLE "payment_links"
      ADD CONSTRAINT "payment_links_organization_service_id_fkey"
      FOREIGN KEY ("organization_service_id") REFERENCES "organization_services"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

UPDATE "payment_links" pl
SET "referral_code_id" = rc."id",
    "attribution_referral_code" = COALESCE(pl."attribution_referral_code", rc."code"),
    "attributed_participant_user_id" = COALESCE(pl."attributed_participant_user_id", rc."participant_user_id")
FROM "referral_codes" rc
WHERE pl."referral_link_id" = rc."referral_link_id"
  AND pl."referral_code_id" IS NULL;
