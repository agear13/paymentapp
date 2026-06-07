# Canonical Payment Lifecycle

**Purpose:** Define the single intended path for “money received” on **payment links** (invoices).  
**Audience:** Architecture review before remediation.  
**Scope:** Business settlement truth — not deployment or infrastructure.

---

## Intended model

Any money received on a payment link must converge through one orchestrator. Side effects are ordered and idempotent.

```text
Money received (provider evidence)
        ↓
PAYMENT_CONFIRMED (payment_events — one per payment_link_id, DB-enforced)
        ↓
confirmPayment()  (src/lib/services/payment-confirmation.ts)
        ↓
┌───────────────────────────────────────────────────────────────┐
│ Single Prisma transaction (atomic rollback on failure)         │
│  • payment_links: OPEN → PAID (state machine)                │
│  • payment_events: PAYMENT_CONFIRMED                           │
│  • FX settlement snapshot                                      │
│  • Ledger settlement (Stripe / Hedera / Wise posting rules)    │
│  • xero_syncs upsert (PAYMENT, PENDING) if feature enabled   │
└───────────────────────────────────────────────────────────────┘
        ↓
Post-commit (best-effort, must be repairable on replay)
  • validatePostingBalance / ledger invariants
  • createReferralConversionFromPaymentConfirmed (Supabase)
  • applyRevenueShareSplits → commission_obligations / items / ledger
  • orchestrateFundingAfterInvoiceSettlement (pilot project funding graph)
        ↓
payment_links.status = PAID  (already set in txn)
        ↓
Downstream (separate lifecycles)
  • Payout batches / pilot release (partner settlement OUT)
  • Xero queue processor (external accounting sync)
```

### Truth records

| Layer | Canonical record | Notes |
|-------|------------------|--------|
| Invoice paid | `payment_links.status = 'PAID'` | Must follow valid transition from `OPEN` |
| Settlement | `payment_events.event_type = 'PAYMENT_CONFIRMED'` | Unique per link (partial unique index) |
| Ledger | `ledger_entries` via `LedgerEntryService` | Coupled to settlement in `confirmPayment` txn |
| Commission | `commission_obligations` + `commission_obligation_items` | After commit; idempotent on `payment_events.id` |
| Funding | Operational graph via `orchestrateFundingAfterInvoiceSettlement` | Requires `pilot_deal_id` on event/link |
| Accounting | `xero_syncs` row `sync_type = 'PAYMENT'` | Queued in txn; processed by queue worker |

### Payment link state machine (authoritative)

Source: `src/lib/payments/state-machine.ts`

```text
DRAFT ──→ OPEN ──→ PAID
              ├──→ PAID_UNVERIFIED ──→ PAID
              │                   └──→ REQUIRES_REVIEW ──→ PAID
              ├──→ REQUIRES_REVIEW ──→ PAID
              ├──→ EXPIRED
              └──→ CANCELED

PAID ──→ PARTIALLY_REFUNDED ──→ REFUNDED
PAID ──→ OPEN   (reopen — blocked when external settlement evidence exists)
```

**Interpretation:** `PAID_UNVERIFIED` and `REQUIRES_REVIEW` are **not** canonical settlement; they are payer-submitted or review states until merchant/operator marks valid → `PAID` **or** `confirmPayment` runs from an automated rail.

---

## Current architecture vs canonical

### Aligns with canonical (calls `confirmPayment`)

