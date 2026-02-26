# FX Snapshot Functionality — Full Implementation Audit

**Date:** 2025-02  
**Scope:** All code that reads/writes `fx_snapshots`, creation vs settlement flows, and accountant-facing surface.

---

## STEP 1: All FX Write Paths

### 1.1 Code that WRITES to `fx_snapshots`

| # | File path | Function | Write type | In Prisma tx? | try/catch? | Fail-open/closed |
|---|-----------|----------|------------|---------------|------------|------------------|
| 1 | `src/lib/fx/fx-snapshot-service.ts` | `createSnapshot()` | `prisma.fxSnapshot.create()` | **No** | Yes (logs, rethrows) | **Fail-closed** (throws) |
| 2 | `src/lib/fx/fx-snapshot-service.ts` | `captureAllCreationSnapshots()` | `prisma.fxSnapshot.createMany()` then `prisma.fxSnapshot.findMany()` | **No** | Per-token rate fetch: catch → null (fail-open for single token). createMany not in try. | **Fail-closed** if createMany throws |
| 3 | `src/lib/fx/fx-snapshot-service.ts` | `captureSettlementSnapshot()` | Calls `createSnapshot()` → `prisma.fxSnapshot.create()` | **No** | Yes (in createSnapshot, rethrows) | **Fail-closed** |
| 4 | `src/lib/db/seed.ts` | `seedFxSnapshots()` | `prisma.fx_snapshots.create()` (x2 per link: CREATION + SETTLEMENT for PAID) | **No** | In seed flow only | N/A (seed) |

**Critical:** `fx-snapshot-service.ts` uses **`prisma.fxSnapshot`** and **camelCase** field names (`paymentLinkId`, `snapshotType`, `tokenType`, `baseCurrency`, `quoteCurrency`, `capturedAt`). The Prisma schema defines **`model fx_snapshots`** and **snake_case** columns (`payment_link_id`, `snapshot_type`, `token_type`, `base_currency`, `quote_currency`, `captured_at`). The generated client exposes **`prisma.fx_snapshots`** (model name as-is) and expects **snake_case** in `data` unless `@@map`/field maps are used (they are not). So:

- **Runtime:** `prisma.fxSnapshot` does not exist → **TypeError at first create/createMany** when the FX snapshot service runs.
- **Field names:** If the client were called correctly as `prisma.fx_snapshots`, passing camelCase would still be wrong for the current schema.

So **all production writes from the FX snapshot service are currently broken** at the first Prisma call.

### 1.2 Occurrences of FxSnapshotType / SETTLEMENT / CREATION (read-only or non-write)

- **Read-only:** `src/app/api/payment-links/route.ts` (transformPaymentLink: finds CREATION/SETTLEMENT for fxSummary), `src/app/(dashboard)/dashboard/transactions/page.tsx` (queries SETTLEMENT), `src/lib/services/payment-confirmation.ts` (findFirst SETTLEMENT for Hedera ledger), `src/lib/hedera/payment-confirmation.ts` (findFirst SETTLEMENT), `src/lib/xero/sync-orchestration.ts`, `src/lib/xero/multi-currency-sync.ts`, `src/lib/data/repair-utilities.ts` (MISSING_FX_SNAPSHOT), `src/app/api/public/pay/[shortCode]/route.ts` (CREATION for display), various reports and components.
- **Define/validate:** `src/prisma/schema.prisma` (enum), `src/lib/validations/schemas.ts`, `src/lib/fx/types.ts`.

---

## STEP 2: Payment Link Creation Flow

**Entry:** `src/app/api/payment-links/route.ts` (POST).

1. **Where the payment link is created**  
   - Inside `prisma.$transaction(...)`: `tx.payment_links.create(...)` (and optional `tx.payment_events.create`). Returns `link`.

2. **Where FX snapshot capture is called**  
   - **After** the transaction has committed (lines 348–370).  
   - Code:
     - `const fxService = getFxService();`
     - `const snapshots = await fxService.captureAllCreationSnapshots(paymentLink.id, validatedData.currency as Currency);`
   - It is **awaited**.

