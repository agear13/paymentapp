-- Payment Links: optional merchant attachment (PNG/JPEG/PDF) metadata
ALTER TABLE "payment_links"
ADD COLUMN IF NOT EXISTS "attachment_url" VARCHAR(512),
ADD COLUMN IF NOT EXISTS "attachment_filename" VARCHAR(512),
ADD COLUMN IF NOT EXISTS "attachment_mime_type" VARCHAR(128),
ADD COLUMN IF NOT EXISTS "attachment_size_bytes" INTEGER;
