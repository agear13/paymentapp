-- Phase 9: workspace subscription plan + status (entitlements only; no billing).
ALTER TABLE "organizations"
  ADD COLUMN IF NOT EXISTS "subscription_plan" VARCHAR(32) NOT NULL DEFAULT 'starter',
  ADD COLUMN IF NOT EXISTS "subscription_status" VARCHAR(32) NOT NULL DEFAULT 'active';
