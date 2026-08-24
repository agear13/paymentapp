-- Phase 1: additive ReferralProgram layer. Links remain the settlement container.
-- program_id is nullable; existing economic FKs are unchanged.

CREATE TYPE "ReferralProgramStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ARCHIVED');

CREATE TABLE "referral_programs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "slug" VARCHAR(64) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "status" "ReferralProgramStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referral_programs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "referral_programs_organization_id_slug_key"
    ON "referral_programs"("organization_id", "slug");

CREATE INDEX "referral_programs_organization_id_status_idx"
    ON "referral_programs"("organization_id", "status");

ALTER TABLE "referral_programs"
    ADD CONSTRAINT "referral_programs_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "referral_links"
    ADD COLUMN "program_id" UUID;

CREATE INDEX "referral_links_program_id_idx" ON "referral_links"("program_id");

ALTER TABLE "referral_links"
    ADD CONSTRAINT "referral_links_program_id_fkey"
    FOREIGN KEY ("program_id") REFERENCES "referral_programs"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill one default program per org that already has referral links or codes.
INSERT INTO "referral_programs" ("organization_id", "slug", "name", "status")
SELECT DISTINCT org_id, 'default', 'Default Referral Program', 'ACTIVE'
FROM (
    SELECT "organization_id" AS org_id FROM "referral_links"
    UNION
    SELECT "organization_id" AS org_id FROM "referral_codes"
) existing
ON CONFLICT ("organization_id", "slug") DO NOTHING;

UPDATE "referral_links" AS rl
SET "program_id" = rp.id
FROM "referral_programs" AS rp
WHERE rp."organization_id" = rl."organization_id"
  AND rp."slug" = 'default'
  AND rl."program_id" IS NULL;
