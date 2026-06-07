# R4 Remediation Analysis — Hedera Canonical Settlement

**Date:** 2026-06-04  
**Related:** [r4-canonical-integration-design.md](./r4-canonical-integration-design.md), [r4-historical-impact-analysis.md](./r4-historical-impact-analysis.md)  
**Recommendation:** Implement **Option C** — thin adapter → `confirmPayment({ provider: 'hedera' })`.

---

## Executive summary

| Item | Assessment |
|------|------------|
| **Blocker severity** | **P0** for launch claims on Hedera invoice payments when UI uses direct verify |
| **Root cause** | `POST /api/hedera/transactions/verify` inline settlement predates full `confirmPayment` adoption |
| **Fix size** | **Small–Medium** (one route + small module; delete inline txn) |
| **Already canonical** | Monitor/checker (H2), `/api/hedera/confirm` (H1) |
| **Historical repair** | R5 reconcile on `manuallyVerified` cohort — separate phase |

---

## Risk ranking

| Rank | Risk | Likelihood | Impact | Mitigation |
|------|------|------------|--------|------------|
| 1 | Verify path skips commission/funding | **High** (UI retry path) | **High** — earnings/funding graph wrong | Route → `confirmPayment` |
| 2 | Split ledger implementation (inline vs `postHederaSettlement`) | Medium | Medium — rare imbalance | Single ledger path via confirmPayment |
| 3 | Idempotent verify returns without R5 reconcile | Medium | Medium — stuck gaps | Inherited from confirmPayment after fix |
| 4 | Legacy `confirmHederaPayment` / `retryLedgerPosting` confusion | Low (no route) | Low | Deprecate + docs |
| 5 | Historical manual-verify rows | Medium (existing data) | Medium | R5 batch reconcile |

---

## Implementation complexity

| Work item | Effort | Notes |
|-----------|--------|-------|
| Extract mirror validation helper (shared verify + checker) | **S** | Optional dedup |
| `executeHederaMirrorSettlement` adapter | **S** | Mirror R3 pattern |
| Refactor `verify/route.ts` | **S** | Remove inline txn ~lines 392–490 |
| Deprecate `confirmHederaPayment` | **S** | Redirect or delete; update repair-utilities |
| Tests (contract + adapter unit) | **M** | Mock mirror + confirmPayment |
| Historical reconcile script | **M** | Ops; uses existing R5 |
| Docs / runbooks | **S** | Update canonical-payment-lifecycle |

**Total engineering:** ~1–2 days focused; **not** a multi-week rail rebuild.

---

## Testing requirements

| Test | Purpose |
|------|---------|
| Verify route calls `confirmPayment` with `provider: 'hedera'` | No inline `ledger_entries.create` in route |
| Monitor/checker still calls `confirmPayment` | Regression guard |
| `/api/hedera/confirm` unchanged contract | Regression guard |
| Idempotent second verify → `alreadyProcessed` + reconcile invoked | R5 wiring |
| Metadata `manuallyVerified: true` preserved in `confirmPayment` metadata | Audit trail |
| OPEN → PAID happy path (integration or mocked) | State machine |
| Development: `sk_test` / testnet unchanged | No production guard regression |

**Do not require** on-chain E2E in CI — contract tests sufficient.

---

## Migration concerns

| Concern | Handling |
|---------|----------|
| In-flight verify during deploy | Idempotent tx id — second call safe |
| Duplicate `PAYMENT_CONFIRMED` | Per-link guard in `confirmPayment` prevents double insert |
| PAID without event (edge) | Use confirmPayment PAID backfill branch (from R3) if needed |
| Ledger already exists from H3 | `confirmPayment` may fail or skip — **run reconcile before re-verify** on historical rows |
| Commission double-post | `applyRevenueShareSplits` idempotent on obligation — low risk |

---

## Operational risk

