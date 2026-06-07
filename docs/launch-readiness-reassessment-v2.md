# Launch Readiness Reassessment v2

**Date:** 2026-06-04  
**Baseline (comparison only):** [launch-readiness-review.md](./production-readiness/launch-readiness-review.md) (2026-05-20, **62%**); [launch-readiness-reassessment.md](./launch-readiness-reassessment.md) (post R1/R2/R5/B1, **68%**)  
**Remediations verified in current `src/`:** **R1**, **R2**, **R3**, **R5**, **B1**  
**Method:** Documentation-only reassessment; spot-checks against routes, `confirmPayment`, `render.yaml`, and remediation modules (no penetration retest, no production DB queries).

---

## Executive summary

Launch posture improved from **62% (May) → 68% (v1) → 70% (v2)** on the same seven-dimension model. **R3** closes the last major **payment-link settlement bypass** for assisted bank/crypto merchant review; combined with **R1/R2/R5**, new money-in paths for invoices now converge on `confirmPayment()` except **Hedera manual mirror verify (R4)** and **repair utilities (R11)**.

**Certification:** **Controlled GA ready** for payment links + automated rails + operator manual settlement + **bank/crypto mark valid** (forward-looking), with explicit acceptance of job scheduling, build safety, env hardening, beta payout lockdown, Xero backfill tenancy, Hedera verify divergence, and historical data repair gaps.

**Not** **public launch ready** or **enterprise ready**.

---

## Updated scores

### Summary table (requested dimensions)

| Score | May 2026 | v1 (R1/R2/R5/B1) | **v2 (+ R3)** | Δ vs May | Δ vs v1 |
|-------|----------|------------------|---------------|----------|---------|
| **Launch readiness (overall)** | **62%** | **68%** | **70%** | **+8** | **+2** |
| **Workflow integrity** | **58** | **72** | **82** | **+24** | **+10** |
| **Security** | **68** | **80** | **79** | **+11** | **−1** |
| **Authorization** | **70** | **75** | **75** | **+5** | **0** |
| **Financial controls** | **72** | **78** | **85** | **+13** | **+7** |
| **Operational readiness** | **50** | **50** | **50** | **0** | **0** |

### Full seven-dimension model (May parity)

| Dimension | May | v1 | **v2** | Rationale (current codebase) |
|-----------|-----|-----|--------|------------------------------|
| Infrastructure | 65 | 65 | **65** | `render.yaml` still Phase 1 web-only; worker/cron blocks commented out |
| **Security** | 68 | 80 | **79** | B1 resolved (`xero/debug` deleted, UI link removed); **B2** `ignoreBuildErrors: true` + **global Xero backfill** remain high-severity |
| **Authorization** | 70 | 75 | **75** | Org RBAC on review/settlement routes; backfill is auth-gated but **not org-scoped** |
| **Workflow integrity** | 58 | 72 | **82** | R1/R2/R3/R5 close primary PAID bypasses; **R4/R6/R11** + pilot dual-model gaps remain |
| **Financial controls** | 72 | 78 | **85** | Canonical txn for Stripe/Wise/Hedera checker, R1 manual, **R3 assisted review**; R4 verify skips commission/funding orchestration |
| Observability | 52 | 52 | **54** | R3 `bank_review_settlement_*` / `crypto_review_settlement_*` traces; Sentry/alerting still not codified |
| **Operational readiness** | 50 | 50 | **50** | B3 unchanged — jobs depend on external cron or disabled Render services |

**Overall launch readiness** = arithmetic mean of seven dimensions = **(65 + 79 + 75 + 82 + 85 + 54 + 50) / 7 ≈ 70%**.

---

## Remediations closed since May (cumulative)

| ID | What changed (verified) | Effect |
|----|-------------------------|--------|
| **R1** | `executeOperatorManualInvoiceSettlement` → `confirmPayment({ provider: 'manual' })` | Operator OPEN → PAID is canonical |
| **R2** | Status API blocks `PAID` (`PAID_TRANSITION_BLOCKED_CODE`) | No raw status settlement |
| **R3** | `executeAssistedReviewSettlement` → `confirmPayment`; refs `bank-review:{id}` / `crypto-review:{id}`; `CONFIRM_PAYMENT_SETTLEMENT_ENTRY_STATUSES` includes `PAID_UNVERIFIED`, `REQUIRES_REVIEW` | Bank/crypto **mark_valid** is canonical for **new** approvals |
| **R5** | `reconcileCommissionArtifactsForPaymentEvent` on idempotent / early-return paths in `confirmPayment` | Replay heals commission gaps; does not fix same-request first-run skip |
| **B1** | `GET /api/xero/debug` removed; dashboard diagnostics link removed | Cross-tenant debug leak closed |

