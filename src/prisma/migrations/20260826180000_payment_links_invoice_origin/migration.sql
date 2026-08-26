-- Additive invoice provenance for participant-portal Create Invoice.
-- Existing payment_links rows stay null. Do not backfill.
-- origin_deal_id is informational only and is not pilot_deal_id.

ALTER TABLE "payment_links"
ADD COLUMN "invoice_origin" VARCHAR(32),
ADD COLUMN "origin_participant_id" VARCHAR(255),
ADD COLUMN "origin_source_organization_id" UUID,
ADD COLUMN "origin_deal_id" VARCHAR(255);

CREATE INDEX "payment_links_invoice_origin_idx"
ON "payment_links"("invoice_origin");

CREATE INDEX "payment_links_origin_participant_id_idx"
ON "payment_links"("origin_participant_id");

CREATE INDEX "payment_links_origin_source_organization_id_idx"
ON "payment_links"("origin_source_organization_id");

CREATE INDEX "payment_links_origin_deal_id_idx"
ON "payment_links"("origin_deal_id");

ALTER TABLE "payment_links"
ADD CONSTRAINT "payment_links_origin_participant_id_fkey"
FOREIGN KEY ("origin_participant_id") REFERENCES "deal_network_pilot_participants"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "payment_links"
ADD CONSTRAINT "payment_links_origin_source_organization_id_fkey"
FOREIGN KEY ("origin_source_organization_id") REFERENCES "organizations"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "payment_links"
ADD CONSTRAINT "payment_links_origin_deal_id_fkey"
FOREIGN KEY ("origin_deal_id") REFERENCES "deal_network_pilot_deals"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
