# Workflow Correctness Reassessment

**Date:** 2026-06-04  
**Baseline:** [workflow-consistency-audit.md](./production-readiness/workflow-consistency-audit.md) (2026-05-20), [payment-path-remediation-plan.md](./payment-path-remediation-plan.md), [launch-readiness-review.md](./production-readiness/launch-readiness-review.md)  
**Assumed implemented:** **R1** (manual settlement → `confirmPayment`), **R2** (status API cannot set `PAID`), **R5** (`reconcileCommissionArtifactsForPaymentEvent` on idempotent replay)  
**Method:** Architecture reassessment only — no code changes, no new penetration testing.

---

## Executive summary

The **payment → settlement → commission** spine is materially stronger than at the May 2026 audit. Two critical **“PAID without financial truth”** bypasses (operator manual settlement and generic status API) are closed for **new** operations. **Commission replay gaps** on webhook/idempotent `confirmPayment` are now **repairable** instead of permanent.

What did **not** change: **dual obligation projections**, **bank/crypto `mark_valid`**, **Hedera verify bypass**, **Xero job scheduling**, **pilot UI “Paid” without events**, **tenant debug leak**, and the **first-run `createdObligation` guard** in `applyRevenueShareSplits` (mitigated on replay by R5, not removed at source).

---

## Workflow chain (reassessed)

| Stage | Baseline (May 2026) | After R1 / R2 / R5 |
|-------|---------------------|---------------------|
| **Agreement** | Pilot deals + participants; AI/onboarding races (W-C3) | Unchanged |
| **Obligation** | `deal_network_pilot_obligations` vs `commission_obligations` drift (W-A1) | Unchanged |
| **Allocation** | Operational graph / funding sources; beta gating (W-C1) | Manual settlement now drives funding via `confirmPayment` post-commit (R1) |
| **Payment** | Multiple PAID writers (R1, R2, R3) | Stripe/Wise/Hedera canonical; **R2 blocks status API PAID**; **R3 still open** |
| **Settlement** | `confirmPayment` txn strong; divergent writers | **R1** adds manual rail; **R4/R6/R11 still divergent** |
| **Commission** | Post-commit; replay skipped (R5); items guard (W-A3/R13) | **R5 reconcile** on `alreadyProcessed` + provider idempotency; first-run partial failure still possible |
| **Funding** | Skipped on idempotent replay; manual bridge only | Replay path can re-orchestrate via reconcile (R5) |
| **Payout** | Beta lockdown (W-R4) | Unchanged |
| **Accounting sync** | Xero queued in txn; worker often off (W-X1) | **R7 fixed for new manual** (Xero after ledger in txn); worker still off |

---

## Updated Workflow Integrity Score

| Metric | May 2026 baseline | June 2026 (post R1/R2/R5) |
|--------|-------------------|----------------------------|
| **Workflow integrity score** | **58 / 100** | **71 / 100** |

### Scoring rationale (+13 net)

| Area | Δ | Notes |
|------|---|--------|
| Payment link → settlement convergence | **+6** | R1 + R2 remove two high-likelihood PAID bypasses for new traffic |
| Commission durability on replay | **+5** | R5 repair path; aligns with former P0 B4 / W-A3 for **retries** |
| Operational / projection layers | **0** | W-A1, R8, pilot vs commission UI unchanged |
| Accounting / jobs / security | **+2** | R1 improves Xero-vs-ledger ordering for manual; W-X1/B1/B3 unchanged |
| Residual first-run commission guard (R13) | **−2** | `commission-posting.ts` still gates items on `createdObligation`; reconcile not invoked on same-request failure |

**Interpretation:** Safe to claim **accurate settlement for new operator manual marks and Stripe/Wise/Hedera retries**; still **not** safe to claim end-to-end correctness for **bank/crypto mark_valid**, **Hedera verify**, or **historical rows** without backfill and remaining Phase 1 items (R3, R4).

---

## Original top 10 risks — classification

The baseline top 10 is synthesized from the May workflow audit (**W-***), payment-path **CRITICAL** divergences (**R1–R5**), and launch blockers (**B1, B3, B4, B6**).

