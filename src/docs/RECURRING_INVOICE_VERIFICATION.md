# Recurring invoice lifecycle — verification scenarios (Tier 1)

These are **explicit verification steps** (staging or controlled prod), not a new architecture.

## 1. Generation timing

- Create template with `next_run_at` in the near future; run due-template job (or wait for cron).
- **Expect:** one new `payment_links` row (or execution record) per due window; `next_run_at` advances.

## 2. Invoice numbering

- **Expect:** `invoice_reference` / display invoice number follows org rules; no collision with manually created links if your product enforces uniqueness.

## 3. Duplicate prevention

- Force the same template + same `next_run_at` window twice (replay job).
- **Expect:** log such as “Skipping duplicate recurring execution” / no second link for the same execution key.

## 4. Pause / resume

- Pause template → job skips; resume → next run schedules correctly.

## 5. Payment settlement

- Pay the generated link on an enabled rail (Stripe / Hedera / Wise).
- **Expect:** single `PAYMENT_CONFIRMED`; link `PAID`; ledger + FX consistent with one-off links.

## 6. Revenue share

- If template/link carries referral splits / `referral_link_id`:
- **Expect:** same `computeSplitAmounts` rules as one-off; partial % does **not** over-allocate (see commission fix).

## 7. Xero sync

- **Expect:** INVOICE / PAYMENT queue rows as for normal links; processor completes under lease.

## 8. Replay / retry safety

- Replay webhook or reconciliation against the same paid recurring-generated link.
- **Expect:** idempotent settlement; no duplicate commission lines for the same source id.
