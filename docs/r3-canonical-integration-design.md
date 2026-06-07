# R3 Canonical Integration Design

**Date:** 2026-06-04  
**Goal:** Route bank and crypto **merchant review** (`mark_valid`) through the same settlement pipeline as R1 (`confirmPayment`), without new ledger math or commission logic.  
**Status:** Implemented (Option C). See `assisted-review-settlement.server.ts`, `r3-historical-impact.md`.

---

## Problem statement

Today, `mark_valid` on assisted bank/crypto confirmations:

1. Calls `transitionPaymentLinkState` → `PAID` only  
2. Updates confirmation row to `APPROVED`  
3. Optionally calls `createReferralConversionFromPaymentConfirmed` **only if** a stray `PAYMENT_CONFIRMED` already exists (normally it does not)

It does **not** invoke `confirmPayment()`, so it skips:

- `PAYMENT_CONFIRMED` creation  
- Rail settlement ledger (atomic txn)  
- `xero_syncs` upsert  
- `applyRevenueShareSplits` / R5 reconcile  
- `orchestrateFundingAfterInvoiceSettlement`

Payer **submission** paths correctly stop at `PAID_UNVERIFIED` / `REQUIRES_REVIEW` and are **not** the R3 defect.

---

## Current lifecycle (both rails)

```text
OPEN
  ↓  payer POST public confirmation
PAID_UNVERIFIED
  ↓  (optional, if verification FLAGGED/LOW)
REQUIRES_REVIEW
  ↓  merchant mark_valid  ← R3 fixes this step only
PAID   (status only today — not canonical settlement)
```

Intermediate events (not settlement):

| Rail | Event on submit |
|------|-----------------|
| Manual bank | `PAYMENT_INITIATED` (`source_reference`: `manual_bank_submit:{confirmationId}`) |
| Crypto | `CRYPTO_PAYMENT_SUBMITTED` (`correlation_id`: `crypto_submit:{confirmationId}`) |

---

## Comparison with R1 (operator manual settlement)

| Aspect | R1 `executeOperatorManualInvoiceSettlement` | Bank/crypto `mark_valid` (today) |
|--------|-----------------------------------------------|----------------------------------|
| **Trigger** | Operator `POST .../manual-settlement` `mark_paid` | Merchant `POST .../confirmations/[id]/review` `mark_valid` |
| **Precondition status** | **`OPEN` only** | `PAID_UNVERIFIED` or `REQUIRES_REVIEW` |
| **Settlement** | `confirmPayment({ provider: 'manual' })` | Direct `transitionPaymentLinkState` → `PAID` |
| **PAYMENT_CONFIRMED** | Yes (in txn) | No |
| **Ledger** | `postWiseSettlement` via manual idempotency key | No |
| **Commission** | Post-commit `applyRevenueShareSplits` + R5 reconcile | No |
| **Funding** | `orchestrateFundingAfterInvoiceSettlement` | No |
| **Xero** | Upsert in txn | No |
| **Provider ref** | `manual-settlement:{paymentLinkId}` | N/A |
| **Audit** | `metadata.actorUserId`, `source: manual-settlement-api` | `metadata.actorUserId`, `confirmationId` on transition only |

### Similarities

- Both end in `payment_links.status = PAID`  
- Both are merchant/operator intentional “money received” decisions  
- Both can target `MANUAL_BANK` or `CRYPTO` payment method links  
- State machine already allows `PAID_UNVERIFIED` / `REQUIRES_REVIEW` → `PAID`

### Differences (integration must address)

| Gap | Detail |
|-----|--------|
| **Starting state** | `confirmPayment` today enforces transition from **`OPEN` only** (comment: “Enforce valid OPEN -> PAID”). Review needs **`PAID_UNVERIFIED` / `REQUIRES_REVIEW` → `PAID`**. |
| **Defensive PAID branch** | If `mark_valid` already ran, link is `PAID` with no `PAYMENT_CONFIRMED`; `confirmPayment` returns `alreadyProcessed` with **`paymentEventId: undefined`** and creates **no** settlement. R3 must **replace** status transition, not run after it. |
| **Amount source** | R1 uses `link.amount` / `invoice_currency`. Review should use **invoice amount** for ledger; payer `payer_amount_sent` is advisory (may mismatch in `REQUIRES_REVIEW`). |
| **Provider evidence** | R1 uses synthetic `manual-settlement:{linkId}`. Review should use **stable per-confirmation** refs: `bank-review:{confirmationId}`, `crypto-review:{confirmationId}`. |
| **On-chain crypto** | `payer_tx_hash` exists but `mark_valid` does not call Hedera mirror / `confirmPayment({ provider: 'hedera' })` — out of scope for minimal R3 (use manual clearing rail like R1). |

### Missing data for `confirmPayment` — assessment

| Field | Bank review | Crypto review | Notes |
|-------|-------------|---------------|-------|
| `paymentLinkId` | Yes (`confirmation.payment_link_id`) | Yes | |
| `amountReceived` | Yes (`Number(link.amount)`) | Yes | Prefer invoice amount; document if payer sent different |
| `currencyReceived` | Yes (`link.invoice_currency ?? link.currency`) | Yes | |
| `providerRef` | Can derive `bank-review:{id}` | Can derive `crypto-review:{id}` | New stable keys |
| `correlationId` | Optional | Optional | Can reuse submit correlation |
| `metadata` | `confirmationId`, verification fields, `actorUserId` | Same + `payer_tx_hash`, network | Rich audit trail exists on confirmation rows |
| `tokenType` / Hedera | N/A | Optional future | Not required for R3 minimal path |

**Conclusion:** Review flows **already possess** sufficient data to call `confirmPayment` safely after a **small orchestration + precondition change** (allowed source states, call order).

