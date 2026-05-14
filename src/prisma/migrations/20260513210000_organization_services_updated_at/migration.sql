-- Track catalog edits for operator audit; Prisma @updatedAt manages writes.
ALTER TABLE "organization_services"
  ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;
