-- Operational onboarding transition persistence (immutable initialization infrastructure)
CREATE TABLE IF NOT EXISTS "operational_onboarding_transitions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID,
    "project_id" VARCHAR(128),
    "record_kind" VARCHAR(64) NOT NULL DEFAULT 'transition',
    "phase" VARCHAR(64) NOT NULL,
    "previous_phase" VARCHAR(64),
    "status" VARCHAR(32) NOT NULL,
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),
    "failed_at" TIMESTAMPTZ(6),
    "correlation_id" VARCHAR(255) NOT NULL,
    "trigger_source" VARCHAR(128) NOT NULL,
    "user_id" VARCHAR(255),
    "metadata" JSONB,
    "orchestration_event_id" VARCHAR(255),

    CONSTRAINT "operational_onboarding_transitions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "operational_onboarding_transitions_organization_id_started_at_idx"
    ON "operational_onboarding_transitions"("organization_id", "started_at" DESC);

CREATE INDEX IF NOT EXISTS "operational_onboarding_transitions_correlation_id_idx"
    ON "operational_onboarding_transitions"("correlation_id");

CREATE INDEX IF NOT EXISTS "operational_onboarding_transitions_organization_id_phase_status_idx"
    ON "operational_onboarding_transitions"("organization_id", "phase", "status");

CREATE INDEX IF NOT EXISTS "operational_onboarding_transitions_organization_id_correlation_id_idx"
    ON "operational_onboarding_transitions"("organization_id", "correlation_id");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'operational_onboarding_transitions_organization_id_fkey'
    ) THEN
        ALTER TABLE "operational_onboarding_transitions"
            ADD CONSTRAINT "operational_onboarding_transitions_organization_id_fkey"
            FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
