-- Lightweight project planning layer (above participant/agreement/obligation workflow)

CREATE TYPE "ProjectAllocationBudgetType" AS ENUM (
  'FIXED',
  'PERCENTAGE',
  'REVENUE_SHARE',
  'ATTRIBUTION'
);

CREATE TYPE "ProjectAllocationStatus" AS ENUM (
  'PLANNED',
  'ASSIGNED',
  'PENDING_APPROVAL',
  'APPROVED',
  'OBLIGATION_CREATED',
  'SETTLED'
);

CREATE TABLE "project_allocations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" VARCHAR(255) NOT NULL,
    "user_id" VARCHAR(255) NOT NULL,
    "title" TEXT NOT NULL,
    "role" VARCHAR(128) NOT NULL,
    "description" TEXT,
    "budget_type" "ProjectAllocationBudgetType" NOT NULL,
    "budget_value" DECIMAL(18, 4) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'USD',
    "planned_budget_value" DECIMAL(18, 4) NOT NULL,
    "actual_budget_value" DECIMAL(18, 4),
    "participant_id" VARCHAR(255),
    "status" "ProjectAllocationStatus" NOT NULL DEFAULT 'PLANNED',
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "project_allocations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "project_allocations_project_id_idx" ON "project_allocations"("project_id");
CREATE INDEX "project_allocations_user_id_project_id_idx" ON "project_allocations"("user_id", "project_id");
CREATE INDEX "project_allocations_participant_id_idx" ON "project_allocations"("participant_id");

ALTER TABLE "project_allocations" ADD CONSTRAINT "project_allocations_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "deal_network_pilot_deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project_allocations" ADD CONSTRAINT "project_allocations_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "deal_network_pilot_participants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
