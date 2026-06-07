# Final Launch Certification — Provvypay

**Certification date:** 2026-06-04  
**Method:** Current codebase review only (no historical report scores reused).  
**Assumed implemented:** B1, B3, B5, R1, R2, R3, R4, R5.

---

## Executive verdict

Provvypay has converged **invoice payment-link settlement** on a single orchestrator (`confirmPayment()` in `src/lib/services/payment-confirmation.ts`) across all production money-in rails. Remaining gaps are **operational repair paths**, **build/type safety**, **product lockdown (B6)**, **dual financial/projection models**, and **historical data** — not new split-brain settlement writers on live APIs.

**Recommended next action:** **2 — Launch after a short checklist** (controlled GA for invoice collection; defer full public/enterprise GA until B2 + backfill hardening + historical reconcile).

---

## Dimension scores (recalculated)

Scores are 0–100 against production invoice settlement, security, and operator controls.

| Dimension | Score | Δ vs pre-R4 posture (est.) | Evidence (current code) |
|-----------|------:|----------------------------|-------------------------|
| **Overall launch readiness** | **78** | +8 | R4 closes Hedera verify bypass; R1–R3/R5/B1/B3/B5 in place |
| **Workflow integrity** | **88** | +6 | Status API blocks PAID (R2); all invoice rails → `confirmPayment` |
| **Financial controls** | **84** | +4 | Atomic txn: state + `PAYMENT_CONFIRMED` + ledger + Xero upsert; integrity job |
| **Security** | **82** | +3 | B1 debug removed; B5 prod guards; **global Xero backfill** still weak |
| **Authorization** | **80** | +2 | Org permissions on merchant APIs; admin allowlist (B5); backfill lacks org scope |
| **Operational readiness** | **80** | +5 | 8 Render cron targets + `CRON_SECRET` auth; repair/integrity scripts |
| **Observability** | **76** | +3 | Settlement/reconcile traces; `runIntegrityChecks()`; hedera verify stages (R4) |

---

## End-to-end workflow review

| Stage | Status | Primary implementation | Notes |
|-------|--------|------------------------|-------|
| **Agreement** | Operational | Onboarding / deal-network / pilot deals | Not gated by this certification |
| **Obligation** | Split truth | `commission_obligations` (financial) vs `deal_network_pilot_obligations` (projection) | **W-A1** — dual model persists |
| **Allocation** | Operational | `allocation-engine`, referral splits at checkout | Supabase + Prisma paths |
| **Payment** | Strong | Stripe / Wise / Hedera / manual bank / crypto submission | Submissions → `PAID_UNVERIFIED` / `REQUIRES_REVIEW`, not PAID |
| **Settlement** | **Strong** | `confirmPayment()` only on production invoice rails | See verification section |
| **Commission** | Strong with caveats | `applyRevenueShareSplits` + R5 `reconcileCommissionArtifactsForPaymentEvent` | **B4′** first-run item gap; replay healed by R5 |
| **Funding** | Strong on canonical path | `orchestrateFundingAfterInvoiceSettlement` post-settlement | Skipped on non-canonical historical rows until reconcile |
| **Payout** | Gated | Payout APIs behind `BETA_LOCKDOWN_MODE` (default on) | **B6** — not GA for mass partner payouts |
| **Accounting sync** | Strong on canonical path | `xero_syncs` upsert in `confirmPayment` txn; B3 `xero-queue` cron | Global backfill endpoint is separate risk |

---

## Settlement verification: `confirmPayment()` as single authority

### Production invoice rails (all converge on `confirmPayment`)

