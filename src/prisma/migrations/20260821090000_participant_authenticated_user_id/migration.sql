-- Bind an invited deal-network participant to a reusable Supabase Auth user.
ALTER TABLE "deal_network_pilot_participants"
ADD COLUMN "authenticated_user_id" VARCHAR(255);

CREATE INDEX "deal_network_pilot_participants_authenticated_user_id_idx"
ON "deal_network_pilot_participants"("authenticated_user_id");