| # | Baseline risk | ID(s) | Status | Why |
|---|---------------|-------|--------|-----|
| 1 | **Generic status API can set `PAID` without settlement, ledger, or commission** | R2, D2 | **RESOLVED** | `POST /api/payment-links/[id]/status` blocks `PAID` (409 + policy); valid transitions exclude `PAID` on GET. New invoices cannot be “marked paid” via status API alone. |
| 2 | **Operator manual settlement marks `PAID` without `PAYMENT_CONFIRMED` / ledger / commission** | R1, D1 | **RESOLVED** (forward-looking) | `mark_paid` → `executeOperatorManualInvoiceSettlement` → `confirmPayment({ provider: 'manual' })`. Settlement txn + post-commit commission + funding. **Historical** PAID-without-event rows remain until backfill/repair. |
| 3 | **Commission obligation items missing after partial/idempotent posting; attribution UI empty** | W-A3, R5, R13, B4 | **PARTIALLY RESOLVED** | **R5:** `reconcileCommissionArtifactsForPaymentEvent` runs on `alreadyProcessed` and provider idempotency early return; heals missing obligations/items/lines/ledger keys without duplicating settlement. **R13 not fixed in `applyRevenueShareSplits`:** first invocation can still skip items when obligation already exists (`createdObligation === false`). Same-request failure does not trigger reconcile until a later replay. **No nightly/admin reconcile job** in scope. |
| 4 | **Bank / crypto merchant `mark_valid` → `PAID` without `confirmPayment`** | R3, D3–D4, W-P3 | **NOT RESOLVED** | Review routes still `transitionPaymentLinkState` → `PAID` only; no `confirmPayment`, ledger, or commission. |
| 5 | **Hedera manual verify creates settlement outside `confirmPayment` (no commission/funding)** | R4, D6, R14 | **NOT RESOLVED** | `hedera/transactions/verify` still inline event + ledger pattern per lifecycle doc. |
| 6 | **Dual obligation stores: pilot projection vs commission financial truth** | W-A1, duplicated state | **NOT RESOLVED** | `deal_network_pilot_obligations` vs `commission_obligations` / items; earnings vs project obligations can still diverge by design and refresh timing. |
| 7 | **Xero sync queue not drained in production (jobs disabled)** | W-X1, B3 | **NOT RESOLVED** | Architecture unchanged; `xero_syncs` still depends on worker/cron not assumed enabled. |
| 8 | **Pilot deal UI / refresh treats deal as “Paid” without `payment_events`** | R8 | **NOT RESOLVED** | Client `paymentStatus` and obligation refresh logic not part of R1/R2/R5. |
| 9 | **Cross-tenant exposure via Xero debug (and related debug surfaces)** | W-X3, B1, F-01 | **NOT RESOLVED** | Tenant audit finding; no remediation in R1/R2/R5 scope. |
| 10 | **Parallel Supabase `payment_completed` vs Prisma commission path** | R10 | **NOT RESOLVED** | Dual stacks; risk of double attribution if both fire. |

### Additional baseline findings (not in top 10 but relevant)

| ID | Finding | Status |
|----|---------|--------|
| W-A4 | Legacy path: `commission_obligation_lines` without `items` | **NOT RESOLVED** — reconcile can add lines; attribution UI still reads **items** |
| W-R4 / B6 | Beta lockdown blocks payout batch for normal operators | **NOT RESOLVED** |
| R6 | Legacy `confirmHederaPayment` alternate writer | **NOT RESOLVED** |
| R7 | Xero queued on manual PAID without ledger | **RESOLVED** for new manual (via R1) |
| R11 | Repair utilities promote `PAID` without `confirmPayment` | **NOT RESOLVED** |
| R9 | Pilot manual `PAYMENT_CONFIRMED` without payment link | **NOT RESOLVED** |

---

## Updated top 10 risks (June 2026)

Ranked by **residual business impact** (impact × likelihood), after R1/R2/R5.

| Rank | Risk | Impact | Likelihood | Complexity | Notes |
|------|------|--------|------------|------------|-------|
| 1 | **R3 — Bank/crypto `mark_valid` → PAID without settlement** | Critical | High (if rails used) | Medium | Same class of bug R1/R2 fixed for other paths |
| 2 | **R4 — Hedera verify bypass** | Critical | Medium | Medium | Split-brain with checker `confirmPayment` path |
| 3 | **W-A1 — Dual obligation / earnings vs pilot projection** | High | High | High | Operator trust; needs product truth + reconcile docs |
| 4 | **W-X1 / B3 — Xero queue not processed** | High | High (if feature on) | Medium | Books diverge from platform ledger |
| 5 | **R8 — Pilot “Paid” without payment events** | High | Medium | High | Funding/obligations UI incorrect |
| 6 | **B1 / F-01 — Xero debug cross-tenant leak** | Critical (security) | Medium | Small | Launch blocker from security audit |
| 7 | **R13 / W-A3 (first-run) — `createdObligation` item skip in posting** | High | Low–Medium | Low | R5 mitigates on replay; fix posting guard + optional post-apply reconcile |
| 8 | **R10 — Dual referral/commission stacks** | High | Low–Medium | High | Consolidation or hard gate |
| 9 | **R11 — Orphan repair promotes PAID without confirm** | Medium | Low | Medium | Admin-only but dangerous |
| 10 | **Historical PAID without `PAYMENT_CONFIRMED`** | Medium | Medium (existing data) | Medium | Integrity checks; backfill scripts |

---

## New critical risks

Risks that are **new or elevated** relative to the May baseline (not fully captured as separate top-10 items then):

