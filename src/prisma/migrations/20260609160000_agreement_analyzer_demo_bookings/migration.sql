-- CreateTable
CREATE TABLE "agreement_analyzer_demo_bookings" (
    "id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "report_id" UUID NOT NULL,
    "calendly_event_id" VARCHAR(255) NOT NULL,
    "invitee_name" VARCHAR(255) NOT NULL,
    "invitee_email" VARCHAR(255) NOT NULL,
    "meeting_time" TIMESTAMPTZ(6) NOT NULL,
    "booking_source" VARCHAR(100) NOT NULL,
    "tracking_token" VARCHAR(1000) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "agreement_analyzer_demo_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "agreement_analyzer_demo_bookings_calendly_event_id_key" ON "agreement_analyzer_demo_bookings"("calendly_event_id");

-- CreateIndex
CREATE INDEX "agreement_analyzer_demo_bookings_lead_id_idx" ON "agreement_analyzer_demo_bookings"("lead_id");

-- CreateIndex
CREATE INDEX "agreement_analyzer_demo_bookings_report_id_idx" ON "agreement_analyzer_demo_bookings"("report_id");

-- CreateIndex
CREATE INDEX "agreement_analyzer_demo_bookings_meeting_time_idx" ON "agreement_analyzer_demo_bookings"("meeting_time");

-- CreateIndex
CREATE INDEX "agreement_analyzer_demo_bookings_created_at_idx" ON "agreement_analyzer_demo_bookings"("created_at" DESC);

-- AddForeignKey
ALTER TABLE "agreement_analyzer_demo_bookings" ADD CONSTRAINT "agreement_analyzer_demo_bookings_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "obligation_report_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agreement_analyzer_demo_bookings" ADD CONSTRAINT "agreement_analyzer_demo_bookings_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "agreement_obligation_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;
