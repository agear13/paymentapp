# Provvypay Refund Modeling Audit & Implementation

## 1) Stripe webhook handler – event types and DB writes

**File:** `src/app/api/stripe/webhook/route.ts`

| Event type | DB writes |
|------------|-----------|
| **payment_intent.succeeded** | `confirmPayment()` → inside it: `payment_links.status` → PAID; `payment_events` create (PAYMENT_CONFIRMED, stripe_event_id, stripe_payment_intent_id, amount_received, currency_received); FX settlement snapshot; **ledger_entries** via `postStripeSettlement()` (DR 1050, CR 1200 gross; DR 6100, CR 1050 fee). |
| **payment_intent.payment_failed** | `payment_events` create (PAYMENT_FAILED, stripe_event_id, stripe_payment_intent_id, metadata with lastPaymentError). No payment_links or ledger change. |
| **payment_intent.canceled** | `payment_events` create (CANCELED, stripe_payment_intent_id, metadata). No payment_links or ledger. |
| **checkout.session.completed** | Same as payment_intent.succeeded via `confirmPayment()`; then best-effort `applyRevenueShareSplits()` (commission). |
| **checkout.session.expired** | Log only; no DB writes. |
| **refund.created** / **refund.updated** | `handleRefundObjectEvent()` → REFUND_CONFIRMED (correlation_id = stripe_refund_&lt;refundId&gt;), ledger reversal (stripe-refund-&lt;refundId&gt;-0/1), payment_links.status. |
| **charge.refund.created** / **charge.refund.updated** | Same as above (routed to handleRefundObjectEvent in default). |
| **charge.refunded** | Log only; no DB or ledger writes (refund.* is single source of truth). |

Idempotency at webhook entry: `prisma.payment_events.findFirst({ where: { stripe_event_id: event.id } })` — if any payment_event has this `stripe_event_id`, return 200 without processing.

---

## 2) How PAYMENT_CONFIRMED is created

- **Trigger:** `payment_intent.succeeded` or `checkout.session.completed`.
- **Flow:** Webhook calls `confirmPayment({ paymentLinkId, provider: 'stripe', providerRef: event.id, paymentIntentId, amountReceived, currencyReceived, ... })`.
- **Stripe fields:**  
  - `event.id` → idempotency (`providerRef` / `stripe_event_id`).  
  - `paymentIntent.amount_received` or `paymentIntent.amount` (cents) → `amountReceived`.  
  - `paymentIntent.currency` → `currencyReceived`.  
  - `paymentIntent.id` → `stripe_payment_intent_id`.  
  - For checkout: `session.amount_total`, `session.currency`, `session.payment_intent`.
- **Idempotency:**  
  1. **Webhook:** Any `payment_events` row with `stripe_event_id = event.id` → skip.  
  2. **confirmPayment:** `checkStripeIdempotency(providerRef)` = `findFirst({ stripe_event_id: providerRef })` → if exists, return `alreadyProcessed: true`.  
  3. In transaction: link must be OPEN; then create PAYMENT_CONFIRMED with `stripe_event_id: providerRef`, update link to PAID.  
- No unique constraint on `stripe_event_id`; application logic prevents duplicate processing.

---

## 3) Ledger posting for Stripe

**File:** `src/lib/ledger/posting-rules/stripe.ts`

- **postStripeSettlement(params):**  
  1. **Gross:** DR 1050 Stripe Clearing, CR 1200 Accounts Receivable (`grossAmount`).  
     - Idempotency key: `stripe-payment-${stripePaymentIntentId}`.  
  2. **Fee (if feeAmount > 0):** DR 6100 Processor Fee Expense, CR 1050 Stripe Clearing (`feeAmount`).  
     - Idempotency key: `stripe-fee-${stripePaymentIntentId}`.

- **calculateStripeFee(amountCents, currency):** 2.9% + $0.30; used when balance_transaction not expanded.

- **Accounts:** 1050 (STRIPE_CLEARING), 1200 (ACCOUNTS_RECEIVABLE), 6100 (PROCESSOR_FEE_EXPENSE) from `LEDGER_ACCOUNTS` in `src/lib/ledger/account-mapping.ts`.

- **Idempotency:** `LedgerEntryService.postJournalEntries({ idempotencyKey })`; each entry gets `idempotency_key: ${idempotencyKey}-${i}`; `checkIdempotency(firstEntryKey)` skips if `ledger_entries` already exist for that key.

---

## 4) DB schema relevant to refunds

