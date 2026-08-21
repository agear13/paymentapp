-- Compare-and-swap generation for Xero rotating refresh tokens.
ALTER TABLE "xero_connections"
ADD COLUMN IF NOT EXISTS "token_version" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "last_refresh_at" TIMESTAMPTZ;
