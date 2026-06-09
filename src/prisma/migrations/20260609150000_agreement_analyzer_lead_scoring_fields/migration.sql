-- Ticket 6: extend lead scores with qualification metadata
ALTER TABLE "obligation_report_lead_scores" ADD COLUMN "event_detected" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "obligation_report_lead_scores" ADD COLUMN "multi_party_detected" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "obligation_report_lead_scores" ADD COLUMN "recommended_use_case" VARCHAR(128);
ALTER TABLE "obligation_report_lead_scores" ADD COLUMN "priority_band" VARCHAR(32);

CREATE INDEX "obligation_report_lead_scores_priority_band_idx" ON "obligation_report_lead_scores"("priority_band");
