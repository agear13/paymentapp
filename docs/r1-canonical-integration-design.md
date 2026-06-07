# R1 Canonical Integration Design

## Goal

Operator mark-paid must converge through `confirmPayment()` with no duplicate Xero/funding side effects.

```text
Manual Settlement (mark_paid)
  ↓
executeOperatorManualInvoiceSettlement()
  ↓
confirmPayment({ provider: 'manual', ... })
  ↓
[transaction]
  OPEN → PAID
  PAYMENT_CONFIRMED (source_type: MANUAL)
  FX settlement snapshot
  Ledger: postWiseSettlement (reuse — DR 1055 / CR 1200, idempotency manual-*)
  xero_syncs upsert (if enabled)
  ↓
[post-commit]
  Referral conversion (provider: manual)
  applyRevenueShareSplits (if new event)
  orchestrateFundingAfterInvoiceSettlement(paymentEventId)
```

---

## Design choices

### 1. Thin orchestration module

**File:** `src/lib/payments/manual-invoice-settlement.server.ts`

- Loads link amount/currency
- Stable `providerRef`: `manual-settlement:{paymentLinkId}` (one settlement per link)
- Calls `confirmPayment` only — no direct `transitionPaymentLinkState`

### 2. Extend `confirmPayment` provider union

Add `'manual'` without changing Stripe/Hedera/Wise branches.

| Concern | Approach |
|---------|----------|
| Idempotency | `checkManualIdempotency` — existing `PAYMENT_CONFIRMED` on link or matching `source_reference` |
| Payment event | `source_type: MANUAL`, `payment_method: 'MANUAL'`, metadata includes `actorUserId` |
| Ledger | **Reuse** `postWiseSettlement` with `wiseTransferId: manual-{providerRef}` — no edits to posting math in `wise.ts` |
| Correlation | Extend `CorrelationSource` with `'manual'` |

### 3. Remove duplicate side effects from route

Delete from `manual-settlement/route.ts` mark_paid branch:

- `transitionPaymentLinkState` → PAID
- `queueXeroSync`
- `orchestrateFundingAfterManualInvoiceSettlement`

### 4. Error handling

- `confirmPayment` failure → HTTP 400 with `result.error`
- Success → `{ success: true, paymentEventId?, alreadyProcessed? }` (backward compatible `success: true`)

### 5. Reopen

No change.

---

## Out of scope (per constraints)

- New ledger account / `postManualSettlement` file (avoid new ledger logic)
- Changes to commission/ledger/funding calculation internals
- R3 bank/crypto review routes
- Commission replay on `alreadyProcessed` (R5)

---

## Files to change

| File | Change |
|------|--------|
| `manual-settlement/route.ts` | mark_paid → `executeOperatorManualInvoiceSettlement` |
| `manual-invoice-settlement.server.ts` | **new** |
| `payment-confirmation.ts` | manual provider branch (minimal) |
| `correlation.ts` | add `manual` source |
| Tests | policy + route contract |

---

## Safety verification (Phase 4)

| Area | Finding |
|------|---------|
| Reports | Query `status: PAID` — still valid after confirmPayment |
| Admin tools | No direct POST mark_paid bypass found outside UI |
| Reconciliation | Uses `confirmPayment` — unaffected |
| `orchestrateFundingAfterManualInvoiceSettlement` | Unused after R1 except potential external callers — grep shows only manual-settlement route |
| Integrity jobs | Benefit — fewer `PAID_WITHOUT_PAYMENT_CONFIRMED` |

`orchestrateFundingAfterManualInvoiceSettlement` remains in codebase for backward compatibility but route stops calling it.