---

## Integration options

### Option A — “Create PAYMENT_CONFIRMED then confirmPayment”

**Interpretation:** Two-step: insert event manually, then call `confirmPayment`.

| Verdict | **Reject** |
|---------|------------|
| Why | `confirmPayment` **creates** `PAYMENT_CONFIRMED` inside its transaction. Manual insert duplicates truth, breaks idempotency, and risks double ledger if not careful. |

**Correct reading of Option A intent:** Review approval should **trigger** `confirmPayment` (which creates the event) — not pre-create the event.

---

### Option B — Special settlement logic in review routes

Duplicate `confirmPayment` transaction body inside `review/route.ts` (inline ledger + event).

| Verdict | **Reject** |
|---------|------------|
| Why | Violates single settlement writer; duplicates R4/Hedera verify anti-pattern; high regression risk. |

---

### Option C — Adapter layer → `confirmPayment` (recommended)

```text
POST .../manual-bank-confirmations/[id]/review  (mark_valid)
POST .../crypto-confirmations/[id]/review       (mark_valid)
        ↓
executeAssistedReviewSettlement()   ← new thin module (mirror R1)
        ↓
confirmPayment({
  provider: 'manual',               ← reuse R1 ledger rail (Wise clearing)
  providerRef: 'bank-review:{id}' | 'crypto-review:{id}',
  amountReceived, currencyReceived,
  metadata: { confirmationId, rail, actorUserId, verification snapshot, ... }
})
        ↓
[txn] PAID_UNVERIFIED|REQUIRES_REVIEW → PAID
      PAYMENT_CONFIRMED + ledger + xero
        ↓
[post-commit] commission + R5 reconcile + funding
        ↓
Update confirmation status APPROVED + reviewed_at
```

#### Required minimal changes to `confirmPayment` (design only)

1. **Settlement-eligible statuses:** Allow `OPEN`, `PAID_UNVERIFIED`, and `REQUIRES_REVIEW` → `PAID` (all already valid in `ALLOWED_TRANSITIONS`).  
2. **Do not** hit “already PAID without PAYMENT_CONFIRMED” defensive skip when caller is assisted review repair (or ensure review never sets PAID before `confirmPayment`).  
3. **`checkManualIdempotency`:** Already keys off `PAYMENT_CONFIRMED` per link + `source_reference` — per-confirmation `providerRef` supports replay.  
4. **Remove** direct `transitionPaymentLinkState` → `PAID` from review routes **before** `confirmPayment`.

#### Ledger / provider choice

- Reuse **`provider: 'manual'`** and **`postWiseSettlement`** (same as R1) — **no new posting rules** per constraints.  
- Distinguish flows via `providerRef` prefix and event `metadata.settlementPath: 'assisted_review'`.

#### Crypto with `payer_tx_hash`

- Minimal R3: still **manual clearing** rail at merchant `mark_valid`.  
- Future: optional branch to Hedera `confirmPayment` when tx verified on-chain (overlaps **R4**, not R3).

---

## Recommended approach

**Option C** — single adapter `executeAssistedReviewSettlement()` used by both review routes.

### API contract (proposed)

```typescript
executeAssistedReviewSettlement({
  confirmationId: string;
  rail: 'MANUAL_BANK' | 'CRYPTO';
  actorUserId: string;
}): Promise<ConfirmPaymentResult>
```

**Preconditions:**

- Confirmation `status === 'SUBMITTED'`  
- Link `payment_method` matches rail  
- Link status ∈ `{ PAID_UNVERIFIED, REQUIRES_REVIEW }`  
- No existing `PAYMENT_CONFIRMED` for link (or delegate to idempotent `confirmPayment` return)

**Post-success:**

- `manual_bank_payment_confirmations` / `crypto_payment_confirmations` → `APPROVED`, `reviewed_at`  
- Remove redundant `createReferralConversionFromPaymentConfirmed` block (handled in `confirmPayment` post-commit with correct event id)

### Idempotency story

| Scenario | Behavior |
|----------|----------|
| First `mark_valid` | `confirmPayment` creates event + ledger |
| Retry same confirmation | `providerRef` + link-level `PAYMENT_CONFIRMED` guard → `alreadyProcessed`; R5 reconcile heals gaps |
| `mark_valid` after partial old path (PAID, no event) | Needs **one-time repair** or repair branch: detect `PAID` + no event → call settlement repair (document in migration; optional admin script) |

---

## Out of scope (per constraints)

- Changing ledger posting rules or commission calculations  
- Hedera on-chain verification at review time (R4)  
- Changing payer submission (`PAID_UNVERIFIED`) behavior  
- New debug/diagnostic endpoints  

---

## Files to touch (implementation phase)

| File | Change |
|------|--------|
| `src/lib/payments/assisted-review-settlement.server.ts` | **New** — adapter to `confirmPayment` |
| `src/lib/services/payment-confirmation.ts` | Allow settlement from `PAID_UNVERIFIED` / `REQUIRES_REVIEW` |
| `src/app/api/payment-links/manual-bank-confirmations/[id]/review/route.ts` | `mark_valid` → adapter; remove direct PAID transition |
| `src/app/api/payment-links/crypto-confirmations/[id]/review/route.ts` | Same |
| Tests | Mirror `manual-settlement-canonical.test.ts` + integration cases |

**Unchanged:** Public submit routes, list GET routes, submission services, state machine transition table.

---

## Success criteria mapping

| Criterion | How Option C satisfies |
|-----------|-------------------------|
| Canonical settlement | Single writer: `confirmPayment` |
| No duplicate ledger | Idempotency keys + no pre-PAID transition |
| Commission + funding | Post-commit hooks unchanged |
| Minimal diff | Thin adapter + precondition widen |
