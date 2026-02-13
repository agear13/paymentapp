# Debug: Auto Conversion (Render Postgres → Supabase)

When a payment is finalized (PAYMENT_CONFIRMED in Render Postgres), the system auto-creates a referral conversion in Supabase if attribution exists. This doc helps debug the flow.

## Data Flow

1. **Render Postgres**: `payment_events` (event_type=PAYMENT_CONFIRMED), `payment_links` (status=PAID)
2. **Supabase**: `payment_link_referral_attributions` (attribution lookup)
3. **Supabase**: `referral_conversions` (conversion row)
4. **Supabase**: `partner_ledger_entries` (ledger entries)

## Debug Queries

### 1. Find latest PAYMENT_CONFIRMED in Render Postgres

```sql
-- Run in Render Postgres
SELECT id, payment_link_id, event_type, payment_method, amount_received, currency_received,
       stripe_payment_intent_id, hedera_transaction_id, created_at
FROM payment_events
WHERE event_type = 'PAYMENT_CONFIRMED'
ORDER BY created_at DESC
LIMIT 5;
```

Save `id` (uuid) and `payment_link_id` for the next steps.

### 2. Confirm attribution exists in Supabase for that payment_link_id

```sql
-- Run in Supabase
SELECT payment_link_id, program_id, participant_id, advocate_referral_code, created_at
FROM payment_link_referral_attributions
WHERE payment_link_id = '<PAYMENT_LINK_UUID>'
ORDER BY created_at DESC
LIMIT 1;
```

If no rows: attribution missing → conversion will not be created (expected).

### 3. Check referral_conversions.external_ref

```sql
-- Run in Supabase
SELECT id, program_id, participant_id, conversion_type, gross_amount, currency, status,
       approved_by, external_ref, proof_json, created_at
FROM referral_conversions
WHERE external_ref = 'payment_event:<PAYMENT_EVENT_UUID>'
   OR external_ref LIKE 'payment_event:%';
```

Replace `<PAYMENT_EVENT_UUID>` with the `payment_events.id` from step 1.

### 4. Check partner_ledger_entries for that conversion

```sql
-- Run in Supabase
-- source_ref = conversion id (referral_conversions.id)
SELECT id, program_id, entity_id, source, source_ref, status, gross_amount, earnings_amount, currency, description
FROM partner_ledger_entries
WHERE source = 'referral'
  AND source_ref = '<CONVERSION_ID>'
ORDER BY earnings_amount DESC;
```

Get `<CONVERSION_ID>` from the `referral_conversions.id` in step 3.

### 5. End-to-end (manual steps)

1. Run query 1 in **Render Postgres** → get `payment_event_id` and `payment_link_id`
2. Run query 2 in **Supabase** with that `payment_link_id` → verify attribution exists
3. Run query 3 in **Supabase** with `external_ref = 'payment_event:' || payment_event_id` → get conversion
4. Run query 4 in **Supabase** with conversion `id` as `source_ref` → verify ledger entries

Render and Supabase are separate databases; run each query in the correct DB.

## Manual Attribution Insert (for testing)

```sql
-- Supabase: insert attribution for a known payment_link_id
INSERT INTO payment_link_referral_attributions (payment_link_id, program_id, participant_id, advocate_referral_code)
VALUES (
  '<PAYMENT_LINK_UUID>',
  (SELECT id FROM referral_programs WHERE slug = 'consultant-referral' LIMIT 1),
  (SELECT id FROM referral_participants WHERE referral_code = 'DEMO-CONSULTANT' LIMIT 1),
  'DEMO-ADVOCATE'  -- optional
)
ON CONFLICT (payment_link_id) DO UPDATE SET
  program_id = EXCLUDED.program_id,
  participant_id = EXCLUDED.participant_id,
  advocate_referral_code = EXCLUDED.advocate_referral_code;
```

## Acceptance Checklist

1. Insert attribution in Supabase for a known `payment_link_id`
2. Trigger PAYMENT_CONFIRMED (Stripe webhook or manual)
3. Confirm `referral_conversions` row with `external_ref = 'payment_event:<payment_event_uuid>'`
4. Confirm `partner_ledger_entries` for that conversion
5. Re-run webhook → no duplicate conversion (idempotent skipped)
