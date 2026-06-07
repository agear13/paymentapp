# R1 Manual Settlement Analysis

**Remediation:** Route operator mark-paid through `confirmPayment()`.  
**Route:** `POST /api/payment-links/[id]/manual-settlement`  
**Date:** 2026-06-04

---

## Current flow (`action: mark_paid`)

```text
POST /api/payment-links/[id]/manual-settlement
  ↓
requireAuth + edit_payment_links permission
  ↓
Validate link.status === OPEN
  ↓
prisma.$transaction
  └── transitionPaymentLinkState(OPEN → PAID)
        source: manual-settlement-api
        reason: operator_mark_paid
  ↓
(if xeroSync) queueXeroSync(PAYMENT)     ← separate from confirmPayment
  ↓
orchestrateFundingAfterManualInvoiceSettlement(paymentLinkId)
        └── orchestrateOperationalMutation(funding_update) via pilot_deal_id only
  ↓
revalidatePath + { success: true }
```

### Not invoked today

| Step | Service |
|------|---------|
| PAYMENT_CONFIRMED | — |
| confirmPayment() | — |
| Ledger posting | — |
| applyRevenueShareSplits | — |
| createReferralConversionFromPaymentConfirmed | — |
| orchestrateFundingAfterInvoiceSettlement(paymentEventId) | — |
| Xero upsert inside payment txn | — |

---

## Current flow (`action: reopen`)

Unchanged by R1 (stays direct state machine):

```text
Validate status ∈ { PAID, PAID_UNVERIFIED, REQUIRES_REVIEW }
  ↓
Block if external settlement evidence (Stripe/Hedera/Wise/PAYMENT_CONFIRMED-like events)
  ↓
transitionPaymentLinkState(→ OPEN)
```

---

## Dependencies touched by mark_paid (today)

| Dependency | How used | Coupled to PAID? |
|------------|----------|------------------|
| **Xero** | `queueXeroSync` after PAID | Yes — can run without ledger |
| **Funding** | `orchestrateFundingAfterManualInvoiceSettlement` | Yes — pilot_deal_id on link only |
| **Payment events** | Not created on mark_paid | No |
| **Ledger** | Not posted | No |
| **Settlement** | Not created | No |
| **Commission / revenue share** | Not run | No |

---

## UI / API consumers

| Consumer | File | Action |
|----------|------|--------|
| Payment links page | `dashboard/payment-links/page.tsx` | `markInvoicePaid` → POST `mark_paid` |
| Payment link detail dialog | `payment-link-detail-dialog.tsx` | `postManualSettlement('mark_paid')` |

Both expect `{ success: true }` or `{ error: string }` on failure. No dependency on bypass path internals.

---

## Tests referencing manual settlement

| Test | Notes |
|------|-------|
| `payment-link-status-api-policy.test.ts` | Documents manual-settlement as canonical operator flow in error copy (R2) |
| No test asserts mark_paid creates PAYMENT_CONFIRMED today | Gap addressed in R1 tests |

---

## Existing assumptions / dependents

| Assumption | Risk if broken | Mitigation in R1 |
|------------|----------------|------------------|
| Mark paid → immediate `PAID` status | UI polls GET status → PAID | confirmPayment sets PAID in same txn |
| Mark paid → Xero queued | Ops expect Xero job | confirmPayment upserts `xero_syncs` |
| Mark paid → pilot funding refresh | Project dashboard | `orchestrateFundingAfterInvoiceSettlement` via paymentEventId |
| Reopen without PAYMENT_CONFIRMED | Still valid for mistaken manual PAID (legacy rows) | Reopen path unchanged |
| Integrity check `PAID_WITHOUT_PAYMENT_CONFIRMED` | Legacy rows may exist | New marks fix forward |

**Nothing in-repo assumes** manual-settlement must *avoid* `confirmPayment`.

---

## Allowed to stay outside confirmPayment

- **Reopen** — operational correction, not money-in.
- **Bank/crypto review mark_valid** — R3 (separate route).
