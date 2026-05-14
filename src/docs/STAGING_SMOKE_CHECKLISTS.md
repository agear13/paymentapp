# Staging smoke checklists — launch financial verification

Use after deploy to staging with real providers (test mode where applicable).  
Check **payment → settlement → ledger → commission / revenue share → Xero → replay**.

---

## A. Stripe

| Step | Verify |
|------|--------|
| Pay | Checkout completes; `payment_intent` / session succeeded |
| Settlement | Exactly one `PAYMENT_CONFIRMED` for the link; link `PAID` (or correct terminal state) |
| Ledger | Balanced postings for settlement amount; no duplicate settlement pair |
| Commission | If referral metadata present: obligation + ledger commission lines match expected % of basis |
| Xero | INVOICE + PAYMENT sync rows created / completed (or intentionally skipped if feature off) |
| Replay | Re-deliver same webhook / internal replay → idempotent (no second `PAYMENT_CONFIRMED`) |

---

## B. Hedera

| Step | Verify |
|------|--------|
| Pay | Confirmed on-chain amount matches quoted minor units |
| Settlement | `confirmPayment` with Hedera provider; one `PAYMENT_CONFIRMED` |
| Invoice currency | `invoice_currency` / display matches product expectation (HBAR vs invoice AUD/USD) |
| Ledger | Hedera posting rule applied; clearing accounts sane |
| FX | Settlement snapshot row exists where expected for multi-token / AUD paths |
| Xero | Queue entries for link; processor completes under lease |
| Replay | Duplicate verify / replay → `alreadyProcessed` or equivalent |

---

## C. Wise

| Step | Verify |
|------|--------|
| Pay | Wise transfer reaches success state in app |
| Settlement | One `PAYMENT_CONFIRMED`; link paid |
| Ledger | Wise settlement postings balanced |
| Commission | If `referral_link_id` on link: revenue share from basis (not double-counted) |
| Xero | PAYMENT (and INVOICE if applicable) sync |
| Replay | Re-run confirmation job / webhook → no duplicate settlement |

---

## D. Recurring invoice

| Step | Verify |
|------|--------|
| Generation | Due template creates new payment link / invoice row with correct amount |
| Numbering | `invoice_reference` / `xero_invoice_number` policy matches org rules |
| Duplicate prevention | Second run for same execution window does not duplicate link |
| Pause / resume | Paused template does not run; resume picks up next `next_run_at` |
| Pay | Customer pays generated link on any enabled rail |
| Revenue share | Same commission rules as one-off once `PAYMENT_CONFIRMED` |
| Xero | New invoice sync for generated link |
| Replay | Re-run template job → skip or no-op duplicate execution log |

---

## E. Refund flow (Stripe)

| Step | Verify |
|------|--------|
| Refund object | `refund.created` / `refund.updated` (succeeded) processed once |
| Ledger | Reversal postings balanced; idempotency keys include refund id |
| Status | `PARTIALLY_REFUNDED` vs `REFUNDED` matches cumulative refunded vs paid |
| Commission | No duplicate reversal; obligations consistent (if applicable) |
| Replay | Same refund event replay → duplicate audit skip, no second reversal |

---

## Operational API (optional)

- `GET /api/internal/system-integrity` — DB / ledger / Xero anomaly scan (Bearer `CRON_SECRET` or admin).
- `GET /api/internal/launch-financial-verification` — integrity snapshot **plus** deterministic revenue-share matrix JSON + `revenueShareMatrixText`.

CLI matrix (no DB):

```bash
cd src && npx tsx scripts/verify-revenue-share-matrix.ts
```
