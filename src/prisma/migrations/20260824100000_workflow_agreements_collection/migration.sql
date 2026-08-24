-- Allow multiple persisted Agreement Intelligence extractions per installed workflow.
-- Existing rows remain current; new extractions insert a new row instead of overwriting.

DROP INDEX IF EXISTS "organization_workflow_agreements_organization_workflow_id_key";

ALTER TABLE "organization_workflow_agreements"
ADD COLUMN IF NOT EXISTS "is_current" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS "organization_workflow_agreements_organization_workflow_id_is_current_idx"
ON "organization_workflow_agreements"("organization_workflow_id", "is_current");
