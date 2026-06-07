# R4 Forward Compatibility — Hedera Mirror Verify → confirmPayment

**Date:** 2026-06-04  
**Change:** `POST /api/hedera/transactions/verify` delegates to `executeHederaMirrorSettlement()` → `confirmPayment({ provider: 'hedera' })`.

---

## Behavior changes (forward-looking)

| Before R4 | After R4 |
|-----------|----------|
| Inline `PAID` transition (`hedera-manual-verify`) | `confirmPayment` transition (`confirmPayment:hedera`) |
| Inline `PAYMENT_CONFIRMED` + partial metadata | Canonical event with `source_type: CRYPTO`, `source_reference`, org id |
| Inline `ledger_entries` (manual DR/CR) | `postHederaSettlement` inside `confirmPayment` transaction |
| Async `queueXeroPaymentSyncIfEnabled` only | `xero_syncs` upsert in `confirmPayment` txn + queue semantics |
| Referral conversion only | Referral + **`applyRevenueShareSplits`** + **`orchestrateFundingAfterInvoiceSettlement`** |
| Duplicate verify HTTP 200, no reconcile | Duplicate verify → `confirmPayment` idempotent path → **R5 commission reconcile** |
| Metadata `source: hedera-manual-verify` on transition | Metadata `source: hedera-manual-verify`, `settlementPath: hedera_mirror_verify`, `manuallyVerified: true` on event |

**Unchanged for payers:** Request/response shape of verify API (success, `alreadyProcessed`, transaction summary). Mirror fetch, memo check, and token extraction rules are the same.

---

## providerRef format (Phase 3)

| Field | Value |
|-------|--------|
| **providerRef** | Normalized Hedera transaction id (mirror dash format): `0.0.{account}-{seconds}-{nanos}` |
| **Input** | Accepts HashPack `@` format or mirror `-` format; normalized in `confirmPayment` / `hederaMirrorSettlementProviderRef()` |
| **Idempotency** | `checkHederaIdempotency(normalizedTxId)` — global per on-chain tx id (not per payment link) |
| **correlationId** | `generateCorrelationId('hedera', normalizedTxId)` unless passed through |
| **Ledger idempotency key** | Same as `correlationId` (via `confirmPayment`) |

H1 (`/api/hedera/confirm`) and H2 (transaction-checker) already use this pattern; H3 now aligns.

---

## Affected records

| Cohort | Impact from deploy forward |
|--------|----------------------------|
| New verify settlements | Full canonical pipeline |
| New monitor / confirm settlements | No change (already canonical) |
| **Historical** manual-verify rows (`manuallyVerified: true`) | **Unchanged** — no backfill in R4 |

---

## Historical cohort

Pre-R4 `POST /api/hedera/transactions/verify` settlements remain as stored:

- May lack commission obligations / funding orchestration artifacts
- May use inline ledger entry descriptions
- Repair via R5 reconcile (see `docs/r4-historical-impact-analysis.md`) — **out of scope** for R4 implementation

---

## Replay behavior

| Scenario | Outcome |
|----------|---------|
| Same tx id, second verify call | `alreadyProcessed: true`; R5 `reconcileCommissionArtifactsForPaymentEvent` runs |
| Same link, different tx id | Hedera idempotency is per tx; second tx would attempt new settlement (blocked if link already has `PAYMENT_CONFIRMED` per link guard) |
| Link already `PAID` without event | `confirmPayment` backfill branch (if eligible) |

---

## Observability

Structured log events (hedera logger):

- `hedera_verify_settlement_started`
- `hedera_verify_settlement_completed`
- `hedera_verify_settlement_failed`

Payload includes `paymentLinkId`, `transactionHash` / `normalizedTxId`, `providerRef`, and `paymentEventId` when available.

---

## Success criteria met

- No Hedera verify path creates `PAID` / `PAYMENT_CONFIRMED` / ledger outside `confirmPayment`.
- Settlement calculations, commission math, and funding math unchanged (orchestration only invoked where previously skipped).