| Rail | Entry | Settlement call |
|------|-------|-----------------|
| **Stripe** | `src/app/api/stripe/webhook/route.ts` — `payment_intent.succeeded`, `checkout.session.completed` | `confirmPayment({ provider: 'stripe' })` |
| **Stripe recovery** | `src/lib/jobs/stripe-reconciliation.ts` | `confirmPayment` |
| **Wise** | `src/app/api/webhooks/wise/route.ts` | `confirmPayment({ provider: 'wise' })` |
| **Hedera (client confirm)** | `src/app/api/hedera/confirm/route.ts` | `confirmPayment({ provider: 'hedera' })` |
| **Hedera (monitor)** | `src/lib/hedera/transaction-checker.ts` | `confirmPayment({ provider: 'hedera' })` |
| **Hedera (manual verify)** | `src/app/api/hedera/transactions/verify/route.ts` → `executeHederaMirrorSettlement()` | `confirmPayment({ provider: 'hedera' })` (**R4**) |
| **Operator manual (R1)** | `src/lib/payments/manual-invoice-settlement.server.ts` | `confirmPayment({ provider: 'manual' })` |
| **Bank/crypto review (R3)** | `src/lib/payments/assisted-review-settlement.server.ts` | `confirmPayment({ provider: 'manual' })` |

### `PAID` / `PAYMENT_CONFIRMED` without `confirmPayment()` — production-relevant

**No production HTTP invoice-settlement route** today creates `PAYMENT_CONFIRMED` or settles an invoice to `PAID` outside `confirmPayment()`.

Remaining **non-canonical** paths (not invoice GA rails):

| Path | File | Reaches | Risk |
|------|------|---------|------|
| **R11 — Repair utilities** | `src/lib/data/repair-utilities.ts` — `STATUS_MISMATCH` | `PAID` via `transitionPaymentLinkState` only; **no** `PAYMENT_CONFIRMED`, ledger, commission, funding | Ops script; can worsen `PAID_WITHOUT_PAYMENT_CONFIRMED` |
| **R6 — Legacy Hedera** | `src/lib/hedera/payment-confirmation.ts` — `confirmHederaPayment` / `batchConfirmHederaPayments` | Inline `PAID` + `PAYMENT_CONFIRMED` + post-txn ledger | **No API route** calls it; latent if scripts invoke |
| **R6 — Ledger retry** | `retryLedgerPosting` in same file | Ledger only | Used from `repair-utilities` for orphans |
| **Seed / test** | `src/lib/db/seed.ts`, `src/app/api/test/refund-atomicity/route.ts` | Fixture / test | Non-production |
| **Payout entities** | `src/app/api/payouts/[id]/mark-paid/route.ts`, payout-batch Hedera confirm | Payout `PAID` | Out of invoice settlement scope |

**Explicit statement:** For **live invoice payment collection** (Stripe, Wise, Hedera, operator manual, assisted review), **`PAID` and `PAYMENT_CONFIRMED` are only created through `confirmPayment()`** in the current codebase.

**Caveat:** Pre-R4 historical rows and **R11 repair** may exist in the database with inconsistent artifacts; that is a **data** problem, not an active API bypass after R4.

---

## Remediation certification (assumed complete)

| Item | Status in codebase |
|------|-------------------|
| **B1** — Remove cross-tenant Xero debug | **Verified** — `app/api/xero/debug/route.ts` absent; tests in `xero-debug-removed.test.ts` |
| **B3** — Scheduled jobs | **Verified** — `render.yaml` lists 8 `render-cron-invoke.mjs` targets; `cron-request-auth.ts`; prod requires `CRON_SECRET` (B5) |
| **B5** — Production env hardening | **Verified** — `production-env-guards.ts`, `admin.emailAllowlist`, Stripe live-key guard |
| **R1** — Manual settlement | **Verified** — `manual-invoice-settlement.server.ts` → `confirmPayment` |
| **R2** — Status API cannot set PAID | **Verified** — `payment-link-status-api-policy.ts` + 409 on PAID |
| **R3** — Assisted review | **Verified** — `assisted-review-settlement.server.ts` → `confirmPayment` |
| **R4** — Hedera verify bypass | **Verified** — `hedera-mirror-settlement.server.ts`; verify route has no inline ledger/event |
| **R5** — Commission reconcile on replay | **Verified** — `runCommissionReconcileAfterSettlement` on idempotent returns in `payment-confirmation.ts` |