3. **Inside or outside the transaction**  
   - **Outside.** FX capture runs after the DB transaction that creates the payment link.

4. **Dependency on validatedData.currency**  
   - Yes. Second argument is `validatedData.currency` (quote currency for the 4-token creation snapshots).

5. **Feature flags**  
   - No feature flag guards this. It runs on every successful payment link creation (after the transaction).

6. **Environment variables**  
   - `getFxService()` → `initialize()` → `initializeRateProviders()` → `RateProviderFactory.initialize()` uses `process.env.COINGECKO_API_KEY` (optional for Pro). No env guard that prevents the call; if the provider throws (e.g. network), the catch below runs.

7. **Silent failure**  
   - **Yes.** The call is wrapped in try/catch (lines 362–370). On any error (including the inevitable Prisma error from `prisma.fxSnapshot` / wrong field names), the catch logs:
     - `loggers.payment.warn(..., 'Failed to capture FX creation snapshots (non-blocking)')`
   - and continues. Response is still 201 with the payment link. So **FX creation snapshot failure is silent to the client and fail-open for the rest of the flow.**

---

## STEP 3: Settlement Flow Per Rail

### STRIPE

- **Webhook handler:** `src/app/api/stripe/webhook/route.ts`.  
  - `handleCheckoutSessionCompleted()` calls `confirmPayment({ provider: 'stripe', ... })`.
- **payment_events:** Written inside unified `confirmPayment()` in `src/lib/services/payment-confirmation.ts` (payment_links update + payment_events create in same transaction).
- **fx_snapshots:** **No.** `confirmPayment()` for Stripe does not call `captureSettlementSnapshot()` or any other write to `fx_snapshots`.  
- **Explicit statement:** **No settlement FX snapshot is written for Stripe.**

### HEDERA

- **Confirm route:** `src/app/api/hedera/confirm/route.ts` → calls `confirmPayment({ provider: 'hedera', tokenType: token, ... })` (unified service).
- **Verify route (manual):** `src/app/api/hedera/transactions/verify/route.ts` → does **not** use `confirmPayment()`. It updates payment_links, creates payment_events and ledger_entries directly; **does not write any fx_snapshots**.
- **Settlement snapshot write:** **None.** No code path calls `captureSettlementSnapshot()` in production. The unified `confirmPayment()` for Hedera **reads** `fx_snapshots` (SETTLEMENT) and **throws** if not found:  
  `throw new Error('FX snapshot not found for ${tokenType} settlement')`  
  So when Hedera confirm goes through the unified service and reaches ledger posting, it **fails** because no SETTLEMENT snapshot exists.
- **token_type source:** From request body (`token` in confirm route) or from verify route’s inferred token from mirror node tx.
- **base_currency / quote_currency:** Would be set by `captureSettlementSnapshot()` (token vs invoice currency), but that is never called.

**Conclusion:** Settlement FX snapshots are **not** written for Hedera. Hedera confirm (unified path) **expects** a SETTLEMENT snapshot and fails; verify route bypasses FX and does not write one.

### WISE

- **Webhook:** `src/app/api/webhooks/wise/route.ts` → on status PAID calls `confirmPayment({ provider: 'wise', ... })`.
- **payment_events:** Created inside `confirmPayment()` for the Wise path.
- **fx_snapshots:** **No.** `confirmPayment()` for Wise does not call `captureSettlementSnapshot()` or any write to `fx_snapshots`. Wise settlement uses `postWiseSettlement()` with `grossAmount` / `currencyReceived` only.
- **Explicit statement:** **No settlement FX snapshot is written for Wise.** Fiat amount/currency are stored on the event and in ledger; no FX snapshot is stored.

---

## STEP 4: All DB Writes to fx_snapshots

