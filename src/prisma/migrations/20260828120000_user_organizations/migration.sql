-- Promote historically loose SQL (prisma/migrations/add_user_organizations_table.sql)
-- into Prisma migrate history. That file is not a dated folder, so `migrate deploy`
-- never created this table on greenfield databases.
-- Additive only. Matches schema.prisma model user_organizations.

CREATE TABLE IF NOT EXISTS "user_organizations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" VARCHAR(255) NOT NULL,
    "organization_id" UUID NOT NULL,
    "role" VARCHAR(50) NOT NULL DEFAULT 'MEMBER',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_organizations_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "user_organizations"
    ADD CONSTRAINT "user_organizations_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "user_organizations_user_id_organization_id_key"
  ON "user_organizations"("user_id", "organization_id");

CREATE INDEX IF NOT EXISTS "user_organizations_user_id_idx"
  ON "user_organizations"("user_id");

CREATE INDEX IF NOT EXISTS "user_organizations_organization_id_idx"
  ON "user_organizations"("organization_id");

CREATE INDEX IF NOT EXISTS "user_organizations_role_idx"
  ON "user_organizations"("role");