---

## Re-evaluation of remaining historical findings

| Finding | Classification | Current state |
|---------|----------------|---------------|
| **B2** — TypeScript / `ignoreBuildErrors` | **NOT RESOLVED** | `src/next.config.ts` still `ignoreBuildErrors: true`; `build-integrity-audit.md` documents **698** repo errors |
| **Backfill endpoint** — `POST/GET /api/xero/queue/backfill` | **NOT RESOLVED** | Any authenticated user can scan **all** `PAID` links globally; no `organization_id` filter |
| **B6** — Beta lockdown vs payouts GA | **NOT RESOLVED** (by design) | `BETA_LOCKDOWN_MODE` default `true`; payout/commission routes admin-gated |
| **B4′** — Commission items only when `createdObligation` | **PARTIALLY RESOLVED** | R5 heals on **replay**; same-request partial failure still possible until reconcile |
| **W-A1** — Dual obligation / earnings vs pilot projection | **NOT RESOLVED** | `deal_network_pilot_obligations` vs `commission_obligations` both active |
| **R8** — Pilot UI “Paid” without `payment_events` | **NOT RESOLVED** | Demo/pilot snapshot paths (`pilot-snapshot.server.ts`, `RecentDeal`) not tied to settlement truth |
| **R10** — Parallel Supabase referral stack | **PARTIALLY RESOLVED** | Prisma path via `createReferralConversionFromPaymentConfirmed` in `confirmPayment`; `/api/referrals/payment-completed` exists but **not referenced** elsewhere in `src/` (dormant dual stack) |
| **R11** — Repair utilities promote PAID without confirm | **NOT RESOLVED** | `repair-utilities.ts` still transitions to `PAID` without `confirmPayment` |
| **R6** — Legacy `confirmHederaPayment` | **PARTIALLY RESOLVED** | Production APIs use `confirmPayment`; legacy module remains callable from batch/repair |
| **Historical PAID-without-event rows** | **NOT RESOLVED** (data) | `integrity-checks.ts` detects `PAID_WITHOUT_PAYMENT_CONFIRMED`; no automated canonical backfill in app |

---

## Launch Readiness Score

**78 / 100** — Suitable for **controlled GA** (invoice payments, known merchants, ops runbooks). Not yet **unrestricted public** or **enterprise** without closing B2, backfill scope, and historical reconcile.

---

## Remaining Launch Blockers

| Priority | Blocker | Why it still matters |
|----------|---------|----------------------|
| **P0** | **B2 — Build ships with suppressed TS errors** | No compile-time guarantee on payment/ledger/refund paths |
| **P1** | **Global Xero backfill** | Cross-tenant queue mutation for any logged-in user |
| **P1** | **Historical settlement gaps** | Pre-R4 Hedera verify + R11 repair rows may lack commission/funding |
| **P2** | **B6 — Product / payout GA** | Default lockdown blocks partner payout APIs |
| **P2** | **W-A1 / R8 — Operator truth** | Pilot UI vs Prisma commission can disagree |
| **P3** | **R11 / R6 — Latent writers** | Ops/scripts can bypass canonical settlement |

---

## Controlled GA Recommendation

**Approve** for:

- Stripe, Wise, Hedera (monitor + confirm + verify), operator manual settlement, assisted bank/crypto review  
- Organizations with B5 production env validated (`CRON_SECRET`, live Stripe keys, admin allowlist)  
- B3 crons enabled on Render  

**Conditions:**

1. Run `runIntegrityChecks()` / `ledger-integrity` cron and remediate `PAID_WITHOUT_PAYMENT_CONFIRMED` via R5 reconcile (not R11 status promotion).  
2. Do not use `repair-utilities` `STATUS_MISMATCH` repair without a `confirmPayment` backfill plan.  
3. Restrict or org-scope Xero backfill before broader merchant access.  
4. Keep `BETA_LOCKDOWN_MODE` on unless payout GA is explicitly marketed.