| Risk | Description |
|------|-------------|
| **Reconcile scope gap** | R5 does not run after a **failed first** `applyRevenueShareSplits` in the same `confirmPayment` call (only on `alreadyProcessed` / provider idempotency). A single failed post-commit commission without retry leaves gap until manual reconcile API/job (not shipped). |
| **Manual rail semantics** | R1 posts manual settlement via **Wise clearing** posting rule (`manual-{providerRef}`). Reporting/training must distinguish off-rail operator settlement from Wise transfers. |
| **Complete-state funding churn** | Reconcile may call `orchestrateFundingAfterInvoiceSettlement` when artifacts already complete (idempotent replay). Low financial risk; possible extra orchestration load. |

---

## Launch blockers (updated)

| # | Blocker | May 2026 | June 2026 |
|---|---------|----------|-----------|
| B1 | Xero debug cross-tenant leak | **Blocker** | **Blocker** |
| B2 | TypeScript / `ignoreBuildErrors` | **Blocker** | **Blocker** (unchanged) |
| B3 | Background jobs not scheduled | **Blocker** | **Blocker** |
| B4 | Commission items skipped on idempotent replay | **Blocker** | **Downgraded to H1** — mitigated by R5 on replay; backfill + R13 still needed for first-run/historical |
| B5 | Production env hardening | **Blocker** | **Blocker** |
| B6 | Beta lockdown vs marketed GA payouts | **Blocker** | **Blocker** (product) |
| — | **R2 status API PAID bypass** | Implicit | **Cleared** for new traffic |
| — | **R1 manual PAID bypass** | Implicit | **Cleared** for new traffic |
| — | **R3 bank/crypto PAID bypass** | High | **New operational blocker** if those rails are GA |

**Recommended launch posture (financial correctness):** Controlled GA for **Stripe + operator manual settlement (R1) + attribution viewing**, with **R3/R4 explicitly out of scope** or disabled until remediated. Do not claim **bank/crypto mark_valid** or **Hedera verify** as settled-in-books without R3/R4.

---

## Recommended next remediation

Prioritized by **impact × likelihood ÷ complexity** (higher priority first).

| Priority | Item | Business impact | Likelihood | Complexity | Rationale |
|----------|------|-----------------|------------|------------|-----------|
| **P0** | **R3** — `mark_valid` → `confirmPayment` | Critical | High | Medium | Last common merchant path that sets invoice PAID without ledger/commission |
| **P0** | **R4** — Hedera verify → `confirmPayment` | Critical | Medium | Medium | Unifies settlement + commission + funding with checker |
| **P0** | **B1** — Fix/remove `GET /api/xero/debug` | Critical (security) | Medium | Small | Independent of payments; launch certification |
| **P1** | **R13** — Remove `createdObligation`-only item guard; optional reconcile after first `applyRevenueShareSplits` | High | Medium | Low | Closes remaining W-A3 hole in one request |
| **P1** | **Admin/nightly commission reconcile job** | High | Medium | Low–Medium | Catches failures that never webhook-retry; completes R5 operational story |
| **P1** | **Historical backfill** — PAID without event + missing obligation items | Medium | High (legacy) | Medium | Integrity score in production data |
| **P2** | **B3 / W-X1** — Enable Xero queue worker/cron | High | High if Xero on | Medium | Accounting sync truth |
| **P2** | **R8** — Tie pilot obligation refresh to `PAYMENT_CONFIRMED` | High | Medium | High | Funding graph truth |
| **P2** | **W-A1 documentation + reconcile** — Single operator “financial truth” screen | High | High | High | Process + optional projection job |
| **P3** | **R6, R11** — Remove/delegate legacy Hedera confirm; repair utilities → `confirmPayment` | Medium | Low | Low–Medium | Prevent regression |
| **P3** | **R10** — Gate or consolidate Supabase referral ledger | High | Low | High | Avoid double attribution |

---

## Resolved vs open (summary)

| Category | Count |
|----------|-------|
| **RESOLVED** (forward-looking) | 2 — R1, R2 |
| **PARTIALLY RESOLVED** | 2 — R5/R13/W-A3 (replay), R7 (manual Xero ordering) |
| **NOT RESOLVED** | 6+ — R3, R4, R6, R8–R11, W-A1, W-X1, B1, B3, B6, W-A4, R10 |

---

## References

| Document | Role |
|----------|------|
| [workflow-consistency-audit.md](./production-readiness/workflow-consistency-audit.md) | May 2026 baseline (58/100) |
| [payment-path-remediation-plan.md](./payment-path-remediation-plan.md) | R1–R20 ranked divergences |
| [canonical-payment-lifecycle.md](./canonical-payment-lifecycle.md) | Pathway map (update post-R1/R2/R5 recommended) |
| [r5-repair-design.md](./r5-repair-design.md) | R5 repair semantics |
| [r1-safety-verification.md](./r1-safety-verification.md) | R1 scope |
| [r2-impact-analysis.md](./r2-impact-analysis.md) | R2 scope |

---

## Acceptance checklist (reassessment)

- [x] Original top 10 reclassified with RESOLVED / PARTIALLY RESOLVED / NOT RESOLVED
- [x] Updated workflow integrity score with rationale
- [x] Updated top 10 residual risks
- [x] New critical risks and launch blockers identified
- [x] Next remediation ranked by impact, likelihood, complexity
- [x] No code modified