---

## Previous blockers — status in current codebase

| ID | Still exists? | Evidence / notes |
|----|---------------|------------------|
| **B2** | **Yes** | `src/next.config.ts` — `typescript.ignoreBuildErrors: true`; `build-integrity-audit.md` documents **698** `typecheck:repo` errors |
| **B3** | **Yes** | `render.yaml` — worker and cron services **commented out** (Phase 2); Xero/integrity/reconciliation depend on `/api/jobs/*` + external scheduler |
| **B5** | **Yes** (unverified in repo) | Runtime env checklist not automatable from code; `STRIPE_WEBHOOK_SECRET`, `CRON_SECRET`, placeholder detection remain operator responsibilities |
| **B6** | **Yes** | `BETA_LOCKDOWN_MODE !== 'false'` gates payout batch, commissions ledger, payout methods, etc. (multiple routes) |
| **R4** | **Yes** | `src/app/api/hedera/transactions/verify/route.ts` — inline txn: state → `PAID`, `payment_events`, ledger, referral conversion, Xero queue; **no** `confirmPayment`, **no** `applyRevenueShareSplits`, **no** `orchestrateFundingAfterInvoiceSettlement` (contrast `transaction-checker.ts` → `confirmPayment`) |
| **Backfill endpoint** | **Yes** | `POST /api/xero/queue/backfill` — `where: { status: 'PAID' }` **global**; UI sends `organizationId` but route **does not read body** |
| **B4′** | **Yes (mitigated on replay)** | `commission-posting.ts` — items created only when `createdObligation`; R5 reconcile runs on `confirmPayment` idempotent returns, not same-request partial failure |
| **W-A1** | **Yes** | Parallel models: `deal_network_pilot_obligations` / pilot snapshot UI vs `commission_obligations` / `commission_obligation_items` (Prisma) |
| **R8** | **Yes** | Pilot `RecentDeal.paymentStatus: 'Paid'` in `deal_payload` / demo refresh without requiring `payment_events` anchor |
| **R10** | **Yes** | Supabase referral reads (`consultant-data.ts` `.eq('conversion_type', 'payment_completed')`) parallel to Prisma commission pipeline |
| **R11** | **Yes** | `repair-utilities.ts` — `STATUS_MISMATCH` auto-repair promotes `PAID` via `transitionPaymentLinkState` only (no `confirmPayment`) |
| **R6** | **Yes (low traffic)** | Legacy `confirmHederaPayment` in `lib/hedera/payment-confirmation.ts` (alternate writer; checker path uses `confirmPayment`) |
| **R3** | **No (forward-looking)** | Review routes call `executeAssistedReviewSettlement`; tests in `assisted-review-settlement.test.ts` |
| **B1** | **No** | `src/app/api/xero/debug/route.ts` not present |
| **B4 (as May blocker)** | **Downgraded** | R5 mitigates idempotent replay; first-run gap = **B4′** |

### Additional open item (not in original list but launch-relevant)

| ID | Still exists? | Notes |
|----|---------------|-------|
| **Historical PAID without `PAYMENT_CONFIRMED`** | **Yes** | Pre-R1 manual, pre-R2 status API, **pre-R3 bank/crypto mark_valid**; `confirmPayment` can backfill when already `PAID` but **no migration executed** (`docs/r3-historical-impact.md`) |

---

## Updated top 10 risks

Ranked by **residual launch impact × likelihood** given current code (not original audit IDs only).

