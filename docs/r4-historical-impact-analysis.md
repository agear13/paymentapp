# R4 Historical Impact Analysis — Hedera Non-Canonical Settlement

**Date:** 2026-06-04  
**Scope:** Payment link invoices settled via Hedera paths that did **not** fully execute `confirmPayment()` post-commit pipeline.  
**Migration:** Assessment only — no backfill executed.

---

## What “affected” means

A payment link is **historically impacted** if it has evidence of settlement through a divergent Hedera writer **and** is missing one or more canonical downstream artifacts.

| Writer | How to identify | Typical gaps |
|--------|-----------------|--------------|
| **H3 manual verify** | `payment_events.metadata.manuallyVerified = true` OR state transition `source = 'hedera-manual-verify'` | Missing commission obligations/items, missing funding orchestration trace, ledger may differ from `postHederaSettlement` pattern |
| **H4 legacy** | `payment_events` from `confirmHederaPayment` (`source` transition `hedera-payment-confirmation`) | Same; ledger may be missing if `postHederaSettlement` failed silently |
| **H1/H2 canonical** | `metadata.source` in (`hedera-transaction-checker`, confirm route) OR settlement via `confirmPayment` | May still have commission gaps from **B4′** first-run — not R4-specific |

---

## Inventory queries (read-only)

### 1. Manual verify (H3) — primary R4 cohort

```sql
-- Payment links settled via manual mirror verify API
SELECT
  pe.id AS payment_event_id,
  pe.payment_link_id,
  pe.hedera_transaction_id,
  pe.created_at,
  pl.status,
  pl.organization_id,
  pe.metadata->>'manuallyVerified' AS manually_verified,
  pe.metadata->>'source' AS meta_source
FROM payment_events pe
JOIN payment_links pl ON pl.id = pe.payment_link_id
WHERE pe.event_type = 'PAYMENT_CONFIRMED'
  AND pe.payment_method IN ('HEDERA', 'CRYPTO')
  AND (
    pe.metadata->>'manuallyVerified' = 'true'
    OR pe.metadata->>'source' = 'hedera-manual-verify'
  )
ORDER BY pe.created_at DESC;
```

### 2. State transition audit (if `payment_link_state_transitions` or audit table exists)

Search audit/history for:

- `source = 'hedera-manual-verify'`
- `reason = 'verified_on_mirror'`

(Adjust table name to your schema — grep codebase for `hedera-manual-verify`.)

### 3. Legacy `confirmHederaPayment` cohort

```sql
-- Events likely from legacy handler (no manuallyVerified flag, HEDERA method)
SELECT pe.*
FROM payment_events pe
WHERE pe.event_type = 'PAYMENT_CONFIRMED'
  AND pe.payment_method = 'HEDERA'
  AND (pe.metadata->>'manuallyVerified' IS NULL OR pe.metadata->>'manuallyVerified' = 'false')
  AND pe.created_at < '2026-06-04'  -- adjust to confirmPayment Hedera txn deploy date
  AND NOT EXISTS (
    SELECT 1 FROM commission_obligations co
    WHERE co.payment_event_id = pe.id
  );
```

### 4. Canonical gap check (commission / funding)

```sql
-- PAYMENT_CONFIRMED Hedera rows missing commission obligation anchor
SELECT
  pe.id,
  pe.payment_link_id,
  pe.hedera_transaction_id,
  pe.created_at
FROM payment_events pe
LEFT JOIN commission_obligations co ON co.payment_event_id = pe.id
WHERE pe.event_type = 'PAYMENT_CONFIRMED'
  AND pe.payment_method IN ('HEDERA', 'CRYPTO')
  AND co.id IS NULL;
```

```sql
-- Links PAID with Hedera event but no ledger rows (legacy swallow / failed post)
SELECT
  pl.id,
  pe.id AS event_id
FROM payment_links pl
JOIN payment_events pe ON pe.payment_link_id = pl.id
  AND pe.event_type = 'PAYMENT_CONFIRMED'
WHERE pl.status = 'PAID'
  AND NOT EXISTS (
    SELECT 1 FROM ledger_entries le WHERE le.payment_link_id = pl.id
  );
```

