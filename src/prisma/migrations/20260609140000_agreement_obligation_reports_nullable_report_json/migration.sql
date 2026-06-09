-- Make agreement_obligation_reports.report_json nullable (PENDING reports have no payload yet).
-- Additive / non-destructive: existing rows retain their JSON values.

ALTER TABLE "agreement_obligation_reports"
  ALTER COLUMN "report_json" DROP NOT NULL;
