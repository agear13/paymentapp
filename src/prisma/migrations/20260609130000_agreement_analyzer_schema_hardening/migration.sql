-- Ticket 1.1: Agreement Analyzer schema hardening (additive only).
-- Does not alter, drop, or truncate existing tables or data.

-- CreateEnum
CREATE TYPE "AgreementReportStatus" AS ENUM ('PENDING', 'GENERATING', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "agreement_obligation_reports"
  ADD COLUMN "report_access_token" VARCHAR(32),
  ADD COLUMN "status" "AgreementReportStatus" NOT NULL DEFAULT 'PENDING';

-- CreateIndex
CREATE UNIQUE INDEX "agreement_obligation_reports_report_access_token_key" ON "agreement_obligation_reports"("report_access_token");

-- CreateIndex
CREATE INDEX "agreement_obligation_reports_status_idx" ON "agreement_obligation_reports"("status");
