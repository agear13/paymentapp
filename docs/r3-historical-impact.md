# R3 Historical Impact Assessment

**Date:** 2026-06-04  
**Scope:** Invoices marked `PAID` via legacy bank/crypto `mark_valid` before R3 canonical integration.  
**Migration:** Not performed in R3 — assessment only.

---

## What changed with R3

| Before R3 | After R3 |
|-----------|----------|
| `mark_valid` → `transitionPaymentLinkState` → `PAID` only | `mark_valid` → `executeAssistedReviewSettlement()` → `confirmPayment()` |
| No `PAYMENT_CONFIRMED`, ledger, commission, funding, Xero | Full canonical settlement pipeline |
| Confirmation → `APPROVED` after status flip | Confirmation → `APPROVED` **after** successful `confirmPayment` |

Provider reference formats (new idempotency keys):

- `bank-review:{confirmationId}`
- `crypto-review:{confirmationId}`

---

## Identifying affected historical rows

### Payment links (primary)

Likely legacy review settlements match **all** of:

1. `payment_links.status = 'PAID'`
2. `payment_method IN ('MANUAL_BANK', 'CRYPTO')`
3. Prior assisted flow: link was `PAID_UNVERIFIED` or `REQUIRES_REVIEW` before merchant `mark_valid`
4. **No** `payment_events` row with `event_type = 'PAYMENT_CONFIRMED'` for that `payment_link_id`

Optional corroboration:

- Matching `manual_bank_payment_confirmations` or `crypto_payment_confirmations` with `status = 'APPROVED'` and `reviewed_at` set
- State transition audit / history showing `source` in (`manual-bank-confirmation-review`, `crypto-confirmation-review`) with `reason = merchant_mark_valid` and **no** subsequent `confirmPayment:*` transition

### Suggested SQL (read-only inventory)

```sql
-- Manual bank: PAID without PAYMENT_CONFIRMED
SELECT pl.id AS payment_link_id, pl.organization_id, pl.status, pl.payment_method,
       mbc.id AS confirmation_id, mbc.status AS confirmation_status, mbc.reviewed_at
FROM payment_links pl
JOIN manual_bank_payment_confirmations mbc ON mbc.payment_link_id = pl.id
WHERE pl.payment_method = 'MANUAL_BANK'
  AND pl.status = 'PAID'
  AND mbc.status = 'APPROVED'
  AND NOT EXISTS (
    SELECT 1 FROM payment_events pe
    WHERE pe.payment_link_id = pl.id AND pe.event_type = 'PAYMENT_CONFIRMED'
  );

-- Crypto: same pattern
SELECT pl.id AS payment_link_id, pl.organization_id, pl.status, pl.payment_method,
       cpc.id AS confirmation_id, cpc.status AS confirmation_status, cpc.reviewed_at
FROM payment_links pl
JOIN crypto_payment_confirmations cpc ON cpc.payment_link_id = pl.id
WHERE pl.payment_method = 'CRYPTO'
  AND pl.status = 'PAID'
  AND cpc.status = 'APPROVED'
  AND NOT EXISTS (
    SELECT 1 FROM payment_events pe
    WHERE pe.payment_link_id = pl.id AND pe.event_type = 'PAYMENT_CONFIRMED'
  );
```

Run against production/staging with appropriate read replica; counts only — no writes in R3.

---

## Is backfill required?

| Concern | Impact without backfill |
|---------|-------------------------|
| Accounting / ledger | Revenue and clearing entries missing for affected PAID links |
| Commission / referrals | No conversion or revenue-share artifacts tied to settlement truth |
| Funding orchestration | Merchant funding may not have run for those invoices |
| Xero sync | No `xero_syncs` upsert from settlement txn |
| Reporting | Dashboard “paid” count correct; financial truth incomplete |

**Recommendation:** Backfill is **recommended** for any non-trivial count of production rows, but **not blocking** R3 deploy if volume is small and finance accepts a one-time repair window.

R3 enables repair without changing status again: `confirmPayment` accepts links already `PAID` with no `PAYMENT_CONFIRMED` and backfills settlement artifacts (no duplicate status transition).

---

## Estimated repair strategy (no migration in R3)

### Option 1 — Per-link scripted repair (preferred)

For each row from inventory:

1. Resolve latest `APPROVED` confirmation id for the link.
2. Call `executeAssistedReviewSettlement({ confirmationId, rail, actorUserId: 'system-r3-backfill' })` **or** invoke `confirmPayment` directly with:
   - `provider: 'manual'`
   - `providerRef`: `bank-review:{id}` or `crypto-review:{id}`
   - `amountReceived` / `currencyReceived` from invoice (same as live R3)
3. Verify: one `PAYMENT_CONFIRMED`, ledger rows, commission reconcile (R5), funding trace, Xero queue row.
4. Idempotent replays safe via existing guards.

**Note:** Confirmation may already be `APPROVED` (not `SUBMITTED`). The adapter’s idempotent path for non-`SUBMITTED` + existing `PAYMENT_CONFIRMED` applies after first successful repair; for first repair, either temporarily allow `APPROVED` confirmations in a dedicated backfill entrypoint or call `confirmPayment` directly by `paymentLinkId` with the stable `providerRef`.

### Option 2 — Operator-triggered repair

Expose internal ops tool listing “PAID without PAYMENT_CONFIRMED” for MANUAL_BANK/CRYPTO; operator runs repair once per link. Lower automation risk, higher labor.

### Option 3 — Do nothing

Acceptable only if inventory query returns **zero** rows in production or immaterial pilot volume.

---

## Risks during backfill

| Risk | Mitigation |
|------|------------|
| Duplicate settlement | `PAYMENT_CONFIRMED` per-link guard + `checkManualIdempotency` + stable `providerRef` |
| Wrong amount | Use invoice `amount` / `invoice_currency`, not payer-submitted fields |
| Double commission | R5 `reconcileCommissionArtifactsForPaymentEvent` on idempotent replay |
| Status regression | Backfill does not transition away from `PAID` |

---

## What R3 does **not** fix automatically

- Rows already `PAID` with missing artifacts remain until a backfill job or manual repair runs.
- Payer submission paths (`PAID_UNVERIFIED` / `REQUIRES_REVIEW`) are unchanged — only **review approval** is canonical.
- Hedera on-chain verification for crypto (`provider: 'hedera'`) remains out of scope; R3 uses manual clearing rail like R1.

---

## Post-deploy verification

1. New `mark_valid` → logs `bank_review_settlement_*` / `crypto_review_settlement_*` completed.
2. New approvals → exactly one `PAYMENT_CONFIRMED` per link.
3. Historical inventory query trend → zero new rows matching “PAID without event” after cutover date.
