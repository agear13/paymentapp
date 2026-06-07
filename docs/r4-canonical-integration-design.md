# R4 Canonical Integration Design — Hedera Settlement

**Date:** 2026-06-04  
**Goal:** Converge all Hedera **invoice payment link** settlement through `confirmPayment({ provider: 'hedera' })` without changing ledger math, commission formulas, or settlement calculations.  
**Status:** Design only — no implementation.

---

## Problem statement

Launch readiness **R4** flags **Hedera manual mirror verify** as a split-brain settlement writer. Two paths already use `confirmPayment`; one primary production UI path and one legacy library path do **not**.

**Risk:** `PAYMENT_CONFIRMED` + `PAID` + partial ledger/referral/Xero without `applyRevenueShareSplits`, `orchestrateFundingAfterInvoiceSettlement`, or R5 commission reconcile.

---

## Step 1 — Hedera payment paths (inventory)

### Canonical (uses `confirmPayment`)

| # | Entry point | File | Function / handler | Typical caller | Purpose |
|---|-------------|------|-------------------|----------------|---------|
| **H1** | `POST /api/hedera/confirm` | `src/app/api/hedera/confirm/route.ts` | `POST` | Wallet/client after tx detection (older flow) | Mirror-fetch tx by id; amount tolerance; `confirmPayment({ provider: 'hedera' })` |
| **H2** | Transaction checker persist | `src/lib/hedera/transaction-checker.ts` | `persistTransactionToPaymentLink` (internal) | `checkForTransaction()` ← monitor API | Mirror search match; `confirmPayment({ provider: 'hedera' })` |
| **H2a** | `POST /api/hedera/transactions/monitor` | `src/app/api/hedera/transactions/monitor/route.ts` | `POST` | `hedera-payment-option.tsx` polling | Public payer UI; delegates to H2 |

### Divergent (does **not** use `confirmPayment`)

| # | Entry point | File | Function | Typical caller | Purpose |
|---|-------------|------|----------|----------------|---------|
| **H3** | `POST /api/hedera/transactions/verify` | `src/app/api/hedera/transactions/verify/route.ts` | `POST` | `hedera-payment-option.tsx` `handleDirectVerification` | Operator/payer retry when monitor times out; **inline** txn: PAID + event + FX + ledger |
| **H4** | `confirmHederaPayment` | `src/lib/hedera/payment-confirmation.ts` | `confirmHederaPayment` | `batchConfirmHederaPayments` only | Legacy Sprint-era handler; **no route** calls batch today |
| **H4a** | `retryLedgerPosting` | same file | `retryLedgerPosting` | `src/lib/data/repair-utilities.ts` | Repair orphan Hedera events missing ledger |

### Related but **out of R4 scope** (not payment-link settlement IN)

| Entry | File | Note |
|-------|------|------|
| `POST /api/payout-batches/[id]/hedera/confirm` | payout batch Hedera | Outbound partner payouts, not `confirmPayment` invoice IN |
| `POST /api/payout-batches/[id]/hedera/prepare` | prepare Hedera payout | Same |
| FX / mirror read APIs | `balances`, `transactions/[id]`, `payment-amounts` | Read-only |
| `lib/fx/providers/hedera-mirror.ts` | FX pricing | Not settlement |

### UI routing (which API wins)

| User action | Primary API | Settlement path |
|-------------|-------------|-------------------|
| Wallet pay + polling monitor | `/api/hedera/transactions/monitor` | **H2 → confirmPayment** ✅ |
| Wallet pay + direct tx id verify (retry UI) | `/api/hedera/transactions/verify` | **H3 inline** ❌ |
| Legacy explicit confirm | `/api/hedera/confirm` | **H1 → confirmPayment** ✅ |

**Production concern:** `hedera-payment-option.tsx` uses **both** monitor (canonical) and verify (divergent) depending on flow branch.

---

## Step 2 — State transition analysis

### H1 — `/api/hedera/confirm`