| Rank | Risk | Severity | Why it still matters |
|------|------|----------|----------------------|
| **1** | **B2 — Build ships with 698+ suppressed TS errors** | Critical | Payment/ledger/refund paths can compile with unsafe casts; no compile-time gate on full repo |
| **2** | **B3 — Background jobs not scheduled** | High | `xero_syncs` PENDING rows, integrity checks, stuck-payment recovery, reconciliation — no guaranteed drain in `render.yaml` |
| **3** | **R4 — Hedera manual verify split-brain** | Critical | Operators using mirror verify get ledger + event but **miss** canonical commission posting + funding orchestration vs automatic checker |
| **4** | **Backfill — Global Xero queue backfill** | Critical (tenant) | Any authenticated user can queue sync work across **all tenants’** PAID links |
| **5** | **B5 — Production env misconfiguration** | Critical | Webhook bypass (`STRIPE_WEBHOOK_SECRET=disabled`), missing `CRON_SECRET`, placeholder secrets — not provable from repo |
| **6** | **B6 — Beta lockdown vs marketed payouts** | High (product) | Default lockdown blocks mass partner payout APIs; mis-marketing = trust incident |
| **7** | **Historical settlement gaps** | Medium–High | PAID invoices without `PAYMENT_CONFIRMED` / commission / Xero — breaks books and attribution until repair |
| **8** | **W-A1 — Dual obligation / deal truth models** | High | Pilot UI obligations vs Prisma commission tables; operators can see inconsistent “paid” / earnings |
| **9** | **B4′ — Commission items on first obligation create only** | Medium | Same-request failure leaves gaps until webhook replay or manual reconcile |
| **10** | **R11 — Repair utility promotes PAID without settlement** | Medium | Automated repair can widen status/ledger drift if run without ops discipline |

**Dropped from top 10 (resolved for new operations):** operator manual PAID bypass (R1), status API PAID (R2), bank/crypto mark_valid bypass (R3), xero/debug leak (B1).

---

## Updated launch blockers

Only issues that **still block** unrestricted or mis-scoped launch.

| Rank | ID | Blocker | Tier |
|------|-----|---------|------|
| **1** | **B2** | TypeScript debt + `ignoreBuildErrors: true` | P0 engineering |
| **2** | **B3** | Jobs/worker/cron not enabled in infrastructure blueprint | P0 ops |
| **3** | **B5** | Production env hardening not evidenced in codebase | P0 ops |
| **4** | **B6** | Beta lockdown vs GA payout/marketing claims | P0 product |
| **5** | **R4** | Hedera `transactions/verify` bypasses `confirmPayment` | P0 if Hedera manual verify is in GA scope |
| **6** | **Backfill** | Global Xero backfill (`/api/xero/queue/backfill`) | P0 if Xero UI exposed to tenants |
| **7** | **B4′** | First-run commission item skip | P1 (P0 if high-volume referral launch) |
| **8** | **W-A1** | Dual obligation stores | P1 architectural |
| **9** | **Historical** | PAID without canonical settlement artifacts | P1 data |
| **10** | **R8 / R10** | Pilot paid projection + Supabase/Prisma referral duality | P1 Deal Network / referrals GA |

**No longer launch blockers (for forward-looking flows):** **B1**, **R1**, **R2**, **R3**, permanent commission gap on **idempotent replay** (R5).

---

## Recommended next remediation

Priority order for highest readiness lift per effort:

| Priority | Item | Rationale |
|----------|------|-----------|
| **P0** | **B3 / M6** — Enable Render cron or worker; hit `/api/jobs/*` and Xero `queue/process` on schedule | Unblocks accounting sync and operational hygiene |
| **P0** | **B5** — Render env checklist (webhooks, `CRON_SECRET`, no disabled secrets) | Prevents silent security degradation |
| **P0** | **R4** — Route Hedera manual verify through `confirmPayment({ provider: 'hedera' })` | Removes last major settlement fork for crypto |
| **P0** | **Backfill** — Scope `queue/backfill` by `organization_id`; honor UI body | Closes B1-class tenant issue on active endpoint |
| **P1** | **Historical repair** — Inventory + `executeAssistedReviewSettlement` / `confirmPayment` backfill per `r3-historical-impact.md` | Restores ledger/commission/Xero for legacy PAID rows |
| **P1** | **B4′ / R13** — Create obligation items when obligation exists but items empty (first pass) | Closes earnings UI ≠ ledger on first settlement |
| **P1** | **R11** — Repair `STATUS_MISMATCH` via `confirmPayment` or flag-only | Stops auto-promote without settlement |
| **P2** | **B2** — Phased `typecheck:repo` burn-down; trend CI gate | Long horizon; interim: block payment-domain regressions |
| **P2** | **B6** — Document GA matrix vs `BETA_LOCKDOWN_MODE` | Product/legal alignment |
| **P2** | **W-A1 / R8 / R10** — Single financial truth for Deal Network + referrals | Enterprise-grade consistency |