| # | Entry point | File / route |
|---|-------------|--------------|
| C1 | Stripe `payment_intent.succeeded` | `src/app/api/stripe/webhook/route.ts` → `handlePaymentIntentSucceeded` |
| C2 | Stripe `checkout.session.completed` | Same webhook → `handleCheckoutSessionCompleted` |
| C3 | Wise transfer funded | `src/app/api/webhooks/wise/route.ts` |
| C4 | Hedera client confirm | `src/app/api/hedera/confirm/route.ts` |
| C5 | Hedera transaction checker / monitor persist | `src/lib/hedera/transaction-checker.ts` |
| C6 | Stripe reconciliation job | `src/lib/jobs/stripe-reconciliation.ts` → `POST /api/jobs/stripe-reconciliation` |
| C7 | Admin repair scripts | `src/scripts/repair-stripe-payment.ts`, `src/scripts/reconcile-stripe-payments.ts`, `scripts/mark-payment-complete.ts` |
| C8 | Internal Stripe webhook replay | `src/app/api/internal/webhooks/stripe/replay/route.ts` → `processStripeWebhookEvent` |

**Post-commit gaps on canonical path (known):** commission skipped when `alreadyProcessed === true`; obligation items skipped on `P2002` + `createdObligation` guard.

### Diverges from canonical — `payment_links.status = PAID` without `confirmPayment`

| # | Entry | Transition | PAYMENT_CONFIRMED | Ledger | Commission | Funding | Xero |
|---|-------|------------|-------------------|--------|------------|---------|------|
| D1 | Operator manual settlement | `OPEN → PAID` | NO | NO | NO | YES (manual bridge) | YES (queue) |
| D2 | Generic status API | `OPEN → PAID` (if allowed) | NO | NO | NO | NO | NO |
| D3 | Manual bank review `mark_valid` | `PAID_UNVERIFIED\|REQUIRES_REVIEW → PAID` | NO* | NO | NO** | NO | NO |
| D4 | Crypto review `mark_valid` | Same as D3 | NO* | NO | NO** | NO | NO |
| D5 | Repair utilities auto-fix | → `PAID` (STATUS_MISMATCH) | Maybe | NO | NO | NO | NO |

\* Referral conversion runs only **if** a `PAYMENT_CONFIRMED` row already exists (atypical for D3/D4).  
\*\* No `applyRevenueShareSplits`.

### Diverges — `PAYMENT_CONFIRMED` without `confirmPayment`

| # | Entry | payment_link PAID | Ledger | Commission | Funding | Xero |
|---|-------|-------------------|--------|------------|---------|------|
| D6 | Hedera manual verify API | YES (txn) | YES (inline DR/CR) | NO | NO | YES |
| D7 | Legacy `confirmHederaPayment` | YES | YES (non-atomic, errors swallowed) | NO | NO | YES |
| D8 | Pilot deal manual funding event | N/A (no link) | NO | NO | YES (after refresh) | NO |
| D9 | DB seed / test fixtures | Varies | Varies | NO | NO | NO |

Approved alternate writers (CI guard): `scripts/check-forbidden-payment-state-mutations.js`.

### Intermediate “paid-like” states (not `PAID`)

| State | How entered | Canonical? |
|-------|-------------|--------------|
| `PAID_UNVERIFIED` | Payer crypto/bank submission | No — awaiting merchant mark_valid or rail confirmation |
| `REQUIRES_REVIEW` | Low-confidence verification or merchant flag | No |

Submissions create `CRYPTO_PAYMENT_SUBMITTED` or `PAYMENT_INITIATED` events — **not** `PAYMENT_CONFIRMED`.

### Parallel “paid” concepts (not payment_links)

These are **separate domains** but operators may conflate them:

| Domain | “Paid” signal | Entry |
|--------|---------------|--------|
| Pilot deal demo UI | `deal.paymentStatus = 'Paid'` | `dashboard/partners/deal-network/page.tsx` (client state) |
| Pilot obligations | `deal_network_pilot_obligations.status = PAID` | Obligation refresh / payout lifecycle |
| Payout to partner | `payouts.status = PAID` | `POST /api/payouts/[id]/mark-paid` |
| Commission item | `commission_obligation_items.status = PAID` | Same mark-paid route (linked items) |
| Supabase referral | `conversion_type = payment_completed` | `POST /api/referrals/payment-completed`, mark-paid, approve flows |
| HuntPay | `conversion.status = approved` | HuntPay admin approve |