| Location | Method | Actually executes in deployed app? | process.env guard? | Disabled in prod? | Early return before write? |
|----------|--------|------------------------------------|--------------------|-------------------|----------------------------|
| `src/lib/fx/fx-snapshot-service.ts` | `prisma.fxSnapshot.create` | **No** — wrong client name (see below) | No | No | No |
| `src/lib/fx/fx-snapshot-service.ts` | `prisma.fxSnapshot.createMany` | **No** — same | No | No | Only if `snapshotData.length === 0` (all rate fetches failed) |
| `src/lib/fx/fx-snapshot-service.ts` | `prisma.fxSnapshot.findMany` | **No** — same | No | No | No |
| `src/lib/db/seed.ts` | `prisma.fx_snapshots.create` | Only when seed is run (e.g. dev/setup) | No | No | Only for links with status OPEN/PAID in seed data |

**Why the service “write” doesn’t execute:**  
The Prisma schema has `model fx_snapshots`. The generated client property is `prisma.fx_snapshots`, not `prisma.fxSnapshot`. So any call to `prisma.fxSnapshot.create` or `createMany` throws (e.g. "fxSnapshot is not a function" or equivalent). That happens on first payment link creation when `captureAllCreationSnapshots` runs; the error is caught and logged as "Failed to capture FX creation snapshots (non-blocking)", so the table remains empty in production for this path. Seed uses `prisma.fx_snapshots` and snake_case and would work if seed is run.

---

## STEP 5: Logging Audit

| Log message / pattern | File | Includes snapshotCount? | Includes paymentLinkId? | Errors swallowed? |
|-----------------------|------|--------------------------|--------------------------|-------------------|
| "FX creation snapshots captured" | `src/app/api/payment-links/route.ts` | Yes (`snapshotCount: snapshots.length`) | Yes (`paymentLinkId`) | No (only on success path) |
| "Failed to capture FX creation snapshots (non-blocking)" | `src/app/api/payment-links/route.ts` | No | Yes | **Yes** — catch logs and continues; no rethrow |
| "Creating FX snapshot" | `src/lib/fx/fx-snapshot-service.ts` | N/A | Yes (in data) | No |
| "Failed to create FX snapshot" | `src/lib/fx/fx-snapshot-service.ts` | N/A | Yes (in data) | No (rethrows) |
| "Batch created FX snapshots for all tokens" | `src/lib/fx/fx-snapshot-service.ts` | Yes (`count: result.count`) | Yes | No |
| "Capturing creation-time snapshots for all tokens" | `src/lib/fx/fx-snapshot-service.ts` | No | Yes | No |
| "Capturing settlement-time snapshot" | `src/lib/fx/fx-snapshot-service.ts` | N/A | Yes | No |
| "FX snapshot not found for settlement" | `src/lib/services/payment-confirmation.ts` | N/A | Implicit (in error) | No (throws) |
| "FX snapshot not found for settlement" | `src/lib/hedera/payment-confirmation.ts` | N/A | Yes (paymentLinkId) | No (throws) |

**Summary:** Creation snapshot failure is the only path where errors are effectively swallowed (logged as warn, no snapshotCount in that log, client still gets 201). No "SETTLEMENT snapshot" success log exists in production because settlement snapshots are never written.

---

## STEP 6: Environment Analysis

- **FX rate provider:**  
  - `src/lib/fx/rate-provider-factory.ts`: CoinGecko (primary), Hedera Mirror (fallback).  
  - CoinGecko: `process.env.COINGECKO_API_KEY` optional (used for Pro base URL).  
  - No other FX-specific API keys in the factory.

- **If provider fails:**  
  - `getRate()` / `getRates()` throw (or propagate provider errors).  
  - In `captureAllCreationSnapshots()`, each token’s rate fetch is `.catch(error => { logger.warn(...); return null; })`. So one failing token yields null for that token and that token is omitted from `snapshotData`. If all four fail, `snapshotData.length === 0` and **no createMany is called** — so no write and no throw; the following findMany returns [] and the route logs "FX creation snapshots captured" with `snapshotCount: 0`. So **partial or total rate failure is fail-open** and can result in zero creation snapshots with a success-style log.