### 5. Volume estimate (run in production)

```sql
SELECT
  CASE
    WHEN pe.metadata->>'manuallyVerified' = 'true' THEN 'manual_verify_api'
    WHEN pe.metadata->>'source' = 'hedera-transaction-checker' THEN 'transaction_checker'
    ELSE 'other_hedera'
  END AS settlement_path,
  COUNT(*) AS event_count
FROM payment_events pe
WHERE pe.event_type = 'PAYMENT_CONFIRMED'
  AND pe.payment_method IN ('HEDERA', 'CRYPTO')
GROUP BY 1
ORDER BY event_count DESC;
```

---

## Expected findings by cohort

| Cohort | `PAYMENT_CONFIRMED` | `PAID` | Ledger | Xero queue | Referral conversion | Commission obligations | Funding |
|--------|---------------------|--------|--------|------------|---------------------|------------------------|---------|
| H3 manual verify | ✅ | ✅ | ✅ (inline DR/CR) | Often ✅ (async queue) | Often ✅ | **Often ❌** | **Often ❌** |
| H4 legacy | ✅ | ✅ | ⚠️ partial | Often ✅ | ❌ | **❌** | **❌** |
| H1/H2 canonical | ✅ | ✅ | ✅ (`postHederaSettlement`) | ✅ (txn upsert) | Often ✅ | ⚠️ B4′ gaps | ⚠️ if pilot_deal missing |

---

## Backfill complexity

| Repair action | Complexity | Tooling |
|---------------|------------|---------|
| Commission + items + lines | **Low–Medium** | R5 `reconcileCommissionArtifactsForPaymentEvent(paymentEventId)` per row |
| Funding orchestration | **Low** | Same reconcile with `orchestrateFunding: true` |
| Ledger mismatch (inline vs `postHederaSettlement`) | **High** | Do **not** re-post ledger if entries exist; integrity review only |
| Re-run `confirmPayment` on PAID link | **Medium** | Only if no `PAYMENT_CONFIRMED` or use PAID backfill branch (R3 pattern); **do not** duplicate events |
| Missing ledger (H4 swallow) | **Medium** | `retryLedgerPosting` today — prefer reconcile via canonical rules after R4 |

**Recommended repair order:**

1. Run inventory SQL; record counts by `settlement_path`.  
2. For each `payment_event_id` with gaps: call `reconcileCommissionArtifactsForPaymentEvent` (dry-run first).  
3. Flag rows with ledger imbalance separately (manual finance review).  
4. After R4 deploy: **prevent new H3-style rows**; optional one-time script keyed by `manuallyVerified` cohort.

---

## Repair strategy (hybrid)

| Phase | Action |
|-------|--------|
| **P0** | Deploy R4 — verify route → `confirmPayment` only |
| **P1** | Batch reconcile (R5) on `manuallyVerified` events missing `commission_obligations` |
| **P2** | Sample 10–20 manual-verify links: compare ledger totals to invoice amount |
| **P3** | Deprecate `confirmHederaPayment` / `retryLedgerPosting` for ops runbooks |

**Do not** mass-delete and re-settle PAID links — status is correct; repair **artifacts** only.

---

## Records unlikely to need repair

- Payments settled only via **monitor** or **`/api/hedera/confirm`** after checker migration to `confirmPayment`.  
- Stripe/Wise/manual/bank/crypto-review paths (other remediations).

---

## Migration impact summary

| Area | Impact |
|------|--------|
| Database schema | None required for R4 |
| Existing `PAYMENT_CONFIRMED` rows | Preserved; reconcile adds child rows |
| Customer-visible status | Unchanged (`PAID` remains) |
| Accounting | Xero may already have rows from `queueXeroPaymentSyncIfEnabled`; reconcile does not auto-reverse Xero |

---

## References

- `src/app/api/hedera/transactions/verify/route.ts` — H3 writer  
- `src/lib/referrals/commission-reconcile.server.ts` — R5 repair  
- `docs/r5-repair-design.md` — reconcile semantics  
- `docs/r4-canonical-integration-design.md` — target architecture
