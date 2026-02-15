# Referral Commission (Option B) – Implementation Guide

## Overview

Commission-enabled referral links that open a Stripe Checkout flow. On successful payment, ledger entries are posted for consultant and BD partner commissions.

## Main Files Changed

| File | Purpose |
|------|---------|
| `src/prisma/schema.prisma` | Added `referral_links`, `referral_rules`, `commission_obligations` |
| `src/prisma/migrations/20260215000000_add_referral_commission_tables/migration.sql` | Migration SQL |
| `src/lib/ledger/account-mapping.ts` | Added 6105 (Commission Expense), 2110 (Consultant Payable), 2120 (BD Partner Payable) |
| `src/lib/ledger/ledger-account-provisioner.ts` | `provisionCommissionLedgerAccounts()` |
| `src/lib/referrals/referral-checkout.ts` | `createReferralCheckoutSession()` |
| `src/lib/referrals/commission-posting.ts` | `applyRevenueShareSplits()`, `extractReferralMetadata()` |
| `src/app/r/[code]/page.tsx` | Prisma referral link → redirect to Stripe checkout |
| `src/app/api/referral/[code]/checkout/route.ts` | POST API for referral checkout |
| `src/app/api/referral-links/route.ts` | POST API to create referral links |
| `src/app/api/commissions/obligations/route.ts` | GET commission obligations |
| `src/app/api/commissions/ledger-entries/route.ts` | GET commission ledger entries |
| `src/app/api/stripe/webhook/route.ts` | Calls `applyRevenueShareSplits` after `confirmPayment` |

## How to Create a Referral Link and Test End-to-End

### 1. Run Migration

```bash
cd src
npx prisma migrate deploy
```

### 2. Create a Referral Link (API)

```bash
curl -X POST http://localhost:3000/api/referral-links \
  -H "Content-Type: application/json" \
  -H "Cookie: <your-auth-cookie>" \
  -d '{
    "organizationId": "<org-uuid>",
    "code": "REF001",
    "consultantId": "<consultant-user-uuid>",
    "bdPartnerId": "<bd-partner-uuid>",
    "consultantPct": 0.20,
    "bdPartnerPct": 0.05,
    "checkoutConfig": {
      "amount": 100,
      "currency": "USD",
      "description": "Test referral payment"
    }
  }'
```

### 3. Test the Flow

1. Visit `https://your-app.com/r/REF001` (or `http://localhost:3000/r/REF001`)
2. You should be redirected to Stripe Checkout
3. Complete payment with test card `4242 4242 4242 4242`
4. Webhook will:
   - Mark payment link PAID
   - Post Stripe settlement (1050, 1200, 6100)
   - Post commission entries (6105 Commission Expense, 2110 Consultant Payable, 2120 BD Partner Payable)

### 4. Alternative: Create via SQL (for quick testing)

```sql
-- Get an organization_id and create a referral link
INSERT INTO referral_links (id, organization_id, code, status, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  '<your-org-id>',
  'REF001',
  'ACTIVE',
  NOW(),
  NOW()
);

-- Add a rule (use the referral_link_id from above)
INSERT INTO referral_rules (id, referral_link_id, consultant_id, bd_partner_id, consultant_pct, bd_partner_pct, basis, created_at)
VALUES (
  gen_random_uuid(),
  '<referral-link-id>',
  '<consultant-uuid>',
  '<bd-partner-uuid>',
  0.20,
  0.05,
  'GROSS',
  NOW()
);
```

## Example SQL Queries to Verify Commissions

### Commission obligations by payment

```sql
SELECT
  co.id,
  co.payment_link_id,
  co.referral_link_id,
  co.stripe_event_id,
  co.consultant_amount,
  co.bd_partner_amount,
  co.currency,
  co.status,
  co.created_at,
  pl.short_code,
  pl.invoice_reference
FROM commission_obligations co
JOIN payment_links pl ON pl.id = co.payment_link_id
WHERE co.status = 'POSTED'
ORDER BY co.created_at DESC
LIMIT 20;
```

### Commission ledger entries

```sql
SELECT
  le.id,
  le.payment_link_id,
  la.code,
  la.name,
  le.entry_type,
  le.amount,
  le.currency,
  le.idempotency_key,
  le.created_at
FROM ledger_entries le
JOIN ledger_accounts la ON la.id = le.ledger_account_id
WHERE le.idempotency_key LIKE 'commission-%'
ORDER BY le.created_at DESC
LIMIT 20;
```

### Commission obligations by consultant

```sql
SELECT
  rr.consultant_id,
  SUM(co.consultant_amount) AS total_consultant_commission,
  co.currency,
  COUNT(*) AS obligation_count
FROM commission_obligations co
JOIN referral_links rl ON rl.id = co.referral_link_id
JOIN referral_rules rr ON rr.referral_link_id = rl.id
WHERE co.status = 'POSTED'
GROUP BY rr.consultant_id, co.currency;
```

### Commission obligations by BD partner

```sql
SELECT
  rr.bd_partner_id,
  SUM(co.bd_partner_amount) AS total_bd_commission,
  co.currency,
  COUNT(*) AS obligation_count
FROM commission_obligations co
JOIN referral_links rl ON rl.id = co.referral_link_id
JOIN referral_rules rr ON rr.referral_link_id = rl.id
WHERE co.status = 'POSTED' AND rr.bd_partner_id IS NOT NULL
GROUP BY rr.bd_partner_id, co.currency;
```

## Idempotency

- Ledger entries use keys: `commission-{stripeEventId}-consultant-0/1`, `commission-{stripeEventId}-bd-0/1`
- `commission_obligations` has unique constraint on `stripe_event_id`
- Webhook retries do not create duplicate commission entries

## Failure Handling

- Commission posting is **best-effort**: payment is still marked PAID even if commission fails
- On failure, a `SYSTEM_ALERT` notification is created
- Webhook returns 200 so Stripe does not retry for commission-only failures