- **FX-related env vars:**  
  - `COINGECKO_API_KEY` (optional)  
  - `DATABASE_URL` (required by Prisma; used for all DB including fx_snapshots)  
  - No `FX_*` or feature flags that disable FX snapshot writes.

- **DB connection:** Single Prisma client from `src/lib/server/prisma.ts`; uses `process.env.DATABASE_URL`. No separate “FX DB” or env that would point to a different DB for FX.

---

## STEP 7: Accountant Surface Area

| Surface | Location | Uses CREATION | Uses SETTLEMENT | Fully / partially / not implemented |
|---------|----------|----------------|-----------------|-------------------------------------|
| Payment link list (fxSummary) | `src/app/api/payment-links/route.ts`, transformPaymentLink | Yes (hasFxCreationSnapshots) | Yes (hasSettlementSnapshot, settlementRate, settlementToken) | **Partial** — UI expects both; SETTLEMENT rarely/never exists |
| Public pay page (rate display) | `src/app/api/public/pay/[shortCode]/route.ts` | Yes (latest CREATION for selection) | No | **Fully** (creation only) |
| Transactions dashboard | `src/app/(dashboard)/dashboard/transactions/page.tsx` | No | Yes (queries SETTLEMENT for each event’s link) | **Partial** — UI shows fiat equivalent only when SETTLEMENT exists |
| Transactions table (fiat equivalent) | `src/components/dashboard/transactions-table.tsx` | No | Yes (settlementSnapshot.rate) | **Partial** — depends on SETTLEMENT |
| Payment link detail dialog | `src/components/payment-links/payment-link-detail-dialog.tsx` | Yes | Yes (CREATION vs SETTLEMENT display) | **Partial** — SETTLEMENT often missing |
| Xero sync / multi-currency | `src/lib/xero/sync-orchestration.ts`, `src/lib/xero/multi-currency-sync.ts` | No | Yes (SETTLEMENT for token_type) | **Partial** — relies on SETTLEMENT |
| Ledger posting (Hedera) | `src/lib/services/payment-confirmation.ts`, `src/lib/hedera/payment-confirmation.ts` | No | Yes (read SETTLEMENT for rate) | **Not** — Hedera path expects SETTLEMENT; missing snapshot causes throw or alternate path |
| Repair / data quality | `src/lib/data/repair-utilities.ts` | No | Yes (flags MISSING_FX_SNAPSHOT) | **Fully** — correctly flags PAID links without SETTLEMENT |
| GDPR export | `src/app/api/gdpr/export/route.ts` | Yes (include fx_snapshots) | Yes | **Fully** (export of whatever is stored) |
| Reports (time-series, token-breakdown, reconciliation, revenue-summary, export) | Various under `src/app/api/reports/` | No | Via payment_events / links (if JOINed to fx_snapshots) | **Partial** — reports don’t consistently join or show settlement rate; fiat equivalent logic depends on SETTLEMENT where used |

**Summary:**  
- **Fully implemented:** Public pay CREATION display; repair utility (MISSING_FX_SNAPSHOT); GDPR export.  
- **Partially implemented:** List/detail/transactions/Xero/reports — they expect or use SETTLEMENT, which is not written in production.  
- **Not implemented:** Settlement snapshot writing on any rail; Hedera confirm (unified) fails when it expects SETTLEMENT for ledger.

---

## STEP 8: Final Output

### A) Current State Summary

- **Creation snapshots (CREATION):**  
  Intended to be written on payment link creation via `getFxService().captureAllCreationSnapshots()` after the create-link transaction. In practice this path **throws** when the FX snapshot service calls `prisma.fxSnapshot.createMany()` (wrong client name and field names), the error is caught in the route, and a warning is logged. So **no creation snapshots are written in production** from the app. Seed can write CREATION (and SETTLEMENT for PAID links) only if run explicitly.

- **Settlement snapshots (SETTLEMENT):**  
  **Never written in production.** No Stripe, Hedera, or Wise handler calls `captureSettlementSnapshot()`. Hedera unified confirm path **requires** a SETTLEMENT snapshot for ledger posting and throws if missing. Manual Hedera verify route does not use FX snapshots and posts ledger directly.

