# Test: Auto Payment Conversion

This document describes how to verify the automatic referral conversion flow when a payment is finalized.

## Overview

When a payment is confirmed (`PAYMENT_CONFIRMED`), the system automatically:

1. Creates a `referral_conversions` row with `conversion_type='payment_completed'` and `status='approved'`
2. Calls `createPartnerLedgerEntryForReferralConversion` to write `partner_ledger_entries` (owner/advocate/consultant)
3. Uses `external_ref = 'payment_event:' + payment_events.id` for idempotency (webhook retries don't create duplicates)

## Prerequisites

- Stripe webhook configured: `POST /api/stripe/webhook`
- Supabase migration applied: `20260213_referral_conversion_external_ref.sql`
- Referral program seeded (e.g. `consultant-referral` with DEMO-BD, DEMO-CONSULTANT, DEMO-ADVOCATE)
- Partner program with slug matching referral program

## Test 1: Create Payment Link with Referral Attribution

### Option A: Insert into `payment_link_referral_attributions`

Before the customer pays, insert attribution for the payment link:

```sql
-- In Supabase (or your Postgres if payment_link_referral_attributions is there)
-- Get program_id and consultant participant_id from referral_programs and referral_participants
INSERT INTO payment_link_referral_attributions (payment_link_id, program_id, participant_id, advocate_referral_code)
VALUES (
  '<YOUR_PAYMENT_LINK_UUID>',
  (SELECT id FROM referral_programs WHERE slug = 'consultant-referral' LIMIT 1),
  (SELECT id FROM referral_participants WHERE referral_code = 'DEMO-CONSULTANT' LIMIT 1),
  'DEMO-ADVOCATE'  -- optional: if conversion came via advocate link
);
```

### Option B: Stripe Metadata (when creating checkout/payment intent)

If the create-checkout-session or create-payment-intent routes accept and pass referral metadata, add:

- `referral_program_slug`: `consultant-referral`
- `advocate_referral_code`: `DEMO-ADVOCATE` (optional)
- `consultant_participant_id`: `<consultant participant uuid>` (optional if advocate_referral_code provided)

## Test 2: Complete Payment

1. Create a payment link (via dashboard or API)
2. Add attribution (Option A or B above)
3. Complete payment via Stripe Checkout or PaymentIntent
4. Stripe sends `payment_intent.succeeded` or `checkout.session.completed` webhook

## Test 3: Verify `referral_conversions` Row

```sql
SELECT id, program_id, participant_id, conversion_type, gross_amount, currency, status, approved_by, external_ref, proof_json
FROM referral_conversions
WHERE conversion_type = 'payment_completed'
ORDER BY created_at DESC
LIMIT 5;
```

Expected:

- `conversion_type` = `payment_completed`
- `status` = `approved`
- `approved_by` = `system_auto`
- `external_ref` = `payment_event:<uuid>` (payment_events.id)
- `proof_json` contains `payment_link_id`, `payment_event_id`, `provider`, `stripe_payment_intent_id` (Stripe), `hedera_transaction_id` (Hedera)

## Test 4: Verify `partner_ledger_entries` (3 rows)

```sql
SELECT ple.id, ple.entity_id, ple.earnings_amount, ple.currency, ple.description, ple.source_ref
FROM partner_ledger_entries ple
WHERE ple.source = 'referral'
  AND ple.source_ref = '<CONVERSION_ID_FROM_ABOVE>'
ORDER BY ple.earnings_amount DESC;
```

Expected: 3 rows (or 2 if advocate has 0% share):

- BD Partner (owner) commission
- Client Advocate commission (if via advocate link)
- Consultant remainder

## Test 5: Idempotency on Webhook Retry

1. Trigger the same Stripe webhook event again (e.g. "Resend" from Stripe Dashboard)
2. Query `referral_conversions` – there should still be **one** row for that `external_ref` (same `payment_events.id`)
3. Query `partner_ledger_entries` – no duplicate entries (idempotency via `source_ref` + `entity_id`)

**Idempotency key**: `external_ref` = `payment_event:` + `payment_events.id` uuid. Fallback when paymentEventId not provided: `stripe_pi:` + `stripe_payment_intent_id` or `hedera_tx:` + `hedera_transaction_id`.

## Test 6: No Attribution = No Conversion

1. Create a payment link **without** attribution
2. Complete payment
3. No `referral_conversions` row should be created
4. Logs should show: `[REFERRAL_AUTO_CONVERSION] skip: no referral attribution`

## Troubleshooting

| Issue | Check |
|-------|--------|
| No conversion created | `payment_link_referral_attributions` has row for payment_link_id? Or metadata passed? |
| Conversion created but no ledger | `referral_partner_entity_map` has entries for participants? `partner_programs` has slug matching `referral_programs.slug`? |
| Duplicate conversions | `external_ref` unique index applied? Check `idx_referral_conversions_external_ref_unique` |
| Payment fails | Referral conversion errors are non-blocking; check logs for `[REFERRAL_AUTO_CONVERSION]` |