| Stage | Value |
|-------|--------|
| **Initial** | `OPEN` only (returns 400 otherwise) |
| **Result** | `PAID` via `confirmPayment` state machine |
| **Event** | `PAYMENT_CONFIRMED` (`source_type: CRYPTO`, `hedera_transaction_id`) |
| **Ledger** | `postHederaSettlement` inside `confirmPayment` txn |
| **Post-commit** | Commission, funding, Xero upsert (in txn), R5 reconcile on replay |

### H2 — Monitor + transaction checker

| Stage | Value |
|-------|--------|
| **Initial** | Typically `OPEN` (monitor returns early if already `PAID`) |
| **Result** | `PAID` via `confirmPayment` |
| **Idempotency** | By `hedera_transaction_id` / `correlation_id` before persist |
| **Note** | If link already `PAID`, persist returns success **without** calling `confirmPayment` (no backfill) |

### H3 — Manual verify API (**divergent**)

| Stage | Value |
|-------|--------|
| **Initial** | Any non-PAID link with valid mirror tx (no explicit OPEN-only guard in route) |
| **Result** | `PAID` via `transitionPaymentLinkState` (`source: hedera-manual-verify`) |
| **Event** | `PAYMENT_CONFIRMED` created inline (`payment_method: HEDERA`; limited schema vs canonical) |
| **Ledger** | Manual `ledger_entries` DR/CR via `ensureLedgerAccounts` — **not** `postHederaSettlement` in shared service txn |
| **FX** | `fx_snapshots` SETTLEMENT row created inline |
| **Referral** | `createReferralConversionFromPaymentConfirmed` only |
| **Commission** | **No** `applyRevenueShareSplits` |
| **Funding** | **No** `orchestrateFundingAfterInvoiceSettlement` |
| **Xero** | `queueXeroPaymentSyncIfEnabled` post-txn (not `xero_syncs` upsert inside same atomic block as `confirmPayment`) |
| **Replay** | **No** R5 `reconcileCommissionArtifactsForPaymentEvent` on idempotent return |

### H4 — `confirmHederaPayment` (legacy)

| Stage | Value |
|-------|--------|
| **Initial** | Validated via `validatePaymentAttempt` (typically `OPEN`) |
| **Result** | `PAID` in txn |
| **Event** | `PAYMENT_CONFIRMED` in txn |
| **Ledger** | `postHederaSettlement` **after** txn; errors **swallowed** (payment stays confirmed) |
| **Commission / funding** | **None** |

---

## Lifecycle diagram (intended vs today)

```text
Payer opens Hedera invoice (payment_links.payment_method = CRYPTO, status OPEN)
        │
        ├─► [Monitor poll] POST /hedera/transactions/monitor
        │         └─► checkForTransaction → confirmPayment(hedera)  ✅ CANONICAL
        │
        ├─► [Direct verify] POST /hedera/transactions/verify
        │         └─► inline PAID + PAYMENT_CONFIRMED + ledger  ❌ R4 GAP
        │
        └─► [Legacy] POST /hedera/confirm
                  └─► confirmPayment(hedera)  ✅ CANONICAL
```

---

## Step 3 — Comparison to canonical `confirmPayment()` pipeline

| Step | Canonical `confirmPayment` | H3 verify | H4 legacy |
|------|---------------------------|-----------|-----------|
| Money received evidence | `providerRef` = normalized tx id | Mirror tx + memo match | Params from caller |
| `PAYMENT_CONFIRMED` | Yes, full metadata + org + source_type | Yes, partial fields | Yes, minimal fields |
| `confirmPayment()` | **Yes** | **No** | **No** |
| State → `PAID` | In txn, allowed entry states (OPEN, etc.) | `transitionPaymentLinkState` only | In txn |
| FX SETTLEMENT snapshot | `ensureSettlementFxSnapshot` + Hedera rate in txn | Inline `fx_snapshots.create` | Expects pre-existing snapshot (often fails ledger) |
| Ledger | `postHederaSettlement(..., tx)` atomic | Inline two `ledger_entries` | `postHederaSettlement` post-txn, non-atomic |
| Xero queue | `xero_syncs` upsert in txn | `queueXeroPaymentSyncIfEnabled` after | `queueXeroPaymentSyncIfEnabled` after |
| Referral conversion | Yes | Yes | No |
| `applyRevenueShareSplits` | Yes (post-commit) | **No** | **No** |
| `orchestrateFundingAfterInvoiceSettlement` | Yes | **No** | **No** |
| R5 commission reconcile on replay | Yes | **No** | **No** |
| Idempotency | `checkHederaIdempotency` + per-link `PAYMENT_CONFIRMED` guard | Per tx id pre-check | Duplicate check |