- **Reads:**  
  All reads use `prisma.fx_snapshots` and snake_case and are valid. So the table can contain data only from seed or from a fixed snapshot service; in a normal deployed flow it stays empty.

### B) Why fx_snapshots May Still Be Empty

1. **Wrong Prisma usage in the only production write path:** `fx-snapshot-service.ts` uses `prisma.fxSnapshot` (and camelCase) instead of `prisma.fx_snapshots` (and snake_case), so the first create/createMany in that service throws.  
2. **Silent failure:** Payment link creation catches that error and logs "Failed to capture FX creation snapshots (non-blocking)" without retry or alert, so creation snapshots are never persisted.  
3. **No settlement writes:** No rail (Stripe, Hedera, Wise) calls `captureSettlementSnapshot()`, so SETTLEMENT rows are never written in normal flows.  
4. **Seed optional:** Seed is the only place that uses `prisma.fx_snapshots` correctly; if seed is not run or doesn’t target production DB, the table remains empty.

### C) Rail-by-Rail Status Matrix

| Rail   | Creation snapshots       | Settlement snapshots      | Accountant visible (UI/reports) | Production ready |
|--------|--------------------------|----------------------------|----------------------------------|------------------|
| Stripe | No (service throws)      | No (not implemented)       | Partial (expects SETTLEMENT)     | No               |
| Hedera | No (service throws)      | No (not implemented)       | Partial (expects SETTLEMENT)    | No (confirm fails) |
| Wise   | No (service throws)      | No (not implemented)       | Partial (no FX in Wise path)    | No               |

(Creation column is “no” for all in production because the single creation path fails at Prisma in the FX snapshot service.)

### D) Deployment Risk Assessment

- **High:**  
  - Hedera confirm (unified) fails when posting to ledger due to missing SETTLEMENT snapshot.  
  - Creation snapshot failure is silent; support/ops may assume FX data exists when it does not.  
- **Medium:**  
  - Transactions dashboard and payment link list show “no settlement” or missing fiat equivalent for all payments.  
  - Xero/multi-currency sync may use wrong or missing rates if they assume SETTLEMENT.  
- **Low:**  
  - Public pay page only needs CREATION; it will simply have no rates if the table is empty (or rate selection may fail).  
  - Repair utility correctly detects MISSING_FX_SNAPSHOT; no new data corruption from FX.

### E) Gaps to Close for Full FX Accounting Integrity

1. **Fix FX snapshot service Prisma usage**  
   - Use `prisma.fx_snapshots` (not `prisma.fxSnapshot`).  
   - Use schema field names: `payment_link_id`, `snapshot_type`, `token_type`, `base_currency`, `quote_currency`, `captured_at`, `provider` in all create/createMany/findMany data and where clauses.  
   - Align FxSnapshotData and any DTOs with DB shape or add explicit mapping before calling Prisma.

2. **Implement settlement snapshot writes**  
   - **Stripe:** In `confirmPayment()` after payment_events create, call `captureSettlementSnapshot(paymentLinkId, currencyReceived, invoiceCurrency)` (or equivalent) and store one SETTLEMENT row for the fiat pair used.  
   - **Hedera:** Before or inside the Hedera branch of `confirmPayment()`, call `captureSettlementSnapshot(paymentLinkId, tokenType, invoiceCurrency)` (and use that rate for ledger). Same for the Hedera verify route if it should remain the primary path.  
   - **Wise:** If Wise amounts are converted or need a rate for reporting, call `captureSettlementSnapshot()` (or store an equivalent rate) when Wise status becomes PAID; otherwise document that Wise has no FX snapshot by design.

3. **Creation snapshot reliability**  
   - After fixing the service, consider: run creation capture inside a follow-up job or retry on failure so that transient rate-provider errors don’t leave links with zero CREATION snapshots.  
   - Optionally log or alert when `snapshotCount === 0` after creation capture so silent empty state is visible.

