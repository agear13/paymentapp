-- CreateEnum
CREATE TYPE "AgreementProcessingJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "agreement_processing_jobs" (
    "id" UUID NOT NULL,
    "upload_id" UUID NOT NULL,
    "report_id" UUID NOT NULL,
    "job_type" VARCHAR(50) NOT NULL,
    "status" "AgreementProcessingJobStatus" NOT NULL DEFAULT 'PENDING',
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 3,
    "last_error" TEXT,
    "locked_at" TIMESTAMPTZ(6),
    "locked_by" VARCHAR(255),
    "run_after" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "completed_at" TIMESTAMPTZ(6),

    CONSTRAINT "agreement_processing_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agreement_processing_jobs_status_idx" ON "agreement_processing_jobs"("status");

-- CreateIndex
CREATE INDEX "agreement_processing_jobs_run_after_idx" ON "agreement_processing_jobs"("run_after");

-- CreateIndex
CREATE INDEX "agreement_processing_jobs_created_at_idx" ON "agreement_processing_jobs"("created_at" DESC);

-- CreateIndex
CREATE INDEX "agreement_processing_jobs_status_run_after_idx" ON "agreement_processing_jobs"("status", "run_after");

-- AddForeignKey
ALTER TABLE "agreement_processing_jobs" ADD CONSTRAINT "agreement_processing_jobs_upload_id_fkey" FOREIGN KEY ("upload_id") REFERENCES "agreement_uploads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agreement_processing_jobs" ADD CONSTRAINT "agreement_processing_jobs_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "agreement_obligation_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;
