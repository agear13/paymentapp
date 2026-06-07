# Historical Payment Repair — Safety Analysis

**Date:** 2026-06-04

All repairs reuse **existing** idempotent services. No bespoke ledger math in the repair tool.

---

## Safeguards (all cohorts)

| Safeguard | Mechanism |
|-----------|-----------|
| Default dry-run | CLI without `--execute` |
| Per-link `PAYMENT_CONFIRMED` guard | `confirmPayment` txn checks existing confirmed event |
| Provider idempotency | Stripe event / Hedera tx / manual `providerRef` / per-link manual settlement |
| Commission idempotency | Obligation keyed by `stripe_event_id` = `payment_event_id`; ledger keys `commission-{eventId}-*` |
| Audit trail | `audit_logs` + JSON audit file + structured logs |
| No forward-path edits | Repair module and script only |

---

## Per-cohort risk matrix

### Cohort A — `confirmPayment` backfill

| Risk | Level | Mitigation |
|------|-------|------------|
| Duplicate settlement | **Low** | Per-link confirmed guard; PAID backfill branch |
| Duplicate commission | **Low** | Runs inside `confirmPayment` once |
| Duplicate funding | **Low** | Single orchestration post-settlement |
| Duplicate Xero | **Low** | `xero_syncs` upsert unique on `(payment_link_id, sync_type)` |
| Wrong provider ref | **Medium** | Inventory + dry-run; prefer confirmation/tx-derived refs over synthetic |

### Cohorts B, C, D, E, F — R5 reconcile only

| Risk | Level | Mitigation |
|------|-------|------------|
| Duplicate settlement | **None** | No `confirmPayment` when event exists |
| Duplicate commission | **Low** | `obligation_exists` / skip existing items; idempotent ledger keys |
| Duplicate funding | **Low** | Funding orchestration idempotent per deal rules |
| Duplicate Xero | **None** | Reconcile does not enqueue new settlement syncs |
| Incomplete metadata | **Medium** | Skipped with `INCOMPLETE_COMMISSION_METADATA` — manual review |

---

## Duplicate settlement risk

**Rule:** Never call `confirmPayment` when `PAYMENT_CONFIRMED` already exists for the link.

The repair tool:

1. Processes settlement queue only for inventory rows with `plannedAction = settlement_confirm_payment`
2. `repairSettlementForLink` re-checks before invoke
3. `confirmPayment` early-returns `alreadyProcessed` if provider idempotency hits

**Do not run** on `OPEN_WITH_PAYMENT_CONFIRMED` integrity rows without Eng review.

---

## Duplicate commission risk

`reconcileCommissionArtifactsForPaymentEvent`:

- Creates obligation only if missing (`obligation_created` vs `obligation_exists`)
- Posts ledger only if `commission-{rootId}-*` batch absent
- Skips when expectation is below minimum or metadata incomplete

**Safe to re-run** on same `payment_event_id`.

---

## Duplicate funding risk

`orchestrateFundingAfterInvoiceSettlement` is invoked with `orchestrateFunding: true` on reconcile. Treat as idempotent for pilot deals; monitor logs on second run.

---

## Duplicate Xero risk

- Settlement backfill upserts at most one `PAYMENT` sync row per link (unique constraint).
- Reconcile path does not create duplicate settlement enqueue.
- Org backfill button is separate; run only after settlement exists.

---

## Recommended operational safeguards

1. Run `historical-payment-inventory.sql` on read replica; record counts.
2. Dry-run full repair: `npx tsx scripts/historical-payment-repair.ts --before=<deploy-date>`
3. Execute **Cohort A** in batches (`--limit=25`) per pilot org.
4. Re-run inventory SQL — `paid_without_confirmed` should trend to zero for pilot orgs.
5. Execute **Cohort F** reconcile in batches.
6. Verify sample links per [historical-payment-repair-verification.md](./historical-payment-repair-verification.md)
7. **Ban** `repair-utilities` STATUS_MISMATCH repair during this initiative

---

## Rollback

There is **no automatic rollback**. If a wrong repair occurs:

- Do not delete `PAYMENT_CONFIRMED` in production without Eng/Finance sign-off
- Use targeted R5 dry-run to assess duplicate artifacts
- Stripe/Hedera provider refs are stable — duplicate settlement should not occur if guards hold

---

## When to skip (tool will skip or fail safely)

| Condition | Behavior |
|-----------|----------|
| Link not `PAID` (cohort A) | Skip settlement |
| `PAYMENT_CONFIRMED` already exists (cohort A) | Skip settlement |
| No referral metadata | Reconcile skipped (`INCOMPLETE_COMMISSION_METADATA`) |
| Commission below minimum | Reconcile skipped |
| Cannot resolve provider evidence | Settlement error; remains in audit JSON |
