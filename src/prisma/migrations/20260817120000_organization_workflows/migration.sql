-- CreateEnum
CREATE TYPE "OrganizationWorkflowStatus" AS ENUM ('DEPLOYED', 'PAUSED');

-- CreateTable
CREATE TABLE "organization_workflows" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "template_slug" VARCHAR(64) NOT NULL,
    "template_version" VARCHAR(32) NOT NULL,
    "status" "OrganizationWorkflowStatus" NOT NULL DEFAULT 'DEPLOYED',
    "configuration" JSONB NOT NULL DEFAULT '{}',
    "deployed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paused_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "organization_workflows_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "organization_workflows_organization_id_status_idx" ON "organization_workflows"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ux_organization_workflows_org_template" ON "organization_workflows"("organization_id", "template_slug");

-- AddForeignKey
ALTER TABLE "organization_workflows" ADD CONSTRAINT "organization_workflows_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
