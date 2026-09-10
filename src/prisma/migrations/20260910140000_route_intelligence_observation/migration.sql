-- Phase 3: persist official provider operational-health observations.
CREATE TABLE "route_intelligence_observation" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "observation_type" VARCHAR(64) NOT NULL,
    "subject_kind" VARCHAR(64) NOT NULL,
    "subject_id" VARCHAR(128) NOT NULL,
    "provider_id" VARCHAR(64) NOT NULL,
    "value" JSONB NOT NULL,
    "observed_at" TIMESTAMPTZ(6) NOT NULL,
    "fetched_at" TIMESTAMPTZ(6) NOT NULL,
    "source_id" VARCHAR(64) NOT NULL,
    "source_url" VARCHAR(512) NOT NULL,
    "provenance" VARCHAR(32) NOT NULL,
    "confidence" VARCHAR(32) NOT NULL,
    "stale_after" TIMESTAMPTZ(6) NOT NULL,
    "raw_hash" VARCHAR(64) NOT NULL,
    "raw_payload" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "route_intelligence_observation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "route_intel_obs_type_subject_fetched_idx" ON "route_intelligence_observation"("observation_type", "subject_id", "fetched_at" DESC);
CREATE INDEX "route_intel_obs_provider_fetched_idx" ON "route_intelligence_observation"("provider_id", "fetched_at" DESC);
