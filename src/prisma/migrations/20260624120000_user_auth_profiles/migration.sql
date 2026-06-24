-- User auth profiles for last-login tracking and suspicious login flags
CREATE TABLE IF NOT EXISTS "user_auth_profiles" (
  "user_id" VARCHAR(255) NOT NULL,
  "last_login_at" TIMESTAMPTZ(6),
  "last_login_browser" VARCHAR(64),
  "last_login_os" VARCHAR(64),
  "last_login_location" VARCHAR(128),
  "last_login_ip_hash" VARCHAR(64),
  "previous_login_at" TIMESTAMPTZ(6),
  "previous_login_location" VARCHAR(128),
  "suspicious_login_pending" BOOLEAN NOT NULL DEFAULT false,
  "suspicious_login_reason" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT "user_auth_profiles_pkey" PRIMARY KEY ("user_id")
);

CREATE INDEX IF NOT EXISTS "user_auth_profiles_suspicious_login_pending_idx"
  ON "user_auth_profiles" ("suspicious_login_pending")
  WHERE "suspicious_login_pending" = true;
