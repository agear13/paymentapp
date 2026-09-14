-- Website subscriber marketing lifecycle fields on existing waitlist signups.

ALTER TABLE "marketing_waitlist_signups"
  ADD COLUMN IF NOT EXISTS "resend_contact_id" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "marketing_unsubscribed_at" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "converted_at" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "user_id" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "confirmation_email_sent_at" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "subscriber_created_event_at" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "subscriber_converted_event_at" TIMESTAMPTZ(6);

CREATE INDEX IF NOT EXISTS "marketing_waitlist_signups_email_idx"
  ON "marketing_waitlist_signups"("email");

CREATE INDEX IF NOT EXISTS "marketing_waitlist_signups_user_id_idx"
  ON "marketing_waitlist_signups"("user_id");