---

## Public Launch Recommendation

**Defer** until:

- B2: `ignoreBuildErrors: false` or CI gate on `typecheck:repo` with acceptable error budget  
- Xero backfill org-scoped + permission-gated  
- Documented historical reconcile completed for production cohort  
- B6 decision: lockdown off only with payout SLOs and support runbooks  

---

## Enterprise Readiness Recommendation

**Not yet** — needs:

- Single financial truth narrative (W-A1) and pilot UI aligned to `PAYMENT_CONFIRMED` (R8)  
- Build integrity and audit evidence (B2)  
- Formal SOC-style controls on ops scripts (R11/R6)  
- Enterprise SSO / audit exports beyond current scope (not assessed here)

---

## Top 5 Remaining Risks

1. **Type safety debt (B2)** — Regressions in settlement/refund code may reach production undetected.  
2. **Global Xero backfill** — Authenticated user can enqueue syncs for other tenants’ paid invoices.  
3. **Historical Hedera verify cohort** — PAID links missing commission obligations / funding until R5 batch reconcile.  
4. **Dual obligation / referral models (W-A1, R10)** — Operator and partner-facing numbers can disagree.  
5. **Ops repair promoting PAID without settlement (R11)** — Widens `PAID_WITHOUT_PAYMENT_CONFIRMED` if used casually.

---

## Recommended Next Action

### **2 — Launch after a short checklist**

**Why not “Launch now”:** B2 and global backfill are avoidable production incidents; historical rows need a one-time reconcile playbook.

**Why not “Continue remediation” only:** Invoice settlement architecture is now unified (R4 completes the rail picture); further work is hardening, data repair, and product gates—not another settlement fork.

### Short checklist (pre–controlled GA)

| # | Action |
|---|--------|
| 1 | Production deploy with B5 guards + B3 crons verified (`docs/b5-deployment-checklist.md`, `docs/b3-production-verification.md`) |
| 2 | SQL inventory: `PAID_WITHOUT_PAYMENT_CONFIRMED`, `manuallyVerified` Hedera events (`docs/r4-historical-impact-analysis.md`) |
| 3 | Run R5 reconcile on identified `payment_event_id`s (dry-run first) |
| 4 | Disable or org-scope `POST /api/xero/queue/backfill` for non-admin |
| 5 | Ban R11 `STATUS_MISMATCH` → PAID repair without `confirmPayment` in ops runbook |
| 6 | Track B2 error burn-down; do not enable `ignoreBuildErrors: false` until trend is green |

---

## Comparison to prior reassessment (reference only)

| Metric | `launch-readiness-reassessment-v2.md` (pre-R4) | This certification |
|--------|--------------------------------------------------|---------------------|
| Overall | ~70% | **78%** |
| Workflow integrity | ~82% | **88%** |
| Hedera split-brain | Open (R4) | **Closed** on verify path |
| Settlement bypasses (invoice APIs) | R4 + R11 | **R4 closed**; R11 remains |

---

## References (current code)

| Topic | Path |
|-------|------|
| Settlement orchestrator | `src/lib/services/payment-confirmation.ts` |
| R4 adapter | `src/lib/hedera/hedera-mirror-settlement.server.ts` |
| R2 policy | `src/lib/payments/payment-link-status-api-policy.ts` |
| Integrity detection | `src/lib/payments/integrity-checks.ts` |
| R5 reconcile | `src/lib/referrals/commission-reconcile.server.ts` |
| R4 forward compat | `docs/r4-forward-compatibility.md` |
| B5 guards | `src/lib/config/production-env-guards.ts` |
| B3 crons | `render.yaml`, `src/scripts/render-cron-invoke.mjs` |
