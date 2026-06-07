-- Historical payment repair inventory (READ-ONLY)
-- Safe to run on production read replica.
-- Run counts first; uncomment detail sections for samples.

-- =============================================================================
-- Summary counts (run this block first)
-- =============================================================================

-- Cohort A: PAID without PAYMENT_CONFIRMED
SELECT 'cohort_a_paid_without_confirmed' AS cohort, COUNT(*) AS cnt
FROM payment_links pl
WHERE pl.status = 'PAID'
  AND NOT EXISTS (
    SELECT 1 FROM payment_events pe
    WHERE pe.payment_link_id = pl.id AND pe.event_type = 'PAYMENT_CONFIRMED'
  );

-- Cohort A by payment_method
SELECT pl.payment_method, COUNT(*) AS cnt
FROM payment_links pl
WHERE pl.status = 'PAID'
  AND NOT EXISTS (
    SELECT 1 FROM payment_events pe
    WHERE pe.payment_link_id = pl.id AND pe.event_type = 'PAYMENT_CONFIRMED'
  )
GROUP BY pl.payment_method
ORDER BY cnt DESC;

-- PAYMENT_CONFIRMED count (baseline)
SELECT COUNT(*) AS total_payment_confirmed
FROM payment_events
WHERE event_type = 'PAYMENT_CONFIRMED' AND payment_link_id IS NOT NULL;

-- Cohort C: Hedera manual verify (pre-R4 style metadata)
SELECT 'cohort_c_hedera_manual_verify' AS cohort, COUNT(*) AS cnt
FROM payment_events pe
WHERE pe.event_type = 'PAYMENT_CONFIRMED'
  AND (
    pe.metadata->>'manuallyVerified' = 'true'
    OR pe.metadata->>'source' = 'hedera-manual-verify'
    OR pe.metadata->>'settlementPath' = 'hedera_mirror_verify'
  );

-- Cohort D: Assisted review provider refs
SELECT 'cohort_d_assisted_review_ref' AS cohort, COUNT(*) AS cnt
FROM payment_events pe
WHERE pe.event_type = 'PAYMENT_CONFIRMED'
  AND (
    pe.source_reference LIKE 'bank-review:%'
    OR pe.source_reference LIKE 'crypto-review:%'
  );

-- Cohort E: Operator manual settlement ref
SELECT 'cohort_e_manual_settlement_ref' AS cohort, COUNT(*) AS cnt
FROM payment_events pe
WHERE pe.event_type = 'PAYMENT_CONFIRMED'
  AND pe.source_reference LIKE 'manual-settlement:%';

-- Cohort B/F: PAYMENT_CONFIRMED without commission obligation
SELECT 'cohort_b_no_commission_obligation' AS cohort, COUNT(*) AS cnt
FROM payment_events pe
JOIN payment_links pl ON pl.id = pe.payment_link_id
WHERE pe.event_type = 'PAYMENT_CONFIRMED'
  AND pl.referral_link_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM commission_obligations co
    WHERE co.stripe_event_id = pe.id
  );

-- Cohort B/F: obligation without items (when obligation exists)
SELECT 'cohort_f_obligation_no_items' AS cohort, COUNT(*) AS cnt
FROM commission_obligations co
WHERE NOT EXISTS (
  SELECT 1 FROM commission_obligation_items coi WHERE coi.obligation_id = co.id
);

-- Integrity: OPEN with PAYMENT_CONFIRMED (must NOT auto-repair blindly)
SELECT 'integrity_open_with_confirmed' AS issue, COUNT(*) AS cnt
FROM payment_links pl
WHERE pl.status = 'OPEN'
  AND EXISTS (
    SELECT 1 FROM payment_events pe
    WHERE pe.payment_link_id = pl.id AND pe.event_type = 'PAYMENT_CONFIRMED'
  );

-- Xero: PAID confirmed but no xero_syncs row
SELECT 'xero_missing_sync_row' AS cohort, COUNT(*) AS cnt
FROM payment_links pl
JOIN payment_events pe ON pe.payment_link_id = pl.id AND pe.event_type = 'PAYMENT_CONFIRMED'
WHERE pl.status = 'PAID'
  AND NOT EXISTS (
    SELECT 1 FROM xero_syncs xs WHERE xs.payment_link_id = pl.id
  );

