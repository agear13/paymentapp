ALTER TABLE "payment_links"
ADD COLUMN IF NOT EXISTS "attachment_storage_key" VARCHAR(1024),
ADD COLUMN IF NOT EXISTS "attachment_bucket" VARCHAR(128);

ALTER TABLE "payment_links"
ALTER COLUMN "attachment_bucket" SET DEFAULT 'payment-link-attachments';

UPDATE "payment_links"
SET "attachment_bucket" = 'payment-link-attachments'
WHERE "attachment_storage_key" IS NOT NULL
  AND ("attachment_bucket" IS NULL OR "attachment_bucket" = '');