**Primary divergence for launch:** **H3** is wired to the **public payment UI retry path** and skips commission + funding orchestration.

---

## Step 4 — Data availability (per path)

| Field | H1 confirm | H2 checker | H3 verify | Required by `confirmPayment` |
|-------|------------|------------|-----------|------------------------------|
| `paymentLinkId` | ✅ | ✅ | ✅ | ✅ |
| `amountReceived` | ✅ (tolerance vs link) | ✅ (mirror amount) | ✅ (mirror amount) | ✅ |
| `currencyReceived` / token | ✅ `tokenType` | ✅ | ✅ `tokenType` | ✅ `tokenType` |
| `providerRef` / tx hash | ✅ `txId` | ✅ normalized tx id | ✅ | ✅ |
| `transactionId` | ✅ | ✅ | ✅ | Optional |
| Network / mirror proof | ✅ | ✅ | ✅ | metadata |
| Consensus timestamp | ✅ metadata | ✅ metadata | ✅ metadata | metadata |
| Payer account | ✅ | ✅ sender | ✅ sender | metadata |
| Memo / link binding | ✅ | ✅ memo contains link id | ✅ memo contains link id | metadata |
| `correlationId` | ✅ auto | ✅ | ✅ | Optional |
| Invoice amount for ledger | ✅ link.amount | ✅ link.amount | ✅ link.amount | ✅ |
| `organization_id` on event | ✅ via confirmPayment | ✅ | ⚠️ not set on inline create | ✅ |
| `pilot_deal_id` | ✅ from link/meta | ✅ | ⚠️ may be missing on inline event | ✅ |

**Missing for H3 → confirmPayment migration:** None material — verify already extracts token, amount, sender, timestamp, memo. Migration is **routing**, not data collection.

**Idempotency note:** Canonical Hedera idempotency is **per transaction id** (`checkHederaIdempotency`), not per link — correct for on-chain rails (multiple txs per link are impossible for one payment).

---

## Step 5 — Historical rationale (evidence from code)

| Signal | Interpretation |
|--------|----------------|
| `confirmHederaPayment` header “Sprint 24” + edge-case locks | Predates unified `confirmPayment`; built as Hedera-specific handler |
| Comment in `confirmHederaPayment`: “Don't throw - payment is still confirmed” for ledger failures | Era when ledger posting was **best-effort** after status flip |
| `transactions/verify` route comment: “Used when automatic monitoring fails or times out” | **Operational** addition: mirror indexing delay → direct tx id lookup without refactoring checker |
| Inline `ledger_entries.create` in verify | Copy of early Hedera ledger pattern before `postHederaSettlement` was wired into `confirmPayment` txn |
| `transaction-checker` already migrated to `confirmPayment` | Partial R4 fix landed for monitor path; verify path never updated |
| `canonical-payment-lifecycle.md` documents D6/D7 | Architecture review already identified gap; implementation lag on verify only |
| `batchConfirmHederaPayments` unused | Legacy batch repair path — low production traffic |

**Conclusion:** Bypass is **not** Hedera-specific business logic (mirror, HTS, HBAR) — it is **legacy + expedient manual verify** left inline when monitor path was later canonicalized.

---

## Step 6 — Integration options

### Option A — Verify creates `PAYMENT_CONFIRMED`, then calls `confirmPayment`

**Flow:** Pre-insert event → call `confirmPayment`.

