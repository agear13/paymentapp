# R2 Impact Analysis — Block PAID via Payment Link Status API

**Remediation:** R2 only — prevent `POST /api/payment-links/[id]/status` from transitioning into `PAID`.  
**Date:** 2026-06-04  
**Target file:** `src/app/api/payment-links/[id]/status/route.ts`

---

## Current implementation

### POST handler flow

1. Rate limit (`api`)
2. `requireAuth()`
3. Load `payment_links` row (id, organization_id, status)
4. Permission: `edit_payment_links`
5. Parse body: `{ status: PaymentLinkStatusSchema }`
6. `isValidTransition(current, new)` — uses global state machine in `src/lib/payments/state-machine.ts`
7. `transitionPaymentLinkState` in a transaction (`source: payment-link-status-api`, `reason: manual_status_transition`)
8. Structured log via `loggers.payment.info`

### GET handler (unchanged scope for R2)

- Polls DB status; may auto-expire `OPEN → EXPIRED`
- Returns `validTransitions` from `getValidNextStates(currentStatus)` **including `PAID`** when allowed by state machine
- Used by `use-payment-status-polling.ts` (GET only)

---

## Supported transitions (state machine)

| From | Allowed targets (includes PAID today) |
|------|----------------------------------------|
| DRAFT | OPEN, CANCELED |
| OPEN | **PAID**, PAID_UNVERIFIED, REQUIRES_REVIEW, EXPIRED, CANCELED |
| PAID_UNVERIFIED | **PAID**, OPEN, REQUIRES_REVIEW |
| REQUIRES_REVIEW | **PAID**, OPEN |
| PAID | PARTIALLY_REFUNDED, REFUNDED, OPEN |
| PARTIALLY_REFUNDED | REFUNDED |
| REFUNDED | (none) |
| EXPIRED | (none) |
| CANCELED | (none) |

**R2 blocks any POST target of `PAID`**, regardless of source state.

---

## Callers — POST with `status: PAID`

| Consumer | Uses POST `/status`? | Uses PAID? | Notes |
|----------|----------------------|------------|--------|
| `use-payment-status-polling.ts` | **GET only** | N/A | Public/checkout polling |
| `payment-links/page.tsx` | No | No | Uses `manual-settlement` for mark paid |
| `payment-link-detail-dialog.tsx` | No | No | Uses `manual-settlement` |
| `create-payment-link-dialog.tsx` | No | No | PATCH/POST other routes |
| E2E / integration tests | **None found** | — | No test calls POST status → PAID |

**Conclusion:** No in-repo UI or test currently depends on POST status → PAID. The endpoint appears to be a **generic admin/integration hook** documented in sprint notes, not the primary operator workflow.

---

## Legitimate workflows that need invoice `PAID`

These exist but **must not** use the status API after R2:

| Workflow | Correct entry today | Uses confirmPayment? |
|----------|---------------------|----------------------|
| Card / Stripe checkout | Stripe webhook → `confirmPayment` | YES |
| Wise transfer funded | Wise webhook → `confirmPayment` | YES |
| Hedera on-chain | `POST /api/hedera/confirm`, transaction-checker | YES |
| Operator mark paid (invoice) | `POST .../manual-settlement` `mark_paid` | NO (R1 — out of scope) |
| Manual bank merchant approve | `.../manual-bank-confirmations/[id]/review` `mark_valid` | NO (R3) |
| Crypto merchant approve | `.../crypto-confirmations/[id]/review` `mark_valid` | NO (R3) |
| Hedera admin mirror verify | `POST /api/hedera/transactions/verify` | NO (R4) |
| Reconciliation repair | `stripe-reconciliation` job / scripts | YES |

**None of these require `ANY_STATE → PAID` via the status API** for correct business operation.

### Transitions that remain legitimate via status API

| Transition | Business purpose |
|------------|------------------|
| OPEN → PAID_UNVERIFIED | Not via status API today (payer submit services); status API could support if needed |
| OPEN → REQUIRES_REVIEW | Review funnel (if used) |
| OPEN → EXPIRED / CANCELED | Operational |
| PAID → OPEN | Reopen (manual-settlement also supports reopen with evidence checks) |
| PAID_UNVERIFIED → REQUIRES_REVIEW | Merchant flag investigate (review routes) |

After R2, status API can still perform **non-settlement** transitions; only **`PAID` as POST target** is blocked.

---

## API consumers

| Type | Impact |
|------|--------|
| Internal dashboard UI | **None** — no POST caller found |
| Public payer UI | **None** — GET polling only |
| External integrations | **Possible** — any client using POST `{ status: "PAID" }` will receive **409** with guidance (document in API changelog) |
| GET `validTransitions` | Will **omit `PAID`** from list to avoid implying POST is allowed |

---

## Tests (existing)

| Test file | Relevance |
|-----------|-----------|
| `payment-edge-cases-comprehensive.test.ts` | Documents state machine includes OPEN→PAID; still true at machine level |
| `settlement-integrity-guards.test.ts` | confirmPayment guards — unaffected |
| `payment-flow-validation.test.ts` | Mock audit trail example — unaffected |

**No existing test asserts POST status API → PAID succeeds.**

---

## R2 implementation plan

1. Add `src/lib/payments/payment-link-status-api-policy.ts` — single policy for blocked targets and operator messaging.
2. In POST route: reject `newStatus === 'PAID'` before transaction; audit log + warn log.
3. In GET route: return `getStatusApiAllowedNextStates()` (excludes PAID).
4. Add `src/__tests__/payments/payment-link-status-api-policy.test.ts`.
5. Add route source contract test in same file (grep for policy import).

---

## Out of scope (explicit)

- R1 manual-settlement → confirmPayment
- R3 bank/crypto mark_valid
- R4 Hedera verify
- R5 commission replay
- Changes to `confirmPayment`, ledger, commission, funding

---

## Success criteria mapping

| Criterion | How R2 meets it |
|-----------|-----------------|
| Status API cannot create PAID | POST returns 409 for target PAID |
| Settlement paths unaffected | confirmPayment and other routes untouched |
| Legitimate transitions work | EXPIRED, CANCELED, PAID_UNVERIFIED, etc. still valid where state machine allows |
| Clear operator guidance | Error body + audit log + logs |
