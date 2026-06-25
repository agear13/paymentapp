-- Optional OAuth metadata for full TokenSet round-trip (id_token encrypted at app layer).
ALTER TABLE "xero_connections"
ADD COLUMN IF NOT EXISTS "id_token" TEXT,
ADD COLUMN IF NOT EXISTS "token_type" VARCHAR(32),
ADD COLUMN IF NOT EXISTS "scope" VARCHAR(2048);