---

## Complete pathway map (Step 1–3)

### A. Automated payment rails (invoice / payment link)

#### A1 — Stripe card (canonical)

| Field | Value |
|-------|--------|
| **Entry** | `POST /api/stripe/webhook` |
| **Trigger** | `payment_intent.succeeded`, `checkout.session.completed` |
| **State** | `OPEN → PAID` (inside `confirmPayment` txn) |
| **Settlement** | YES — `PAYMENT_CONFIRMED` |
| **Ledger** | YES — `postStripeSettlement` in txn |
| **Commission** | YES — post-commit `applyRevenueShareSplits` |
| **Revenue share** | YES (same as commission path) |
| **Funding allocation** | YES if `pilot_deal_id` — `orchestrateFundingAfterInvoiceSettlement` |
| **Accounting sync** | YES — `xero_syncs` upsert in txn |

#### A2 — Wise (canonical)

| Field | Value |
|-------|--------|
| **Entry** | `POST /api/webhooks/wise` |
| **Trigger** | Wise status maps to internal `PAID` |
| **State** | `OPEN → PAID` |
| **Settlement / ledger / commission / funding / Xero** | Same pattern as A1 via `confirmPayment` (`provider: 'wise'`) |

#### A3 — Hedera automated (canonical)

| Field | Value |
|-------|--------|
| **Entry** | `POST /api/hedera/confirm`, Hedera monitor/checker |
| **State** | `OPEN → PAID` |
| **All side effects** | Via `confirmPayment` (`provider: 'hedera'`) |

#### A4 — Hedera manual mirror verify (divergent)

| Field | Value |
|-------|--------|
| **Entry** | `POST /api/hedera/transactions/verify` |
| **Method** | `transitionPaymentLinkState` + `payment_events.create` + inline `ledger_entries.create` |
| **State** | `OPEN → PAID` |
| **Settlement** | YES (`PAYMENT_CONFIRMED`) but **not** via `confirmPayment` |
| **Ledger** | YES (manual pairing, not `postHederaSettlement` in shared txn) |
| **Commission** | NO |
| **Revenue share** | NO |
| **Funding** | NO |
| **Xero** | YES — `queueXeroPaymentSyncIfEnabled` |
| **Referral** | Optional Supabase conversion only |

#### A5 — Legacy Hedera handler (divergent, likely unused in prod routes)

| Field | Value |
|-------|--------|
| **Entry** | `confirmHederaPayment()` in `src/lib/hedera/payment-confirmation.ts` |
| **Called by** | `batchConfirmHederaPayments` only (no API route found) |
| **Settlement** | YES |
| **Ledger** | YES (post-txn; failure does not roll back PAID) |
| **Commission / funding** | NO |

### B. Manual / operator invoice actions

#### B1 — Operator mark paid (divergent)

| Field | Value |
|-------|--------|
| **Entry** | `POST /api/payment-links/[id]/manual-settlement` `action: mark_paid` |
| **File** | `src/app/api/payment-links/[id]/manual-settlement/route.ts` |
| **State** | `OPEN → PAID` |
| **confirmPayment** | NO |
| **Settlement / ledger / commission** | NO |
| **Funding** | YES — `orchestrateFundingAfterManualInvoiceSettlement` |
| **Xero** | YES — `queueXeroSync` |

#### B2 — Arbitrary status transition (divergent)

| Field | Value |
|-------|--------|
| **Entry** | `POST /api/payment-links/[id]/status` body `{ status: "PAID" }` |
| **File** | `src/app/api/payment-links/[id]/status/route.ts` |
| **State** | Any valid transition to `PAID` (e.g. `OPEN → PAID`) |
| **confirmPayment** | NO |
| **All financial side effects** | NO |

#### B3 — Manual bank payer submission (pre-paid)

