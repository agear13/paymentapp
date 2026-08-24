-- Phase 2: participant invitation → workspace attribution provenance.
-- Additive only. Do not backfill source_organization_id.

ALTER TABLE "deal_network_pilot_participants"
ADD COLUMN "source_organization_id" UUID,
ADD COLUMN "converted_organization_id" UUID,
ADD COLUMN "converted_at" TIMESTAMPTZ(6);

CREATE UNIQUE INDEX "deal_network_pilot_participants_converted_organization_id_key"
ON "deal_network_pilot_participants"("converted_organization_id");

CREATE INDEX "deal_network_pilot_participants_source_organization_id_idx"
ON "deal_network_pilot_participants"("source_organization_id");

CREATE INDEX "deal_network_pilot_participants_authenticated_user_id_converted_organization_id_idx"
ON "deal_network_pilot_participants"("authenticated_user_id", "converted_organization_id");

ALTER TABLE "deal_network_pilot_participants"
ADD CONSTRAINT "deal_network_pilot_participants_source_organization_id_fkey"
FOREIGN KEY ("source_organization_id") REFERENCES "organizations"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "deal_network_pilot_participants"
ADD CONSTRAINT "deal_network_pilot_participants_converted_organization_id_fkey"
FOREIGN KEY ("converted_organization_id") REFERENCES "organizations"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
