-- CreateEnum
CREATE TYPE "OrganizationWorkflowLifecycleStatus" AS ENUM ('AWAITING_INPUT', 'EXTRACTING', 'READY_FOR_REVIEW', 'EXTRACTION_FAILED', 'APPROVED');

-- CreateEnum
CREATE TYPE "WorkflowAgreementSourceType" AS ENUM ('PDF', 'PASTE');

-- CreateEnum
CREATE TYPE "WorkflowAgreementExtractionStatus" AS ENUM ('PENDING', 'EXTRACTING', 'READY_FOR_REVIEW', 'FAILED', 'APPROVED');

-- AlterTable
ALTER TABLE "organization_workflows" ADD COLUMN "lifecycle_status" "OrganizationWorkflowLifecycleStatus" NOT NULL DEFAULT 'AWAITING_INPUT';

-- CreateIndex
CREATE INDEX "organization_workflows_organization_id_lifecycle_status_idx" ON "organization_workflows"("organization_id", "lifecycle_status");

-- CreateTable
CREATE TABLE "organization_workflow_agreements" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "organization_workflow_id" UUID NOT NULL,
    "source_type" "WorkflowAgreementSourceType" NOT NULL,
    "title" VARCHAR(512),
    "original_filename" VARCHAR(512),
    "mime_type" VARCHAR(128),
    "file_size_bytes" INTEGER,
    "storage_key" VARCHAR(1024),
    "source_text" TEXT,
    "extraction_status" "WorkflowAgreementExtractionStatus" NOT NULL DEFAULT 'PENDING',
    "extraction_result" JSONB,
    "commercial_graph" JSONB,
    "approved_structure" JSONB,
    "extraction_error" TEXT,
    "extracted_at" TIMESTAMPTZ(6),
    "approved_at" TIMESTAMPTZ(6),
    "approved_by_user_id" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "organization_workflow_agreements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organization_workflow_agreements_organization_workflow_id_key" ON "organization_workflow_agreements"("organization_workflow_id");

-- CreateIndex
CREATE INDEX "organization_workflow_agreements_organization_id_idx" ON "organization_workflow_agreements"("organization_id");

-- CreateIndex
CREATE INDEX "organization_workflow_agreements_extraction_status_idx" ON "organization_workflow_agreements"("extraction_status");

-- AddForeignKey
ALTER TABLE "organization_workflow_agreements" ADD CONSTRAINT "organization_workflow_agreements_organization_workflow_id_fkey" FOREIGN KEY ("organization_workflow_id") REFERENCES "organization_workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_workflow_agreements" ADD CONSTRAINT "organization_workflow_agreements_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
