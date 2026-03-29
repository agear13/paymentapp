-- Rabbit Hole Deal Network pilot persistence (per authenticated user)

CREATE TABLE "deal_network_pilot_deals" (
    "id" VARCHAR(255) NOT NULL,
    "user_id" VARCHAR(255) NOT NULL,
    "name" TEXT NOT NULL,
    "partner" TEXT NOT NULL,
    "contact" TEXT,
    "deal_value" DECIMAL(18,2) NOT NULL,
    "payment_link" TEXT,
    "payment_status" VARCHAR(32) NOT NULL,
    "paid_amount" DECIMAL(18,2),
    "paid_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deal_payload" JSONB NOT NULL,

    CONSTRAINT "deal_network_pilot_deals_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "deal_network_pilot_deals_user_id_idx" ON "deal_network_pilot_deals"("user_id");

CREATE TABLE "deal_network_pilot_participants" (
    "id" VARCHAR(255) NOT NULL,
    "deal_id" VARCHAR(255) NOT NULL,
    "invite_token" VARCHAR(255) NOT NULL,
    "name" TEXT NOT NULL,
    "email" VARCHAR(512),
    "role" VARCHAR(64) NOT NULL,
    "role_details" TEXT,
    "payout_condition" TEXT,
    "approval_status" VARCHAR(64) NOT NULL,
    "approved_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "participant_payload" JSONB NOT NULL,

    CONSTRAINT "deal_network_pilot_participants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "deal_network_pilot_participants_invite_token_key" ON "deal_network_pilot_participants"("invite_token");

CREATE INDEX "deal_network_pilot_participants_deal_id_idx" ON "deal_network_pilot_participants"("deal_id");

ALTER TABLE "deal_network_pilot_participants" ADD CONSTRAINT "deal_network_pilot_participants_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deal_network_pilot_deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