| Field | Value |
|-------|--------|
| **Entry** | Public/manual bank submit → `submitManualBankPaymentConfirmation` |
| **File** | `src/lib/payments/manual-bank-submission-service.ts` |
| **State** | `OPEN → PAID_UNVERIFIED` (or `REQUIRES_REVIEW`) |
| **Event** | `PAYMENT_INITIATED` |
| **Considered “paid” by UI?** | Often shown as submitted / unverified, not canonical PAID |

#### B4 — Manual bank merchant mark valid (divergent final PAID)

| Field | Value |
|-------|--------|
| **Entry** | `POST .../manual-bank-confirmations/[id]/review` `mark_valid` |
| **State** | `PAID_UNVERIFIED\|REQUIRES_REVIEW → PAID` |
| **confirmPayment** | NO |

#### B5 — Crypto payer submission (pre-paid)

| Field | Value |
|-------|--------|
| **Entry** | `submitCryptoPaymentConfirmation` |
| **File** | `src/lib/payments/crypto-submission-service.ts` |
| **State** | `OPEN → PAID_UNVERIFIED` (+ optional `REQUIRES_REVIEW`) |
| **Event** | `CRYPTO_PAYMENT_SUBMITTED` |

#### B6 — Crypto merchant mark valid (divergent final PAID)

| Field | Value |
|-------|--------|
| **Entry** | `POST .../crypto-confirmations/[id]/review` `mark_valid` |
| **Same gaps as B4** | |

### C. Background jobs & cron-style HTTP triggers

| Job | Route | Effect on “paid” |
|-----|-------|------------------|
| Stripe reconciliation | `POST /api/jobs/stripe-reconciliation` | `confirmPayment` when Stripe shows success, DB missing |
| Stuck payments | `POST /api/jobs/stuck-payments` | Lock recovery — does not mark PAID by itself |
| Expired links | `POST /api/jobs/expired-links` | `OPEN → EXPIRED` |
| Ledger integrity | `POST /api/jobs/ledger-integrity` | Read-only checks |
| Recurring templates | `POST /api/jobs/recurring-templates` | Creates links/events — not settlement |
| Xero queue | `POST /api/xero/queue/process` | Processes existing sync rows — does not mark invoice PAID |

### D. Pilot / deal network funding (not payment link settlement)

| Entry | Route / file | Effect |
|-------|--------------|--------|
| Manual pilot payment | `POST /api/deal-network-pilot/deals/[dealId]/payment-events` mode `manual` | `PAYMENT_CONFIRMED` with `payment_link_id = null` |
| Link existing event | mode `link_payment_event` / `link_payment_link` | Associates funding; refreshes pilot obligations |
| Deal UI “mark paid” | Deal network page client state | `paymentStatus: 'Paid'` drives `legacyMoney` in obligation refresh **without** payment_events |

### E. Referral / partner “payment completed” (Supabase)

| Entry | Route | payment_link PAID | Prisma ledger | Supabase partner ledger |
|-------|-------|-------------------|---------------|-------------------------|
| Payment completed webhook | `POST /api/referrals/payment-completed` | NO | NO | YES |
| Auto conversion | `createReferralConversionFromPaymentConfirmed` | NO (requires confirmed event) | NO | YES |
| Admin mark paid | `POST /api/referrals/conversions/[id]/mark-paid` | NO | NO | YES |
| Admin approve + ledger | `POST /api/referrals/conversions/[id]/approve` | NO | NO | If `payment_completed` |

### F. Partner payout settlement (outbound)

| Entry | Route | Marks |
|-------|-------|--------|
| Release batch | `POST /api/payout-batches/create` | Batch/payout DRAFT — not invoice PAID |
| Mark payout paid | `POST /api/payouts/[id]/mark-paid` | `payouts.status = PAID`, obligation lines/items |

### G. Refund / reopen (un-pay)

| Entry | Effect |
|-------|--------|
| Stripe refund webhooks | Ledger reversal; link may → `PARTIALLY_REFUNDED` / `REFUNDED` |
| Manual settlement `reopen` | `PAID → OPEN` if no external evidence |
| Status API | Valid transitions away from PAID |

