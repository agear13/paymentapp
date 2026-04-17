-- Deal Network pilot: explicit obligations (additive only).
-- Does not alter, drop, or truncate existing pilot deal / participant tables or data.

CREATE TYPE "DealNetworkPilotObligationStatus" AS ENUM (
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'AVAILABLE_FOR_PAYOUT',
  'PAID',
  'REJECTED',
  'REVERSED'
);

CREATE TABLE "deal_network_pilot_obligations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" VARCHAR(255) NOT NULL,
    "organization_id" UUID,
    "deal_id" VARCHAR(255) NOT NULL,
    "participant_id" VARCHAR(255),
    "allocation_rule_id" UUID,
    "payment_event_id" UUID,
    "obligation_type" VARCHAR(64) NOT NULL,
    "amount_owed" DECIMAL(18,2) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'USD',
    "status" "DealNetworkPilotObligationStatus" NOT NULL DEFAULT 'DRAFT',
    "calculation_explanation" TEXT NOT NULL,
    "calculation_snapshot_json" JSONB NOT NULL,
    "due_date" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deal_network_pilot_obligations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "deal_network_pilot_obligations_user_id_deal_id_idx" ON "deal_network_pilot_obligations"("user_id", "deal_id");
CREATE INDEX "deal_network_pilot_obligations_deal_id_idx" ON "deal_network_pilot_obligations"("deal_id");
CREATE INDEX "deal_network_pilot_obligations_participant_id_idx" ON "deal_network_pilot_obligations"("participant_id");
CREATE INDEX "deal_network_pilot_obligations_status_idx" ON "deal_network_pilot_obligations"("status");

ALTER TABLE "deal_network_pilot_obligations" ADD CONSTRAINT "deal_network_pilot_obligations_deal_id_fkey"
  FOREIGN KEY ("deal_id") REFERENCES "deal_network_pilot_deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "deal_network_pilot_obligations" ADD CONSTRAINT "deal_network_pilot_obligations_participant_id_fkey"
  FOREIGN KEY ("participant_id") REFERENCES "deal_network_pilot_participants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