-- =============================================================================
-- Cohort A samples (PAID, no PAYMENT_CONFIRMED)
-- =============================================================================
/*
SELECT pl.id, pl.organization_id, pl.short_code, pl.payment_method, pl.amount, pl.currency,
       pl.created_at, pl.updated_at
FROM payment_links pl
WHERE pl.status = 'PAID'
  AND NOT EXISTS (
    SELECT 1 FROM payment_events pe
    WHERE pe.payment_link_id = pl.id AND pe.event_type = 'PAYMENT_CONFIRMED'
  )
ORDER BY pl.updated_at DESC
LIMIT 25;
*/

-- Cohort A + approved bank confirmation (R3 legacy)
/*
SELECT pl.id AS payment_link_id, pl.organization_id, mbc.id AS confirmation_id, mbc.reviewed_at
FROM payment_links pl
JOIN manual_bank_payment_confirmations mbc ON mbc.payment_link_id = pl.id
WHERE pl.payment_method = 'MANUAL_BANK'
  AND pl.status = 'PAID'
  AND mbc.status = 'APPROVED'
  AND NOT EXISTS (
    SELECT 1 FROM payment_events pe
    WHERE pe.payment_link_id = pl.id AND pe.event_type = 'PAYMENT_CONFIRMED'
  )
LIMIT 25;
*/

-- Cohort A + approved crypto confirmation
/*
SELECT pl.id AS payment_link_id, pl.organization_id, cpc.id AS confirmation_id, cpc.reviewed_at
FROM payment_links pl
JOIN crypto_payment_confirmations cpc ON cpc.payment_link_id = pl.id
WHERE pl.payment_method = 'CRYPTO'
  AND pl.status = 'PAID'
  AND cpc.status = 'APPROVED'
  AND NOT EXISTS (
    SELECT 1 FROM payment_events pe
    WHERE pe.payment_link_id = pl.id AND pe.event_type = 'PAYMENT_CONFIRMED'
  )
LIMIT 25;
*/

-- =============================================================================
-- Cohort C samples (Hedera manual verify metadata)
-- =============================================================================
/*
SELECT pe.id AS payment_event_id, pe.payment_link_id, pe.hedera_transaction_id,
       pe.metadata->>'manuallyVerified' AS manually_verified,
       pe.metadata->>'source' AS meta_source, pe.created_at
FROM payment_events pe
WHERE pe.event_type = 'PAYMENT_CONFIRMED'
  AND (
    pe.metadata->>'manuallyVerified' = 'true'
    OR pe.metadata->>'source' = 'hedera-manual-verify'
  )
ORDER BY pe.created_at DESC
LIMIT 25;
*/

-- =============================================================================
-- Cohort B/F samples (confirmed, referral on link, no obligation)
-- =============================================================================
/*
SELECT pe.id AS payment_event_id, pe.payment_link_id, pl.organization_id, pl.referral_link_id
FROM payment_events pe
JOIN payment_links pl ON pl.id = pe.payment_link_id
WHERE pe.event_type = 'PAYMENT_CONFIRMED'
  AND pl.referral_link_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM commission_obligations co WHERE co.stripe_event_id = pe.id
  )
ORDER BY pe.created_at DESC
LIMIT 25;
*/

-- =============================================================================
-- Per-organization rollup (pilot orgs)
-- =============================================================================
/*
SELECT pl.organization_id,
       SUM(CASE WHEN pl.status = 'PAID' AND NOT EXISTS (
         SELECT 1 FROM payment_events pe
         WHERE pe.payment_link_id = pl.id AND pe.event_type = 'PAYMENT_CONFIRMED'
       ) THEN 1 ELSE 0 END) AS paid_without_confirmed,
       COUNT(DISTINCT pe.id) FILTER (WHERE pe.event_type = 'PAYMENT_CONFIRMED') AS confirmed_events
FROM payment_links pl
LEFT JOIN payment_events pe ON pe.payment_link_id = pl.id
GROUP BY pl.organization_id
ORDER BY paid_without_confirmed DESC;
*/