---

## Step 4 — Can `PAID` happen without `confirmPayment()`?

**Yes.** Definitive examples:

| Route | File | Method / handler | Exact transition |
|-------|------|------------------|------------------|
| Manual settlement | `src/app/api/payment-links/[id]/manual-settlement/route.ts` | `POST`, `action === 'mark_paid'` | `OPEN → PAID` via `transitionPaymentLinkState`, source `manual-settlement-api` |
| Status API | `src/app/api/payment-links/[id]/status/route.ts` | `POST` | `* → PAID` if valid (commonly `OPEN → PAID`), source `payment-link-status-api` |
| Manual bank review | `src/app/api/payment-links/manual-bank-confirmations/[id]/review/route.ts` | `POST`, `mark_valid` | `PAID_UNVERIFIED\|REQUIRES_REVIEW → PAID`, source `manual-bank-confirmation-review` |
| Crypto review | `src/app/api/payment-links/crypto-confirmations/[id]/review/route.ts` | `POST`, `mark_valid` | Same pattern, source `crypto-confirmation-review` |
| Repair utilities | `src/lib/data/repair-utilities.ts` | `repairConsistencyIssues` | → `PAID`, source `repair-utilities`, reason `auto_repair_status_mismatch` |

**Related:** `PAID` **with** `PAYMENT_CONFIRMED` but still **without** `confirmPayment`:

| Route | File | Notes |
|-------|------|--------|
| Hedera manual verify | `src/app/api/hedera/transactions/verify/route.ts` | Creates event + ledger inline; no commission/funding orchestration |
| Legacy Hedera | `src/lib/hedera/payment-confirmation.ts` | `confirmHederaPayment` — non-atomic ledger |

**“Paid” without `payment_links` at all:** pilot manual `payment_events`, deal `paymentStatus`, referral `payment_completed`, payout `PAID`.

---

## Integrity tooling (expects canonical)

`src/lib/payments/integrity-checks.ts` flags:

- `PAID_WITHOUT_PAYMENT_CONFIRMED`
- `OPEN_WITH_PAYMENT_CONFIRMED`
- `PAYMENT_CONFIRMED_WITHOUT_LEDGER`
- `PAYMENT_CONFIRMED_WITHOUT_XERO_SYNC`

Run via `POST /api/jobs/ledger-integrity` and repair utilities.

---

## Search index (Step 1 terms)

| Term | Primary locations |
|------|-------------------|
| `PAID` | `state-machine.ts`, manual-settlement, review routes, status API, payouts |
| `PAYMENT_CONFIRMED` | `payment-confirmation.ts`, hedera verify, pilot payment-events, integrity-checks |
| `confirmPayment` | `payment-confirmation.ts`, stripe/wise webhooks, hedera confirm, jobs, scripts |
| `manual settlement` | `manual-settlement/route.ts` |
| `mark paid` | manual-settlement, referrals mark-paid, payouts mark-paid, deal network UI |
| `settlement` | posting-rules, confirmPayment, payout batches |
| `approve` | bank/crypto review `mark_valid`, referral approve, huntpay |
| `payment completed` | `referrals/payment-completed`, conversion types |
| `release payment` | payout-batches/create, pilot-release-batch |

**Server actions:** No production `'use server'` settlement writers found; settlement is API/job/script driven.

---

## Summary

The **documented intent** is single-path: `confirmPayment()` owns `PAYMENT_CONFIRMED`, ledger settlement, and PAID for Stripe/Hedera/Wise.

The **implemented surface** adds multiple operator and manual-verify paths that set **`PAID` without** settlement truth, plus alternate writers of **`PAYMENT_CONFIRMED`** without commission/funding. Pilot and Supabase referral stacks add second “paid” meanings.

See **`payment-path-remediation-plan.md`** for ranked remediation.
