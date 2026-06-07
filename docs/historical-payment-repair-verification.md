# Historical Payment Repair — Verification

**Date:** 2026-06-04

After repair (execute mode), verify each sampled `payment_link_id` matches current architecture expectations.

---

## Verification chain

```text
Payment (PAID)
  → Settlement (PAYMENT_CONFIRMED)
  → Ledger (balanced DR/CR)
  → Commission (obligation + items/lines when referral configured)
  → Funding (pilot deal orchestration when applicable)
  → Xero (xero_syncs PAYMENT row; SUCCESS after cron)
```

---

## SQL verification pack (per link)

Replace `:payment_link_id` and `:payment_event_id`.

```sql
-- 1. Payment
SELECT id, status, payment_method, amount, organization_id
FROM payment_links WHERE id = :payment_link_id;

-- 2. Settlement
SELECT id, event_type, source_reference, payment_method, amount_received,
       hedera_transaction_id, created_at, metadata
FROM payment_events
WHERE payment_link_id = :payment_link_id
ORDER BY created_at;

-- 3. Ledger balance
SELECT currency,
       SUM(CASE WHEN entry_type = 'DEBIT' THEN amount::numeric ELSE 0 END) AS debits,
       SUM(CASE WHEN entry_type = 'CREDIT' THEN amount::numeric ELSE 0 END) AS credits
FROM ledger_entries
WHERE payment_link_id = :payment_link_id
GROUP BY currency;

-- 4. Commission
SELECT co.id, co.status, co.stripe_event_id
FROM commission_obligations co
WHERE co.stripe_event_id = :payment_event_id;

SELECT COUNT(*) AS item_count FROM commission_obligation_items coi
JOIN commission_obligations co ON co.id = coi.obligation_id
WHERE co.stripe_event_id = :payment_event_id;

-- 5. Xero
SELECT id, sync_type, status, retry_count, updated_at
FROM xero_syncs WHERE payment_link_id = :payment_link_id;
```

---

## Expected outcomes by cohort

| Cohort | Payment | Settlement | Ledger | Commission | Funding | Xero |
|--------|---------|------------|--------|------------|---------|------|
| A (after repair) | `PAID` | **Created** 1× | ≥2 rows, balanced | If referral: obligation | If pilot_deal | `PENDING`→`SUCCESS` |
| C (event existed) | `PAID` | Unchanged | Unchanged | Repaired | Orchestrated | Existing or backfill |
| D / E | `PAID` | Created or unchanged | Canonical pattern | Repaired | Orchestrated | Upsert from settle |
| F | `PAID` | Unchanged | Unchanged | **Repaired** | Orchestrated | Unchanged |

---

## API / log verification

| Signal | Pass |
|--------|------|
| `historical_payment_repair_action` log | Action recorded with cohort + dryRun |
| `audit_logs` `HISTORICAL_PAYMENT_REPAIR` | Present for execute mode |
| `commission_repair_repaired` trace | Gaps closed on reconcile |
| No second `PAYMENT_CONFIRMED` on re-run | `alreadyProcessed: true` |

---

## Re-run safety test

```bash
cd src
npx tsx scripts/historical-payment-repair.ts --cohort=A --org-ids=<pilot-org> --limit=10
npx tsx scripts/historical-payment-repair.ts --cohort=A --org-ids=<pilot-org> --limit=10 --execute
npx tsx scripts/historical-payment-repair.ts --cohort=A --org-ids=<pilot-org> --limit=10 --execute
```

Second execute pass should show **skipped** settlement and **complete/skipped** reconcile — no duplicate events or ledger doubling.

---

## Launch financial verification

After batch repair for pilot orgs:

```http
GET /api/internal/launch-financial-verification
Authorization: Bearer <CRON_SECRET>
```

Expect:

- `PAID_WITHOUT_PAYMENT_CONFIRMED` → 0 for repaired orgs (or documented waivers)
- No new `OPEN_WITH_PAYMENT_CONFIRMED`

---

## Sign-off template

| Org | Links repaired | Sample verified | Finance sign-off | Date |
|-----|----------------|-----------------|------------------|------|
| | | | | |