---

## Smallest safe launch slice (v2)

**In scope after R1, R2, R3, R5, B1:**

- Payment links + **Stripe** (and **Wise/Hedera transaction-checker** → `confirmPayment`)
- **Operator manual mark paid** (OPEN → `confirmPayment`)
- **Merchant bank/crypto mark valid** (`PAID_UNVERIFIED` / `REQUIRES_REVIEW` → `confirmPayment`)
- Referral attribution reporting (with **B4′** and historical repair awareness)
- Xero **connection** + org-scoped queue views; manual “process now” if ops runs jobs

**Out of scope or explicit risk acceptance until blockers above addressed:**

- **Hedera mirror manual verify** as books-ready settlement (**R4**)
- Claims of **fully automated Xero books** without **B3**
- **Mass partner payout / release** without **B6** decision
- **Enterprise** Deal Network financial truth (**W-A1**, **R8**, **R10**)
- **Global backfill** button for non-admin tenants

---

## Sign-off checklist (v2)

| Item | Status |
|------|--------|
| B1 xero/debug remediated | **Done** |
| R1 manual → confirmPayment | **Done** |
| R2 status API PAID blocked | **Done** |
| R3 bank/crypto review → confirmPayment | **Done** |
| R5 commission reconcile on replay | **Done** |
| B3 cron / jobs | **Open** |
| B5 env checklist on Render | **Open** |
| B6 beta lockdown documented | **Open** |
| B2 typecheck / strict build | **Open** |
| R4 Hedera verify convergence | **Open** |
| Backfill org scope | **Open** |
| Historical PAID backfill | **Open** |
| B4′ first-run commission items | **Open** |

---

## Launch recommendation

### **Controlled GA ready**

**Why this tier (not the others):**

| Tier | Verdict | Reason |
|------|---------|--------|
| **Not ready** | Rejected | Core payment capture and **canonical settlement** for Stripe, operator manual, and **assisted bank/crypto review** are implemented and test-contracted; security regression from B1 is fixed. |
| **Controlled GA ready** | **Selected** | Forward-looking invoice settlement converges on `confirmPayment` for all primary merchant/operator paths except Hedera manual verify. Remaining P0s (jobs, env, build safety, backfill tenancy, R4) are **operational and scope-bound**, not “every payment marks PAID without ledger.” |
| **Public launch ready** | Rejected | **B2**, **B3**, **B5**, **B6**, global **backfill**, **R4**, and **historical data** gaps remain; marketing “full payouts + automated accounting + enterprise deal truth” would over-promise. |
| **Enterprise ready** | Rejected | **W-A1**, **R8**, **R10**, incomplete auth matrix CI, dual writers (**R6**, **R11**), and build/type safety debt block enterprise certification. |

**Operator guidance:** Ship Controlled GA with a **published feature matrix** matching the smallest safe slice, scheduled dates for **B3 + B5 + backfill scoping + R4**, and a **historical repair** plan before claiming books parity for pre-June assisted approvals.

---

## References (current codebase)

| Artifact | Role |
|----------|------|
| `src/lib/services/payment-confirmation.ts` | Canonical settlement; `CONFIRM_PAYMENT_SETTLEMENT_ENTRY_STATUSES` |
| `src/lib/payments/assisted-review-settlement.server.ts` | R3 adapter |
| `src/lib/payments/manual-invoice-settlement.server.ts` | R1 adapter |
| `src/lib/payments/payment-link-status-api-policy.ts` | R2 policy |
| `src/lib/referrals/commission-reconcile.server.ts` | R5 repair |
| `src/app/api/xero/queue/backfill/route.ts` | Global backfill (open) |
| `src/app/api/hedera/transactions/verify/route.ts` | R4 divergent writer |
| `render.yaml` | B3 infrastructure gap |
| `docs/r3-historical-impact.md` | Historical repair assessment |
| [launch-readiness-reassessment.md](./launch-readiness-reassessment.md) | v1 comparison (68%) |
