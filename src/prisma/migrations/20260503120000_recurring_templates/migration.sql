-- Recurring invoice templates: schedule new payment links per organization.

CREATE TYPE "RecurringTemplateInterval" AS ENUM ('WEEKLY', 'MONTHLY', 'CUSTOM');
CREATE TYPE "RecurringTemplateStatus" AS ENUM ('ACTIVE', 'PAUSED');

CREATE TABLE "recurring_templates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "description" TEXT NOT NULL,
    "customer_email" VARCHAR(255),
    "recurrence_interval" "RecurringTemplateInterval" NOT NULL,
    "interval_count" INTEGER NOT NULL DEFAULT 1,
    "next_run_at" TIMESTAMPTZ(6) NOT NULL,
    "end_date" DATE,
    "status" "RecurringTemplateStatus" NOT NULL DEFAULT 'ACTIVE',
    "due_days_after_invoice" INTEGER,
    "last_run_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "recurring_templates_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "recurring_templates_organization_id_fkey"
      FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "recurring_templates_status_next_run_at_idx" ON "recurring_templates" ("status", "next_run_at");
CREATE INDEX "recurring_templates_organization_id_idx" ON "recurring_templates" ("organization_id");