- **PaymentEventType:** CREATED, OPENED, PAYMENT_INITIATED, PAYMENT_PENDING, PAYMENT_CONFIRMED, PAYMENT_FAILED, EXPIRED, CANCELED.  
  **Add:** REFUND_CONFIRMED (optionally REFUND_INITIATED, REFUND_FAILED).

- **PaymentLinkStatus:** DRAFT, OPEN, PAID, EXPIRED, CANCELED.  
  **Add:** PARTIALLY_REFUNDED, REFUNDED.

- **payment_events:** id, payment_link_id, event_type, payment_method, stripe_payment_intent_id, stripe_event_id, hedera_transaction_id, wise_transfer_id, amount_received (Decimal), currency_received, correlation_id, metadata, created_at.  
  Refund: use same table; REFUND_CONFIRMED with positive `amount_received` = refund amount; `stripe_event_id` = webhook event id for idempotency.

- **ledger_entries:** id, payment_link_id, ledger_account_id, entry_type (DEBIT/CREDIT), amount, currency, description, idempotency_key (unique), created_at.  
  Reversal: new entries with opposite DR/CR for refund amount; idempotency_key e.g. `stripe-refund-${stripeEventId}`.

---

## 5) Minimal refund model (proposal)

- **PaymentEventType:** Add REFUND_CONFIRMED only for launch.
- **PaymentLinkStatus:** Add PARTIALLY_REFUNDED, REFUNDED.
- **Stripe:** Handle `charge.refunded`.  
  - **a)** Create `payment_events` with event_type REFUND_CONFIRMED, positive `amount_received` = refund amount (dollars), `stripe_event_id` = event.id, `stripe_payment_intent_id` = charge.payment_intent; same payment_link_id as original payment.  
  - **b)** Ledger: reversal of gross only — DR 1200 A/R, CR 1050 Stripe Clearing for refund amount (no fee reversal for launch).  
  - **c)** Update `payment_links.status`: total_refunded = sum(REFUND_CONFIRMED.amount_received for link); if total_refunded >= paid amount → REFUNDED; else if total_refunded > 0 → PARTIALLY_REFUNDED; else leave PAID.  
  - **d)** Idempotency: webhook level by `stripe_event_id` (existing check); ledger by `stripe-refund-${event.id}`.

**Convention:** REFUND_CONFIRMED rows store refund amount as **positive** `amount_received`. Net paid = sum(PAYMENT_CONFIRMED.amount_received) − sum(REFUND_CONFIRMED.amount_received).

---

## 6) Files to change

| File | Change |
|------|--------|
| `src/prisma/schema.prisma` | Add REFUND_CONFIRMED to PaymentEventType; add PARTIALLY_REFUNDED, REFUNDED to PaymentLinkStatus. |
| `src/prisma/migrations/YYYYMMDD_refund_enums/migration.sql` | ALTER TYPE for both enums. |
| `src/app/api/stripe/webhook/route.ts` | Handle `charge.refunded`: resolve payment_link_id from charge.payment_intent, compute refund delta, create REFUND_CONFIRMED, call refund ledger reversal, update link status; idempotency via existing stripe_event_id check. |
| `src/lib/ledger/posting-rules/stripe.ts` | Add `postStripeRefundReversal(paymentLinkId, organizationId, stripePaymentIntentId, refundAmountDollars, currency, stripeEventId, correlationId?)` — posts DR 1200, CR 1050; idempotency key `stripe-refund-${stripeEventId}`. |

---

## 7) Migration steps (Prisma + Postgres)

1. **Schema:** Add enum values in `schema.prisma` (see below).
2. **Migration:** Create new migration folder and SQL:
   - `ALTER TYPE "PaymentEventType" ADD VALUE IF NOT EXISTS 'REFUND_CONFIRMED';`
   - `ALTER TYPE "PaymentLinkStatus" ADD VALUE IF NOT EXISTS 'PARTIALLY_REFUNDED';`
   - `ALTER TYPE "PaymentLinkStatus" ADD VALUE IF NOT EXISTS 'REFUNDED';`
3. Run `npx prisma migrate deploy` (or `migrate dev`).
4. Run `npx prisma generate`.

---

## 8) Webhook handler and ledger reversal (implemented)