| Scenario | Before R4 | After R4 |
|----------|-----------|------------|
| Payer uses monitor polling | Canonical | Unchanged |
| Payer uses direct verify after timeout | Partial settlement | Full canonical |
| Ops manual verify via API | Partial | Full canonical |
| Finance expects commission on all PAID Hedera | **False** for verify cohort | **True** forward-looking |
| Pilot funding graph | Incomplete for verify | Complete forward-looking |

**Comms:** After deploy, run historical reconcile on `manuallyVerified` cohort (see historical impact doc).

---

## Comparison to other remediations

| Remediation | Similarity to R4 |
|-------------|------------------|
| **R3** (bank/crypto review) | Same adapter → `confirmPayment` pattern; different provider (`manual` vs `hedera`) |
| **R1** (operator manual) | Same; OPEN-only entry |
| **R5** (commission reconcile) | Complements R4 for historical + idempotent replay |

---

## Recommended implementation plan

### Phase 0 — Preconditions (no code)

- [ ] Run historical inventory SQL ([r4-historical-impact-analysis.md](./r4-historical-impact-analysis.md))  
- [ ] Confirm `%` of Hedera volume via verify vs monitor (logs / metadata)  

### Phase 1 — Core R4 (code)

1. Add `src/lib/hedera/hedera-mirror-settlement.server.ts`  
   - Input: `{ paymentLinkId, transactionId, network }`  
   - Mirror fetch + memo/amount validation (move from verify route)  
   - Output: `confirmPayment({ provider: 'hedera', ... })`  

2. Refactor `src/app/api/hedera/transactions/verify/route.ts`  
   - HTTP layer only; delegate to adapter  
   - Map errors from `confirmPayment` to HTTP status  

3. Mark `confirmHederaPayment` deprecated  
   - `batchConfirmHederaPayments` → adapter or remove  
   - `repair-utilities.ts` → prefer R5 reconcile  

### Phase 2 — Tests

- Contract: verify route source does not contain inline settlement  
- Unit: adapter builds correct `confirmPayment` params  
- Regression: `transaction-checker` still references `confirmPayment`  

### Phase 3 — Historical (ops, can parallel)

- Dry-run R5 reconcile on `manuallyVerified` events  
- Report gaps before/after  

### Phase 4 — Launch

- Update `canonical-payment-lifecycle.md` D6 → resolved  
- Re-run launch readiness R4 row → closed for forward path  

---

## Launch readiness impact (expected)

| Metric | Before R4 fix |
|--------|----------------|
| R4 blocker | **Open** if Hedera GA includes public pay + verify retry |
| Workflow integrity | Hedera split-brain |
| Controlled GA | Hedera OK only if ops **disable** direct verify UI branch |
| After R4 + historical reconcile | Hedera invoice rail aligned with Stripe/Wise/manual |

---

## Decision log

| Option | Decision |
|--------|----------|
| A — Pre-create event | Rejected |
| B — Named wrapper only | Equivalent to C |
| **C — Thin adapter → confirmPayment** | **Selected** |
| D — Keep inline verify | Rejected |

---

## Success criteria (R4 complete)

1. `POST /api/hedera/transactions/verify` cannot reach `PAID` without `confirmPayment`.  
2. Monitor and confirm paths remain canonical (regression-free).  
3. Post-commit commission + funding run on all **new** Hedera settlements.  
4. Historical impact documented with reconcile playbook.  
5. No changes to `postHederaSettlement`, commission formulas, or funding graph math.

---

## References

| Document / file | Role |
|-----------------|------|
| `docs/r4-canonical-integration-design.md` | Full path trace + Option C |
| `docs/r4-historical-impact-analysis.md` | SQL + backfill |
| `docs/canonical-payment-lifecycle.md` | Baseline divergence D6/D7 |
| `src/app/api/hedera/transactions/verify/route.ts` | Primary defect |
| `src/lib/hedera/transaction-checker.ts` | Canonical reference implementation |
| `src/lib/services/payment-confirmation.ts` | Settlement orchestrator |
