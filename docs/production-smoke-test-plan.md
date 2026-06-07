# Production Smoke Test Plan

**Date:** 2026-06-04  
**Audience:** Ops / QA before controlled GA (10–20 merchants).  
**Environment:** Staging preferred first; production pilot org second.

Use a dedicated test organization with Xero connected (if accounting sync in scope) and referral program configured (if commission in scope).

---

## Common assertions (all rails)

After successful settlement, verify for `payment_link_id = :id`:

| Check | Table / condition | Expected |
|-------|-------------------|----------|
| Status | `payment_links.status` | `PAID` |
| Settlement event | `payment_events` | One `PAYMENT_CONFIRMED` per link |
| Ledger | `ledger_entries` | DR/CR balanced per currency; idempotency keys present |
| FX | `fx_snapshots` | `SETTLEMENT` row (Hedera / when applicable) |
| Xero queue | `xero_syncs` | `sync_type = PAYMENT`, `status` in `PENDING` → `SUCCESS` after cron |
| Commission (if referral on link) | `commission_obligations` | Row with `payment_event_id` = event id |
| Commission lines (if splits) | `commission_obligation_items` | ≥1 row when program active |
| Funding (if pilot_deal) | Operational tables / logs | `orchestrateFundingAfterInvoiceSettlement` trace without fatal error |

**SQL template:**

```sql
SELECT pl.id, pl.status, pl.payment_method, pl.organization_id
FROM payment_links pl WHERE pl.id = :payment_link_id;

SELECT id, event_type, payment_method, source_reference, hedera_transaction_id,
       stripe_payment_intent_id, wise_transfer_id, amount_received, created_at
FROM payment_events WHERE payment_link_id = :payment_link_id ORDER BY created_at;

SELECT entry_type, amount, currency, idempotency_key, description
FROM ledger_entries WHERE payment_link_id = :payment_link_id;

SELECT sync_type, status, retry_count FROM xero_syncs WHERE payment_link_id = :payment_link_id;

SELECT id, status FROM commission_obligations WHERE payment_event_id = :event_id;
```

---

## 1. Stripe

### Setup

- OPEN invoice, `payment_method = STRIPE`, amount e.g. $10.00 AUD/USD
- Stripe Checkout or PaymentIntent with `metadata.paymentLinkId` set
- Webhook endpoint registered; `STRIPE_WEBHOOK_SECRET` matches

### Action

Complete card payment in test/live mode per env policy.

### Expected state

| Artifact | Expected |
|----------|----------|
| `payment_links` | `PAID` |
| `payment_events` | `PAYMENT_CONFIRMED`, `source_type = STRIPE`, `stripe_payment_intent_id` set |
| `ledger_entries` | DR 1050 Stripe Clearing, CR 1200 AR (gross); DR 6100 fee, CR 1050 (fee) |
| Commission | Obligation + items if referral metadata on link/session |
| Funding | If `pilot_deal_id` on link — funding orchestration logs |
| `xero_syncs` | `PAYMENT` / `PENDING` then `SUCCESS` after `xero-queue` cron (~5 min) |

### Replay test

Replay same Stripe event → `alreadyProcessed: true`, no duplicate `PAYMENT_CONFIRMED`, R5 reconcile may run (no duplicate items).

---

## 2. Wise

### Setup

- OPEN Wise invoice; funded transfer webhook configured

### Action

Trigger funded Wise transfer matching link reference / amount rules per `webhooks/wise/route.ts`

### Expected state

| Artifact | Expected |
|----------|----------|
| `payment_events` | `PAYMENT_CONFIRMED`, `source_type = WISE`, `wise_transfer_id` |
| `ledger_entries` | Wise clearing pattern via `postWiseSettlement` |
| Downstream | Same as common assertions |

---

## 3. Hedera — Confirm path

### Setup

- OPEN crypto invoice; merchant Hedera account configured; testnet/mainnet aligned
- Known small HBAR or USDC test payment with memo containing `paymentLinkId`

### Action

`POST /api/hedera/confirm` with `{ paymentLinkId, txId, token }`

### Expected state

