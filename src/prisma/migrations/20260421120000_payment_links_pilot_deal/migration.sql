-- Strait / project coordination: link payment_links rows to a Deal Network pilot deal (user-scoped).
ALTER TABLE "payment_links" ADD COLUMN IF NOT EXISTS "pilot_deal_id" VARCHAR(255);

CREATE INDEX IF NOT EXISTS "payment_links_pilot_deal_id_idx" ON "payment_links"("pilot_deal_id");

ALTER TABLE "payment_links"
  DROP CONSTRAINT IF EXISTS "payment_links_pilot_deal_id_fkey";

ALTER TABLE "payment_links"
  ADD CONSTRAINT "payment_links_pilot_deal_id_fkey"
  FOREIGN KEY ("pilot_deal_id") REFERENCES "deal_network_pilot_deals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Pilot obligation row when project has inbound funding but not yet full coverage of obligations.
ALTER TYPE "DealNetworkPilotObligationStatus" ADD VALUE IF NOT EXISTS 'PARTIALLY_FUNDED';
