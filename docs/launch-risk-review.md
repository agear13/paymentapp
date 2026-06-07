# Launch Risk Review — First 10–20 Merchants

**Date:** 2026-06-04  
**Scope:** Controlled GA (invoice collection + accounting sync + basic referrals).  
**Excluded:** Enterprise scale, multi-region, high-volume payout programs.

Assumes: B1, B3, B5, R1–R5, R4, backfill authorization implemented.

---

## Risk register

| ID | Risk | Rank | Likelihood (10–20 merchants) | Impact | Mitigation (ops, not code) |
|----|------|------|------------------------------|--------|----------------------------|
| L1 | **Historical rows missing commission/funding** (pre-R4 Hedera verify, pre-R3 review) | **Critical** | Medium if legacy data exists | Wrong partner earnings / pilot funding | Pre-launch SQL cohort + R5 `reconcileCommissionArtifactsForPaymentEvent` |
| L2 | **First payment commission items skipped** (B4′ same-request) then no replay | **High** | Low–Medium | Missing obligation items until manual reconcile | Retry webhook or run reconcile; monitor logs |
| L3 | **Xero sync lag or failure** | **High** | Medium | Books out of date | 5m cron + org backfill button; watch `FAILED` retries |
| L4 | **Stripe webhook misconfiguration** | **Critical** | Low if B5 validated | No settlement | Webhook secret test; reconciliation cron backup |
| L5 | **Hedera mirror indexing delay** | **Medium** | Medium on Hedera cohort | Payer sees unpaid until verify/monitor | UI verify path (R4 canonical); set expectations |
| L6 | **Operator marks PAID without understanding assisted flow** | **Medium** | Medium for manual bank | Skips payer confirmation story | Training: submit → review → mark_valid |
| L7 | **Pilot UI “Paid” vs ledger truth** (R8) | **Medium** | Medium if pilot deals used | Operator confusion | Use transactions page + `PAYMENT_CONFIRMED` as truth |
| L8 | **Dual earnings views** (W-A1 pilot vs commission tables) | **Medium** | Medium with referrals | Support tickets | Single “financial truth” doc for support |
| L9 | **Build/type safety (B2)** — runtime-only defects | **High** | Low–Medium | Wrong amount edge case | Staged smoke tests; fast rollback on Render |
| L10 | **Accidental global repair** (R11 repair-utilities) | **Low** | Low (if unused) | PAID without event | Ban in ops runbook |
| L11 | **Beta lockdown surprises** (B6) | **Low** | Low unless payouts marketed | “Can’t pay partners” | Document payouts admin-only |
| L12 | **Cron secret rotation** | **Medium** | Low once | Jobs stop | Rotate secret in Render group + crons together |

**Resolved for forward path (do not re-rank as active code risks):**

- Cross-tenant Xero debug (B1)
- Global Xero backfill (authorization fix)
- Hedera verify split-brain (R4)
- Status API PAID bypass (R2)
- Bank/crypto mark_valid bypass (R3)

---

## Severity summary

| Rank | Count | Top items |
|------|-------|-----------|
| **Critical** | 2 | L1 historical data, L4 Stripe webhook |
| **High** | 3 | L2 B4′, L3 Xero, L9 B2 |
| **Medium** | 6 | L5–L8, L12 |
| **Low** | 2 | L10, L11 |

---

## Architecture validation conclusion

| Question | Answer |
|----------|--------|
| Do all GA payment rails use `confirmPayment`? | **Yes** (code-validated) |
| Can merchants cross-tenant backfill? | **No** (post-fix) |
| Are crons defined and securable? | **Yes** (blueprint + CRON_SECRET) |
| Is automated commission repair scheduled? | **No** — replay-triggered only |
| Ready for 10–20 merchants without code changes? | **Yes, after checklist + smoke tests** |

---

## Launch decision

### **2 — Launch after checklist completion**

**Why not “Launch now”**

- Production smoke tests per rail are not evidenced by this review (validation is architectural).
- Historical integrity (L1) unknown until `launch-financial-verification` run against real DB.
- Stripe webhook + cron health must be confirmed once in target environment.

**Why not “Continue remediation”**

- Invoice settlement architecture is unified; remaining items are **data repair**, **B2 quality**, and **operational verification** — not another settlement fork.
- Blocking code remediations for controlled GA are addressed (B1, R1–R4, R3, R5 replay, backfill auth).

**Controlled GA definition (10–20 merchants)**

- Stripe and/or Wise and/or Hedera per merchant capability
- Manual bank/crypto with trained operators
- Xero optional per org
- Payouts not marketed (B6)
- Support runbook for L1/L3/L7

**Complete before first merchant payment in prod:**

1. [pre-launch-operational-checklist.md](./pre-launch-operational-checklist.md) — Required section  
2. [production-smoke-test-plan.md](./production-smoke-test-plan.md) — Rails in scope  
3. `launch-financial-verification` — zero unresolved critical settlement issues for pilot orgs  

---

## References

- [final-launch-certification.md](./final-launch-certification.md)
- [backfill-security-verification.md](./backfill-security-verification.md)
- [r4-forward-compatibility.md](./r4-forward-compatibility.md)
- `src/lib/services/payment-confirmation.ts`
- `render.yaml`
