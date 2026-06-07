# Historical Payment Repair — Analysis

**Date:** 2026-06-04  
**Scope:** Pre-R1 / R3 / R4 / R5 production data only. Forward path unchanged.

---

## Objective

Identify cohorts where invoices were marked paid or partially settled **without** the current canonical pipeline (`confirmPayment` → commission → funding → Xero).

---

## Cohort definitions

### Cohort A — PAID without `PAYMENT_CONFIRMED`

| Attribute | Value |
|-----------|--------|
| **Detection** | `payment_links.status = 'PAID'` and no `payment_events` with `event_type = 'PAYMENT_CONFIRMED'` |
| **Typical causes** | Legacy status API (pre-R2), R11 repair utilities, assisted `mark_valid` pre-R3, inline Hedera verify pre-R4 |
| **Symptoms** | No settlement truth, no ledger from canonical path, no commission anchor, no Xero upsert from settlement |
| **Repair path** | `confirmPayment()` backfill (link already PAID — no duplicate transition) |

### Cohort B — `PAYMENT_CONFIRMED` with incomplete commission artifacts

| Attribute | Value |
|-----------|--------|
| **Detection** | `detectCommissionArtifactGaps()` returns repairable gaps |
| **Typical causes** | B4′ first-run skip, non-blocking commission failure, pre-R5 idempotent replay without reconcile |
| **Symptoms** | Missing `commission_obligations`, `obligation_items`, `lines`, or commission ledger batches |
| **Repair path** | `reconcileCommissionArtifactsForPaymentEvent()` only |

### Cohort C — Hedera manual verify (pre-R4)

| Attribute | Value |
|-----------|--------|
| **Detection** | `PAYMENT_CONFIRMED` with `metadata.manuallyVerified = true` OR `source = hedera-manual-verify` OR inline transition `hedera-manual-verify` |
| **Subset A** | PAID + no event → settle via `confirmPayment` with `hedera_transaction_id` from sibling events |
| **Subset B** | Event exists → commission/funding reconcile only |
| **Repair path** | Settlement if A; else R5 reconcile |

### Cohort D — Bank/crypto review (pre-R3)

| Attribute | Value |
|-----------|--------|
| **Detection** | `MANUAL_BANK` / `CRYPTO` + `APPROVED` confirmation + (A) no `PAYMENT_CONFIRMED`; OR (B) ref `bank-review:` / `crypto-review:` with commission gaps |
| **Symptoms** | PAID without ledger/commission; or confirmed without full downstream |
| **Repair path** | `confirmPayment({ provider: 'manual', providerRef: bank-review|crypto-review:{id} })` |

### Cohort E — Manual settlement (pre-R1)

| Attribute | Value |
|-----------|--------|
| **Detection** | `source_reference LIKE 'manual-settlement:%'` OR operator manual path without full artifacts |
| **Subset A** | PAID without event → `manual-settlement:{paymentLinkId}` |
| **Repair path** | `confirmPayment` or reconcile per A/B |

### Cohort F — R5 partial propagation

| Attribute | Value |
|-----------|--------|
| **Detection** | Same as B — `detectCommissionArtifactGaps` with gaps in `NO_COMMISSION_OBLIGATIONS_ROW`, `NO_COMMISSION_OBLIGATION_ITEMS`, `MISSING_COMMISSION_OBLIGATION_LINES`, `MISSING_COMMISSION_LEDGER` |
| **Repair path** | `reconcileCommissionArtifactsForPaymentEvent({ orchestrateFunding: true })` |

---

## Repair priority (execution order)

1. **Cohort A** (and A-shaped D/E) — establish `PAYMENT_CONFIRMED` + ledger + Xero queue via `confirmPayment`
2. **Cohorts B, C, D, E, F** — commission + funding via R5 reconcile (no second settlement)

---

## Automation assessment

| Cohort | Fully automated? | Notes |
|--------|------------------|-------|
| A | **Mostly** | Requires inferrable provider ref (bank/crypto confirmation, hedera tx, stripe PI, or synthetic manual-settlement) |
| B / F | **Yes** | R5 reconcile when metadata supports commission |
| C | **Mostly** | Settlement sub-cohort needs hedera tx on any event |
| D | **Mostly** | Needs `APPROVED` confirmation row |
| E | **Yes** | `manual-settlement:{linkId}` stable ref |

**Manual review required:** OPEN+CONFIRMED integrity rows, Wise without transfer id, zero-amount links, test/sandbox orgs.

---

## Tooling

| Artifact | Role |
|----------|------|
| `docs/historical-payment-inventory.sql` | Read-only counts/samples |
| `src/scripts/historical-payment-repair.ts` | Dry-run (default) / execute (imports `.core` + server-only stub) |
| `src/lib/payments/historical-payment-repair.core.ts` | Core logic (runtime-safe) |
| `src/lib/payments/historical-payment-repair.server.ts` | Next.js re-export with `server-only` |

---

## References

- `docs/r3-historical-impact.md`
- `docs/r4-historical-impact-analysis.md`
- `docs/r5-repair-design.md` (if present)
- `src/lib/referrals/commission-reconcile.server.ts`