- **charge.refunded:** Event object is `Charge`.  
  - `charge.payment_intent` = PaymentIntent id; `charge.amount_refunded` = cumulative refunded (cents).  
  - Resolve payment_link_id: `payment_events.findFirst({ where: { stripe_payment_intent_id: paymentIntentId, event_type: 'PAYMENT_CONFIRMED' }, select: { payment_link_id: true } })`.  
  - Already refunded for this intent: `sum(REFUND_CONFIRMED where payment_link_id and stripe_payment_intent_id = paymentIntentId).amount_received`.  
  - Delta = `charge.amount_refunded/100 - alreadyRefundedDollars`; if delta <= 0, skip (idempotent).  
  - Create `payment_events` REFUND_CONFIRMED with `amount_received = delta`, `stripe_event_id = event.id`, `stripe_payment_intent_id`, `currency_received`.  
  - Call `postStripeRefundReversal(...)` with refund amount and `stripeEventId: event.id`.  
  - Recompute status: total_paid = sum(PAYMENT_CONFIRMED), total_refunded = sum(REFUND_CONFIRMED); if total_refunded >= total_paid → REFUNDED, else if total_refunded > 0 → PARTIALLY_REFUNDED, else PAID. Update `payment_links.status`.

- **Ledger:** `postStripeRefundReversal` in `stripe.ts`: DR 1200 A/R, CR 1050 Stripe Clearing; idempotencyKey `stripe-refund-${stripeEventId}`.

---

## 9) Five SQL queries to verify after a refund

```sql
-- 1) Refund events present for the link
SELECT id, event_type, amount_received, currency_received, stripe_event_id, stripe_payment_intent_id, created_at
FROM payment_events
WHERE payment_link_id = :payment_link_id
  AND event_type IN ('PAYMENT_CONFIRMED', 'REFUND_CONFIRMED')
ORDER BY created_at;

-- 2) Payment link status updated
SELECT id, status, amount, currency, updated_at
FROM payment_links
WHERE id = :payment_link_id;

-- 3) Ledger balanced (refund reversal entries exist; DR 1200 = CR 1050 for refund)
SELECT le.id, la.code, le.entry_type, le.amount, le.currency, le.idempotency_key, le.description
FROM ledger_entries le
JOIN ledger_accounts la ON la.id = le.ledger_account_id
WHERE le.payment_link_id = :payment_link_id
  AND le.idempotency_key LIKE 'stripe-refund-%'
ORDER BY le.created_at;

-- 4) Totals correct: paid - refunded = net
SELECT
  (SELECT COALESCE(SUM(amount_received), 0) FROM payment_events WHERE payment_link_id = :payment_link_id AND event_type = 'PAYMENT_CONFIRMED') AS total_paid,
  (SELECT COALESCE(SUM(amount_received), 0) FROM payment_events WHERE payment_link_id = :payment_link_id AND event_type = 'REFUND_CONFIRMED') AS total_refunded,
  (SELECT COALESCE(SUM(amount_received), 0) FROM payment_events WHERE payment_link_id = :payment_link_id AND event_type = 'PAYMENT_CONFIRMED')
  - (SELECT COALESCE(SUM(amount_received), 0) FROM payment_events WHERE payment_link_id = :payment_link_id AND event_type = 'REFUND_CONFIRMED') AS net;

-- 5) Ledger balance check: Stripe Clearing (1050) and A/R (1200) net for this link
SELECT la.code, SUM(CASE WHEN le.entry_type = 'DEBIT' THEN le.amount ELSE -le.amount END) AS net
FROM ledger_entries le
JOIN ledger_accounts la ON la.id = le.ledger_account_id
WHERE le.payment_link_id = :payment_link_id
  AND la.code IN ('1050', '1200')
GROUP BY la.code;
```

---

## Duplicate detection (REFUND_CONFIRMED)

To detect duplicate REFUND_CONFIRMED rows (e.g. from legacy charge.refunded + refund.* double-write):

```sql
SELECT correlation_id, COUNT(*) AS cnt
FROM payment_events
WHERE event_type = 'REFUND_CONFIRMED'
GROUP BY correlation_id
HAVING COUNT(*) > 1;
```

If any row is returned, the same refund was processed more than once. Single-path ingestion (refund.* only; charge.refunded log-only) prevents new duplicates.

---

## Constraints satisfied

- Minimal for launch: one new event type, two new statuses, one new webhook case, one new ledger helper.
- No new table: reuse payment_events and ledger_entries.
- **Single-path refund:** Only `refund.created` / `refund.updated` (and fallback `charge.refund.created` / `charge.refund.updated`) write REFUND_CONFIRMED and ledger reversals; `charge.refunded` is log-only and never writes.
- Partial and multiple refunds: one REFUND_CONFIRMED per refundId; status derived from cumulative refunded vs paid.
