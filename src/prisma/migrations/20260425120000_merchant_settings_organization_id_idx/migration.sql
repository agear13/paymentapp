-- Align DB with Prisma @@index([organization_id]) on merchant_settings (org-scoped lookups).
CREATE INDEX IF NOT EXISTS "merchant_settings_organization_id_idx" ON "merchant_settings"("organization_id");