| Verdict | **Reject** |
|---------|------------|
| Why | `confirmPayment` **creates** `PAYMENT_CONFIRMED` and guards “one per link”. Pre-insert causes duplicate-key / early-return / skipped ledger. |

### Option B — `executeHederaSettlement()` wrapper → `confirmPayment`

**Flow:** New module mirroring R1/R3 adapter pattern.

| Verdict | **Acceptable** (same as C) |
|---------|----------------------------|
| Why | Thin adapter with mirror-fetched fields → `confirmPayment`. Name differs only. |

### Option C — Thin adapter → `confirmPayment({ provider: 'hedera' })` (**recommended**)

**Flow:**

```text
POST /api/hedera/transactions/verify
        ↓
executeHederaMirrorSettlement()   ← new thin module (mirror fetch + validation only)
        ↓
confirmPayment({
  provider: 'hedera',
  providerRef: normalizedTxId,
  tokenType,
  amountReceived,
  currencyReceived: tokenType,
  metadata: { manuallyVerified: true, network, sender, ... }
})
        ↓
[existing confirmPayment txn + post-commit commission/funding/Xero]
```

| Criterion | Assessment |
|-----------|------------|
| **Correctness** | **High** — one writer for all side effects |
| **Complexity** | **Low** — delete ~100 lines inline txn; reuse checker validation |
| **Migration risk** | **Medium** — historical H3 rows need repair (see historical impact doc) |
| **Regression risk** | **Low** if verify UI still calls same URL; behavior adds commission/funding |

**Implementation notes (design only):**

1. Remove inline `prisma.$transaction` settlement from verify route.  
2. Reuse mirror validation logic (or call shared helper extracted from verify + checker).  
3. Enforce same entry states as `confirmPayment` (`OPEN` primary; optional PAID backfill if no event).  
4. On idempotent `alreadyProcessed`, run R5 reconcile (inherited from `confirmPayment`).  
5. Deprecate `confirmHederaPayment` / route batch to adapter or delete.  
6. `retryLedgerPosting` should call `confirmPayment` backfill or commission reconcile — not duplicate ledger math.

### Option D — Keep current architecture

| Verdict | **Reject for launch** |
|---------|----------------------|
| Why | Leaves R4 blocker; commission/funding permanently optional on verify path |

---

## Recommendation

**Option C** — same pattern as **R1** (`executeOperatorManualInvoiceSettlement`) and **R3** (`executeAssistedReviewSettlement`):

- **Single settlement orchestrator:** `confirmPayment`  
- **Stable idempotency:** normalized Hedera transaction id (existing `checkHederaIdempotency`)  
- **No second ledger implementation** in verify route  

**Minimal diff surface:**

| File | Change |
|------|--------|
| `src/app/api/hedera/transactions/verify/route.ts` | Replace inline txn with adapter → `confirmPayment` |
| `src/lib/hedera/hedera-mirror-settlement.server.ts` (new) | Mirror fetch + validation + `confirmPayment` call |
| `src/lib/hedera/payment-confirmation.ts` | Deprecate or redirect `confirmHederaPayment` to `confirmPayment` |
| `src/lib/data/repair-utilities.ts` | Prefer reconcile/backfill over `retryLedgerPosting` duplicate |

**Do not change:** `postHederaSettlement` formulas, commission posting, funding graph logic inside `confirmPayment`.

---

## Success criteria (post-R4)

- No Hedera invoice path can reach `PAID` + `PAYMENT_CONFIRMED` without passing through `confirmPayment`.  
- `POST /api/hedera/transactions/verify` produces identical downstream artifacts to monitor/confirm paths (modulo metadata flags).  
- Idempotent replay runs R5 commission reconcile.  
- Historical H3 settlements repairable via documented backfill.

---

## References

- `src/lib/services/payment-confirmation.ts` — canonical orchestrator  
- `docs/canonical-payment-lifecycle.md` — D6/D7 divergence table  
- `docs/r3-canonical-integration-design.md` — adapter pattern precedent  
- `docs/launch-readiness-reassessment-v2.md` — R4 blocker ranking