| Artifact | Expected |
|----------|----------|
| `payment_events` | `PAYMENT_CONFIRMED`, `hedera_transaction_id` normalized (dash format) |
| `ledger_entries` | DR `1051-{TOKEN}` crypto clearing, CR 1200 AR (invoice currency amount) |
| `fx_snapshots` | SETTLEMENT token → invoice currency |
| Commission / funding / Xero | Same as common |

---

## 4. Hedera — Monitor path

### Setup

- OPEN invoice; payer submits on-chain tx with memo

### Action

Poll `POST /api/hedera/transactions/monitor` until checker matches (UI polling)

### Expected state

Same as Hedera confirm; metadata may include `source: hedera-transaction-checker`

---

## 5. Hedera — Verify path (R4)

### Setup

- OPEN invoice; valid mirror tx id; memo contains link id

### Action

`POST /api/hedera/transactions/verify` with `{ paymentLinkId, transactionId, network }`  
(or UI “queue missed payments” flow after monitor timeout)

### Expected state

Same artifacts as confirm/monitor; event metadata includes `manuallyVerified: true`, `settlementPath: hedera_mirror_verify`

### Duplicate verify

Second call → HTTP 200, `alreadyProcessed: true`; commission reconcile (R5) runs without duplicate event

---

## 6. Operator manual settlement (R1)

### Setup

- OPEN invoice (any method); operator with `edit_payment_links` / manual settlement permission

### Action

`POST /api/payment-links/{id}/manual-settlement` with `action: mark_paid`

### Expected state

| Artifact | Expected |
|----------|----------|
| `payment_events` | `PAYMENT_CONFIRMED`, `provider` manual, `source_reference` like `manual-settlement:{id}` |
| `ledger_entries` | Wise clearing pattern (manual uses `postWiseSettlement` rule) |
| Audit | `audit_logs` `MANUAL_SETTLEMENT_CONFIRMED` |

### Negative

Repeat on same link → idempotent / error per link guard

---

## 7. Bank review (R3)

### Setup

- MANUAL_BANK invoice OPEN

### Action

1. Payer submits bank confirmation → `PAID_UNVERIFIED` (or `REQUIRES_REVIEW`)
2. Merchant `POST .../manual-bank-confirmations/{id}/review` `action: mark_valid`

### Expected state

| Step | `payment_links.status` |
|------|------------------------|
| After submit | `PAID_UNVERIFIED` or `REQUIRES_REVIEW` |
| After mark_valid | `PAID` |

| Artifact | Expected |
|----------|----------|
| `payment_events` | `PAYMENT_CONFIRMED` after mark_valid only |
| `source_reference` | `bank-review:{confirmationId}` |
| Ledger / commission / Xero | Full chain |

---

## 8. Crypto review (R3)

Same as bank review with `crypto_payment_confirmations` and `crypto-review:{confirmationId}` provider ref.

---

## 9. Xero backfill (authorization)

### Setup

- PAID link in org A missing `xero_syncs` row; user member of org A with `manage_settings`

### Action

Settings → queue missed payments (POST backfill with `organizationId`, `scope: organization`)

### Expected

- Only org A links queued
- User in org B cannot backfill org A (403)
- `audit_logs` `XERO_BACKFILL_EXECUTED` for org scope

---

## 10. Cron / ops smoke

| Test | Command / trigger | Pass criteria |
|------|-------------------|---------------|
| Health | `GET /api/health` | 200 |
| Xero processor | Wait for cron or `POST /api/xero/queue/process` with Bearer `CRON_SECRET` | Pending syncs → SUCCESS |
| Financial verification | `GET /api/internal/launch-financial-verification` Bearer cron secret | Review JSON; no new critical settlement issues |
| Stripe recon | Trigger cron or wait 10m | Logs: processed / skipped |

---

## Sign-off

| Rail | Tester | Date | Pass |
|------|--------|------|------|
| Stripe | | | |
| Wise | | | |
| Hedera (3 paths) | | | |
| Manual R1 | | | |
| Bank R3 | | | |
| Crypto R3 | | | |
| Xero backfill | | | |
| Crons | | | |
