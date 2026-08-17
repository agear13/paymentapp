-- AlterEnum
ALTER TYPE "OrganizationWorkflowLifecycleStatus" ADD VALUE 'BOOTSTRAPPING';
ALTER TYPE "OrganizationWorkflowLifecycleStatus" ADD VALUE 'BOOTSTRAP_FAILED';
ALTER TYPE "OrganizationWorkflowLifecycleStatus" ADD VALUE 'ACTIVE';

-- AlterTable
ALTER TABLE "organization_workflow_agreements" ADD COLUMN "pilot_deal_id" VARCHAR(255);
ALTER TABLE "organization_workflow_agreements" ADD COLUMN "bootstrap_error" TEXT;
ALTER TABLE "organization_workflow_agreements" ADD COLUMN "bootstrapped_at" TIMESTAMPTZ(6);

-- CreateIndex
CREATE INDEX "organization_workflow_agreements_pilot_deal_id_idx" ON "organization_workflow_agreements"("pilot_deal_id");