4. **Observability**  
   - Add structured logs (or metrics) when creation/settlement snapshot write succeeds (e.g. paymentLinkId, snapshotType, count).  
   - On settlement write failure, log at error level and consider fail-open vs fail-closed policy (e.g. don’t block payment confirmation, but ensure repair/backfill can run).

5. **Tests and guards**  
   - Unit/integration tests that create a payment link and assert CREATION rows in `fx_snapshots` (with mocked rate provider).  
   - Tests that for each rail (Stripe/Hedera/Wise) a confirmed payment results in the expected SETTLEMENT row(s).  
   - No env or feature flag should disable FX writes in production unless explicitly intended; document any such flag.

6. **DB consistency**  
   - Confirm `DATABASE_URL` (and `DIRECT_DATABASE_URL` if used for migrations) point to the same DB in each environment so that fx_snapshots written by the app and by seed/migrations are in the same database.

---

## Fix Applied (Post-Audit)

**Date:** 2025-02

### Part A — Prisma usage and logging

- **`src/lib/fx/fx-snapshot-service.ts`**  
  - All DB access now uses **`prisma.fx_snapshots`** (matching schema `model fx_snapshots`).  
  - All create/createMany/findMany payloads and `where`/`orderBy` use **snake_case** (`payment_link_id`, `snapshot_type`, `token_type`, `base_currency`, `quote_currency`, `captured_at`).  
  - **token_type** is set for CREATION snapshots (HBAR, USDC, USDT, AUDD) and for SETTLEMENT (token or null for fiat-only rails).  
  - **Logging:** On success, logs `paymentLinkId`, `snapshotCount`, and token list. On failure, logs `paymentLinkId`, `error` message, and `stack` (no secrets).  
  - Creation path remains **fail-open** at the payment-links route (try/catch, 201 still returned).

- **`src/app/api/payment-links/route.ts`**  
  - On FX failure, the catch now logs **error message and stack** in addition to `paymentLinkId`.

### Part B — Settlement snapshot capture

- **Stripe** (`src/lib/services/payment-confirmation.ts`): When `currency_received` matches invoice currency, a **SETTLEMENT** snapshot is created inside the confirmation transaction with `rate=1.0`, `provider='stripe'`, `token_type=null`. If currencies differ, a warning is logged and no snapshot is written.  
- **Hedera** (unified confirm): Before ledger posting, **`getFxService().getRate(tokenType, invoiceCurrency)`** is called and **`getFxSnapshotService().createSettlementSnapshotInTx(tx, …)`** is used to create one SETTLEMENT row with that rate.  
- **Hedera** (manual verify): **`src/app/api/hedera/transactions/verify/route.ts`** now creates a SETTLEMENT snapshot inside the same transaction (after payment event, before ledger entries) using the same rate from `getFxService().getRate()`.  
- **Wise**: Same as Stripe: when received currency matches invoice, a SETTLEMENT snapshot with `rate=1.0`, `provider='wise'`, `token_type=null` is created in the confirmation transaction; otherwise a warning and skip.

- **`createSettlementSnapshotInTx(tx, data)`** was added to the snapshot service for use inside a Prisma transaction (payment confirmation).

### Part C — Verification

- **Dev-only endpoint:** **GET `/api/dev/fx-snapshots-verify?paymentLinkId=<uuid>`**  
  - Returns `creationCount`, `settlementCount`, `tokenTypes`, and the list of snapshots for that payment link.  
  - Only available when **`NODE_ENV !== 'production'`** (returns 404 in production).

### How to verify in psql

```sql
-- Total rows in fx_snapshots
SELECT COUNT(*) FROM fx_snapshots;

-- Snapshots for a specific payment link (replace with real UUID)
SELECT snapshot_type, token_type, base_currency, quote_currency, rate, provider, captured_at
FROM fx_snapshots
WHERE payment_link_id = '<payment_link_id>'
ORDER BY snapshot_type, token_type, captured_at;
```

---

*End of FX Snapshot Implementation Audit*
