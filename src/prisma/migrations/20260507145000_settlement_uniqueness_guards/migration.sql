-- Settlement uniqueness hardening: canonical PAYMENT_CONFIRMED + provider identifiers.

-- 1) De-duplicate PAYMENT_CONFIRMED rows per payment_link_id (keep newest).
WITH ranked_confirmed AS (
  SELECT
    id,
    payment_link_id,
    ROW_NUMBER() OVER (
      PARTITION BY payment_link_id
      ORDER BY created_at DESC, id DESC
    ) AS rn
  FROM payment_events
  WHERE event_type = 'PAYMENT_CONFIRMED'
    AND payment_link_id IS NOT NULL
), deleted_confirmed AS (
  DELETE FROM payment_events pe
  USING ranked_confirmed rc
  WHERE pe.id = rc.id
    AND rc.rn > 1
  RETURNING pe.id
)
SELECT COUNT(*) AS deleted_payment_confirmed_duplicates FROM deleted_confirmed;

-- 2) De-duplicate provider ids within PAYMENT_CONFIRMED (keep newest row).
WITH ranked_stripe_event AS (
  SELECT id, stripe_event_id,
    ROW_NUMBER() OVER (PARTITION BY stripe_event_id ORDER BY created_at DESC, id DESC) AS rn
  FROM payment_events
  WHERE event_type = 'PAYMENT_CONFIRMED'
    AND stripe_event_id IS NOT NULL
), deleted_stripe_event AS (
  DELETE FROM payment_events pe
  USING ranked_stripe_event r
  WHERE pe.id = r.id AND r.rn > 1
  RETURNING pe.id
)
SELECT COUNT(*) AS deleted_duplicate_stripe_event_ids FROM deleted_stripe_event;

WITH ranked_stripe_pi AS (
  SELECT id, stripe_payment_intent_id,
    ROW_NUMBER() OVER (PARTITION BY stripe_payment_intent_id ORDER BY created_at DESC, id DESC) AS rn
  FROM payment_events
  WHERE event_type = 'PAYMENT_CONFIRMED'
    AND stripe_payment_intent_id IS NOT NULL
), deleted_stripe_pi AS (
  DELETE FROM payment_events pe
  USING ranked_stripe_pi r
  WHERE pe.id = r.id AND r.rn > 1
  RETURNING pe.id
)
SELECT COUNT(*) AS deleted_duplicate_stripe_payment_intent_ids FROM deleted_stripe_pi;

WITH ranked_hedera AS (
  SELECT id, hedera_transaction_id,
    ROW_NUMBER() OVER (PARTITION BY hedera_transaction_id ORDER BY created_at DESC, id DESC) AS rn
  FROM payment_events
  WHERE event_type = 'PAYMENT_CONFIRMED'
    AND hedera_transaction_id IS NOT NULL
), deleted_hedera AS (
  DELETE FROM payment_events pe
  USING ranked_hedera r
  WHERE pe.id = r.id AND r.rn > 1
  RETURNING pe.id
)
SELECT COUNT(*) AS deleted_duplicate_hedera_transaction_ids FROM deleted_hedera;

WITH ranked_wise AS (
  SELECT id, wise_transfer_id,
    ROW_NUMBER() OVER (PARTITION BY wise_transfer_id ORDER BY created_at DESC, id DESC) AS rn
  FROM payment_events
  WHERE event_type = 'PAYMENT_CONFIRMED'
    AND wise_transfer_id IS NOT NULL
), deleted_wise AS (
  DELETE FROM payment_events pe
  USING ranked_wise r
  WHERE pe.id = r.id AND r.rn > 1
  RETURNING pe.id
)
SELECT COUNT(*) AS deleted_duplicate_wise_transfer_ids FROM deleted_wise;

-- 3) Canonical settlement uniqueness per link.
CREATE UNIQUE INDEX IF NOT EXISTS ux_payment_events_confirmed_per_link
ON payment_events (payment_link_id)
WHERE event_type = 'PAYMENT_CONFIRMED' AND payment_link_id IS NOT NULL;

-- 4) Provider identifier uniqueness for settled events.
CREATE UNIQUE INDEX IF NOT EXISTS ux_payment_events_confirmed_stripe_event
ON payment_events (stripe_event_id)
WHERE event_type = 'PAYMENT_CONFIRMED' AND stripe_event_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_payment_events_confirmed_stripe_pi
ON payment_events (stripe_payment_intent_id)
WHERE event_type = 'PAYMENT_CONFIRMED' AND stripe_payment_intent_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_payment_events_confirmed_hedera_tx
ON payment_events (hedera_transaction_id)
WHERE event_type = 'PAYMENT_CONFIRMED' AND hedera_transaction_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_payment_events_confirmed_wise_transfer
ON payment_events (wise_transfer_id)
WHERE event_type = 'PAYMENT_CONFIRMED' AND wise_transfer_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_payment_events_confirmed_source_reference
ON payment_events (source_reference)
WHERE event_type = 'PAYMENT_CONFIRMED' AND source_reference IS NOT NULL;
