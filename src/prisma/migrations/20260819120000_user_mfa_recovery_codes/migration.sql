-- Hashed MFA recovery codes (TOTP secrets remain in Supabase Auth)
CREATE TABLE IF NOT EXISTS "user_mfa_recovery_codes" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" VARCHAR(255) NOT NULL,
  "code_hash" VARCHAR(64) NOT NULL,
  "used_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT "user_mfa_recovery_codes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "user_mfa_recovery_codes_user_id_idx"
  ON "user_mfa_recovery_codes" ("user_id");
