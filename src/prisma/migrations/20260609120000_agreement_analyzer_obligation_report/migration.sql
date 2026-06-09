-- AI Obligation Report (Agreement Analyzer) — additive MVP schema.
-- Does not alter, drop, or truncate existing tables or data.

-- CreateEnum
CREATE TYPE "ObligationReportLeadLifecycleStage" AS ENUM ('NEW', 'REPORT_GENERATED', 'REPORT_VIEWED', 'DEMO_BOOKED', 'QUALIFIED', 'CUSTOMER');

-- CreateEnum
CREATE TYPE "AgreementUploadStatus" AS ENUM ('UPLOADED', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "ObligationReportEmailType" AS ENUM ('REPORT_READY', 'DEMO_INVITE', 'FOLLOW_UP');

-- CreateTable
CREATE TABLE "obligation_report_leads" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "first_name" VARCHAR(255) NOT NULL,
    "last_name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "company_name" VARCHAR(255),
    "business_type" VARCHAR(128),
    "source" VARCHAR(128),
    "lifecycle_stage" "ObligationReportLeadLifecycleStage" NOT NULL DEFAULT 'NEW',
    "user_id" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "obligation_report_leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agreement_uploads" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "lead_id" UUID NOT NULL,
    "original_filename" VARCHAR(512) NOT NULL,
    "mime_type" VARCHAR(128) NOT NULL,
    "file_size_bytes" INTEGER NOT NULL,
    "storage_key" VARCHAR(1024) NOT NULL,
    "storage_url" TEXT,
    "upload_status" "AgreementUploadStatus" NOT NULL DEFAULT 'UPLOADED',
    "uploaded_at" TIMESTAMPTZ(6),
    "processed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "agreement_uploads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agreement_ai_extractions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "upload_id" UUID NOT NULL,
    "extracted_text" TEXT,
    "extraction_json" JSONB,
    "confidence_score" DECIMAL(6,4),
    "model_name" VARCHAR(128),
    "processing_duration_ms" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "agreement_ai_extractions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agreement_obligation_reports" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "upload_id" UUID NOT NULL,
    "report_json" JSONB NOT NULL,
    "settlement_readiness_score" INTEGER,
    "report_version" VARCHAR(32) NOT NULL DEFAULT '1',
    "viewed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "agreement_obligation_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "obligation_report_lead_scores" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "lead_id" UUID NOT NULL,
    "complexity_score" INTEGER,
    "revenue_share_detected" BOOLEAN NOT NULL DEFAULT false,
    "hospitality_detected" BOOLEAN NOT NULL DEFAULT false,
    "accountant_detected" BOOLEAN NOT NULL DEFAULT false,
    "party_count" INTEGER,
    "obligation_count" INTEGER,
    "risk_count" INTEGER,
    "overall_score" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "obligation_report_lead_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "obligation_report_email_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "lead_id" UUID NOT NULL,
    "email_type" "ObligationReportEmailType" NOT NULL,
    "provider_message_id" VARCHAR(255),
    "delivered_at" TIMESTAMPTZ(6),
    "opened_at" TIMESTAMPTZ(6),
    "clicked_at" TIMESTAMPTZ(6),
    "bounced_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "obligation_report_email_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "obligation_report_leads_email_idx" ON "obligation_report_leads"("email");

-- CreateIndex
CREATE INDEX "obligation_report_leads_created_at_idx" ON "obligation_report_leads"("created_at" DESC);

-- CreateIndex
CREATE INDEX "obligation_report_leads_user_id_idx" ON "obligation_report_leads"("user_id");

-- CreateIndex
CREATE INDEX "obligation_report_leads_lifecycle_stage_idx" ON "obligation_report_leads"("lifecycle_stage");

-- CreateIndex
CREATE INDEX "agreement_uploads_lead_id_idx" ON "agreement_uploads"("lead_id");

-- CreateIndex
CREATE INDEX "agreement_uploads_upload_status_idx" ON "agreement_uploads"("upload_status");

-- CreateIndex
CREATE INDEX "agreement_ai_extractions_upload_id_idx" ON "agreement_ai_extractions"("upload_id");

-- CreateIndex
CREATE INDEX "agreement_obligation_reports_upload_id_idx" ON "agreement_obligation_reports"("upload_id");

-- CreateIndex
CREATE INDEX "agreement_obligation_reports_created_at_idx" ON "agreement_obligation_reports"("created_at" DESC);

-- CreateIndex
CREATE INDEX "obligation_report_lead_scores_lead_id_idx" ON "obligation_report_lead_scores"("lead_id");

-- CreateIndex
CREATE INDEX "obligation_report_lead_scores_overall_score_idx" ON "obligation_report_lead_scores"("overall_score");

-- CreateIndex
CREATE INDEX "obligation_report_lead_scores_revenue_share_detected_idx" ON "obligation_report_lead_scores"("revenue_share_detected");

-- CreateIndex
CREATE INDEX "obligation_report_email_events_lead_id_idx" ON "obligation_report_email_events"("lead_id");

-- CreateIndex
CREATE INDEX "obligation_report_email_events_email_type_idx" ON "obligation_report_email_events"("email_type");

-- CreateIndex
CREATE INDEX "obligation_report_email_events_provider_message_id_idx" ON "obligation_report_email_events"("provider_message_id");

-- AddForeignKey
ALTER TABLE "agreement_uploads" ADD CONSTRAINT "agreement_uploads_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "obligation_report_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agreement_ai_extractions" ADD CONSTRAINT "agreement_ai_extractions_upload_id_fkey" FOREIGN KEY ("upload_id") REFERENCES "agreement_uploads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agreement_obligation_reports" ADD CONSTRAINT "agreement_obligation_reports_upload_id_fkey" FOREIGN KEY ("upload_id") REFERENCES "agreement_uploads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "obligation_report_lead_scores" ADD CONSTRAINT "obligation_report_lead_scores_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "obligation_report_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "obligation_report_email_events" ADD CONSTRAINT "obligation_report_email_events_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "obligation_report_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
