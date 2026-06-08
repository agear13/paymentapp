-- Stripe SaaS subscription billing (Professional / Growth).
ALTER TABLE "organizations"
  ADD COLUMN IF NOT EXISTS "stripe_customer_id" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "stripe_subscription_id" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "current_period_end" TIMESTAMPTZ(6);

CREATE UNIQUE INDEX IF NOT EXISTS "organizations_stripe_customer_id_key"
  ON "organizations" ("stripe_customer_id")
  WHERE "stripe_customer_id" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "organizations_stripe_subscription_id_key"
  ON "organizations" ("stripe_subscription_id")
  WHERE "stripe_subscription_id" IS NOT NULL;

-- Free-tier orgs without a Stripe subscription use inactive status.
UPDATE "organizations"
SET "subscription_status" = 'inactive'
WHERE "stripe_subscription_id" IS NULL
  AND "subscription_status" = 'active';

-- Paid plans without Stripe confirmation revert to Starter (billing is source of truth).
UPDATE "organizations"
SET
  "subscription_plan" = 'starter',
  "subscription_status" = 'inactive'
WHERE "stripe_subscription_id" IS NULL
  AND "subscription_plan" IN ('professional', 'growth');

ALTER TABLE "organizations"
  ALTER COLUMN "subscription_status" SET DEFAULT 'inactive';
