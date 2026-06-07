# Launch Execution Plan — 14 Days

**Plan start:** 2026-06-04 (assumes settlement, security, and operational remediations deployed)  
**Target:** Controlled GA — 10–20 merchants, invoice collection + optional Xero + referrals  
**Sources:** [final-launch-certification.md](./final-launch-certification.md), [pre-launch-operational-checklist.md](./pre-launch-operational-checklist.md), [production-smoke-test-plan.md](./production-smoke-test-plan.md), [launch-risk-review.md](./launch-risk-review.md)

**Owners (roles):**

| Role | Abbrev |
|------|--------|
| Engineering lead | **Eng** |
| Platform / DevOps | **Ops** |
| Product / launch manager | **PM** |
| Finance / operations | **Finance** |
| Customer support lead | **Support** |

---

## Timeline overview

```text
Days 1–5   Pre-launch verification (env, crons, integrity, historical SQL)
Days 6–8   Production smoke tests (all rails in scope)
Days 9–10  Merchant onboarding prep + go/no-go
Days 11–14 Controlled GA rollout (wave 1 → wave 2) + monitoring live
```

---

## Section 1 — Pre-launch verification tasks

Ordered by dependency. Complete each tier before starting the next.

### Tier 0 — Deploy & environment (blocks everything)

| ID | Task | Owner | Effort | Launch impact | Depends on |
|----|------|-------|--------|---------------|------------|
| P0.1 | Confirm production deploy includes B1–B5, R1–R5, R4, backfill auth | Eng | 2h | **Blocker** — wrong build = wrong settlement | — |
| P0.2 | Validate B5 env: `STRIPE_WEBHOOK_SECRET`, `CRON_SECRET` (≥16 chars), live Stripe keys or explicit `ALLOW_STRIPE_TEST_KEYS` for staging | Ops | 2h | **Blocker** — app may not start or webhooks fail | P0.1 |
| P0.3 | Set `ADMIN_EMAIL_ALLOWLIST`; verify admin login + one protected route | Ops | 1h | **Blocker** — no break-glass | P0.2 |
| P0.4 | `GET /api/health` 200 on Render; optional: enable `HEALTHCHECK_DEEP=1` | Ops | 1h | High — false “healthy” during DB outage | P0.1 |

### Tier 1 — Background jobs (blocks financial smoke)

| ID | Task | Owner | Effort | Launch impact | Depends on |
|----|------|-------|--------|---------------|------------|
| P1.1 | Render: all 8 cron services **Active** (`render.yaml` targets) | Ops | 2h | **Blocker** — Xero/recon/integrity won’t run | P0.2 |
| P1.2 | Manual invoke one cron: `node scripts/render-cron-invoke.mjs xero-queue` (from deploy env) | Ops | 30m | High — validates CRON_SECRET + routing | P1.1 |
| P1.3 | Review last 24h cron logs: no sustained 401/503 | Ops | 1h | High | P1.1 |
| P1.4 | Stripe Dashboard: webhook URL + events (`payment_intent.succeeded`, `checkout.session.completed`) | Ops | 1h | **Blocker** for Stripe merchants | P0.2 |
| P1.5 | Wise webhook URL (if any merchant uses Wise) | Ops | 30m | Blocker for Wise subset | P0.1 |

### Tier 2 — Financial integrity snapshot (blocks GA if critical issues)

| ID | Task | Owner | Effort | Launch impact | Depends on |
|----|------|-------|--------|---------------|------------|
| P2.1 | Run `GET /api/internal/launch-financial-verification` (Bearer `CRON_SECRET` or admin) | Finance + Eng | 1h | **Blocker** — unknown data state | P1.1 |
| P2.2 | Export counts: `PAID_WITHOUT_PAYMENT_CONFIRMED`, `OPEN_WITH_PAYMENT_CONFIRMED`, duplicate `PAYMENT_CONFIRMED` | Finance | 2h | **Blocker** if >0 for pilot orgs without plan | P2.1 |
| P2.3 | Historical cohort SQL (Section 3): size + repair priority | Finance | 3h | High — L1 critical risk | P2.2 |
| P2.4 | Publish ops runbook: **do not** use `repair-utilities` STATUS_MISMATCH → PAID | PM | 1h | Medium — prevents R11 harm | — |

### Tier 3 — Integrations per pilot org

| ID | Task | Owner | Effort | Launch impact | Depends on |
|----|------|-------|--------|---------------|------------|
| P3.1 | Per org: Xero OAuth connected; test connection in settings | Support | 30m × N orgs | High for accounting GA | P0.1 |
| P3.2 | Per org: Hedera network (testnet/mainnet) matches `NEXT_PUBLIC_HEDERA_NETWORK` | Eng | 15m × N | Blocker for Hedera orgs | P0.1 |
| P3.3 | Per org: payment methods enabled (Stripe / Wise / bank / crypto) documented | PM | 15m × N | Medium | — |
| P3.4 | Verify org-scoped Xero backfill: member can backfill own org only; cross-org 403 | Eng | 1h | **Blocker** (security) | P0.1 |

### Tier 4 — Documentation & support readiness

| ID | Task | Owner | Effort | Launch impact | Depends on |
|----|------|-------|--------|---------------|------------|
| P4.1 | Merchant-facing feature matrix (what’s GA: invoices, not payouts) | PM | 2h | High — B6 expectations | — |
| P4.2 | Support cheat sheet: settlement truth = Transactions / `PAYMENT_CONFIRMED` (not pilot “Paid” alone) | Support | 2h | Medium — L7/L8 | — |
| P4.3 | Escalation tree (Section 5) distributed | PM | 1h | High | P4.2 |

**Go/no-go gate (end of Day 9):** Tier 0–2 complete; smoke tests signed off (Section 2); historical **must-repair** items resolved or waived in writing by Finance.

---

## Section 2 — Production smoke tests (Days 6–8)

Use dedicated **pilot test org(s)**. Record `payment_link_id` and `payment_event_id` for each test. Full expectations: [production-smoke-test-plan.md](./production-smoke-test-plan.md).

### Day 6 — Automated rails + ops

| Step | Time | Action | Owner | Pass criteria |
|------|------|--------|-------|---------------|
| 6.1 | AM | Create OPEN Stripe invoice ($10); complete test/live payment per env policy | Eng | `PAID`, one `PAYMENT_CONFIRMED`, balanced ledger, Stripe clearing entries |
| 6.2 | AM | Replay same Stripe event (Dashboard) or wait for idempotent second delivery | Eng | `alreadyProcessed`; no duplicate event/ledger |
| 6.3 | PM | Wait ≤10 min; confirm `xero_syncs` → `SUCCESS` (if Xero on) | Finance | Or org backfill queues missing row |
| 6.4 | PM | Trigger / wait for `stripe-reconciliation` cron; check logs | Ops | No erroneous double-settle |
| 6.5 | EOD | `launch-financial-verification` after tests | Finance | No new critical settlement issues |

**Wise (if in scope):** swap 6.1 for funded Wise transfer test — same assertions with `wise_transfer_id`.

### Day 7 — Hedera + manual operator

| Step | Time | Action | Owner | Pass criteria |
|------|------|--------|-------|---------------|
| 7.1 | AM | Hedera **monitor**: OPEN crypto invoice, on-chain pay with memo = link id, poll monitor API / UI | Eng | `confirmPayment` path; `hedera_transaction_id` normalized |
| 7.2 | AM | Hedera **verify** (R4): second test link or retry path with tx id | Eng | Full chain + `manuallyVerified` metadata; duplicate → `alreadyProcessed` + reconcile |
| 7.3 | PM | **R1** manual settlement: OPEN invoice → operator mark paid | Support | `manual-settlement:{id}` ref; audit log |
| 7.4 | PM | Optional: `POST /api/hedera/confirm` on third link | Eng | Same artifacts as monitor |

### Day 8 — Assisted review + security + sign-off

| Step | Time | Action | Owner | Pass criteria |
|------|------|--------|-------|---------------|
| 8.1 | AM | **Bank R3**: payer submit → `PAID_UNVERIFIED` → merchant `mark_valid` | Support | `PAID` only after mark_valid; `bank-review:{confirmationId}` |
| 8.2 | AM | **Crypto R3**: same pattern | Support | `crypto-review:{confirmationId}` |
| 8.3 | PM | **Backfill auth**: org A user cannot backfill org B | Eng | 403 cross-tenant |
| 8.4 | PM | **Commission**: link with referral program — obligation + items after Stripe test | Finance | Or document “no referral” skip |
| 8.5 | EOD | Smoke sign-off meeting | PM + Eng + Finance | All in-scope rails checked in matrix |

**Cron smoke (any day 6–8):** `GET /api/health`; optional manual `xero-queue` invoke; confirm `ledger-integrity` returns zero violations for test links.

---

## Section 3 — Historical data review

### Must repair before first production payment (pilot orgs)

| Cohort | Detection | Why before launch | Repair |
|--------|-----------|-------------------|--------|
| **PAID without `PAYMENT_CONFIRMED`** | `launch-financial-verification`, integrity checks | Invoice shows paid but no books/commission anchor | `confirmPayment` backfill or assisted settlement per link; **never** R11 STATUS_MISMATCH only |
| **OPEN with `PAYMENT_CONFIRMED`** | Integrity check | Broken state machine | Eng-led case-by-case; may need status fix + reconcile |
| **Duplicate `PAYMENT_CONFIRMED` per link** | Integrity / SQL | Double ledger risk | Eng + Finance; do not enable merchant until resolved |
| **Pilot org active invoices in non-canonical PAID** (pre-R3/R4) with real money | SQL on `payment_events` + metadata | L1 — missing commission/funding | R5 `reconcileCommissionArtifactsForPaymentEvent` per `payment_event_id` |

**SQL starting points:** `docs/r4-historical-impact-analysis.md`, `docs/r3-historical-impact.md`.

### Can repair after launch (with monitoring)

| Cohort | When acceptable | Repair window |
|--------|-----------------|---------------|
| Pre-R4 Hedera `manuallyVerified` on **inactive** / archived links | No new money | Days 11–30 batch R5 reconcile |
| Pre-R3 `mark_valid` gaps on **closed** deals | No operator action | Week 2–4 |
| Missing `xero_syncs` on old PAID links | Accounting catch-up | Org-scoped backfill in settings (post-launch) |
| B4′ missing obligation **items** (obligation exists, items empty) | Low volume | On support ticket; R5 reconcile |
| Pilot UI “Paid” without events (R8) | UI-only confusion | Training + post-launch UI refresh (no code required for GA) |

### Waiver process

Finance may **waive** a must-repair row only if: link is cancelled/test, zero amount, or duplicate org sandbox — document waiver ID in launch log.

---

## Section 4 — Monitoring (first 30 days post-launch)

### Daily checks (15 min — Ops rotation)

| Check | Source | Threshold / action |
|-------|--------|-------------------|
| Render web + cron success rate | Render dashboard | Any cron fail streak ≥2 → investigate same day |
| `GET /api/health` (deep if enabled) | Synthetic or manual | Non-200 → P1 |
| Stripe webhook delivery failures | Stripe Dashboard | >5 failures/day → P1 Eng |
| New `PAID_WITHOUT_PAYMENT_CONFIRMED` | `launch-financial-verification` or integrity | **Any new** → P1 same day |
| Xero `FAILED` with `retry_count > 3` | DB / dashboard | >3 links/org → Support notifies merchant |
| Error log: `Payment confirmation failed` | Log drain | Any prod → P1 |
| Error log: `Revenue share failed` | Log drain | >3/day → batch R5 reconcile review |

### Weekly checks (1h — Finance + Eng)

| Check | Source | Threshold / action |
|-------|--------|-------------------|
| Ledger integrity cron summary | Job JSON / logs | Any sustained violations → war room |
| System integrity endpoint | Cron `system-integrity` | New critical issues → backlog |
| Commission obligation coverage | SQL: PAID links with referral, no obligation | >5% → reconcile sprint |
| Xero sync backlog age | Oldest `PENDING` `xero_syncs` | >24h → ops tuning |
| Merchant cohort review | Support tickets tagged `payments` | Trending issues → PM |
| Cron secret / cert expiry | Calendar | 30-day warning |

### Alert thresholds (configure in monitoring channel)

| Alert | Condition | Severity |
|-------|-----------|----------|
| Settlement failure spike | >3 `confirmPayment` failures in 1h | P1 |
| Cron auth failure | 401 on job routes | P1 |
| Integrity critical | `OPEN_WITH_PAYMENT_CONFIRMED` or new `PAID_WITHOUT_PAYMENT_CONFIRMED` | P0 |
| Xero queue stalled | Pending count >50 and oldest >2h | P2 |
| Stripe stuck OPEN | Integrity stuck-open count >10 | P2 |

---

## Section 5 — Merchant onboarding plan (10–20 merchants)

### Waves

| Wave | Days | Merchants | Rails |
|------|------|-----------|-------|
| **Wave 1** | 11–12 | 3–5 friendly pilots | 1 rail each (Stripe preferred) |
| **Wave 2** | 13–14 | Remaining 7–15 | Add Wise/Hedera/bank per contract |

### Per-merchant checklist (Support + PM)

1. Org created; users invited with correct roles (`manage_settings` for finance lead).  
2. Payment methods enabled match contract (no payout promises).  
3. Xero connected (if purchased).  
4. Hedera merchant account + network confirmed (if crypto).  
5. One **live** micro-payment smoke ($1–5) with Finance witness.  
6. Merchant receives support contacts + feature matrix.

### Support processes

| Scenario | L1 (Support) | L2 (Eng on-call) |
|----------|--------------|------------------|
| “Invoice still OPEN after payer paid” | Check rail: Stripe Dashboard / Hedera mirror / bank submit status | Trace `payment_events`, webhook logs, run recon |
| “Xero not updated” | Check `xero_syncs` status; org backfill button | Queue processor logs, Xero token refresh |
| “Partner commission wrong” | Confirm `PAYMENT_CONFIRMED` exists; check obligations table | R5 reconcile; commission traces |
| “Can’t pay partners” | Explain beta lockdown (B6); admin-only | PM escalation if sold payouts |

**SLA (controlled GA):** L1 response 4 business hours; L2 payment-impacting 2 hours.

### Rollback processes

| Level | Trigger | Action |
|-------|---------|--------|
| **Merchant pause** | Repeated settlement failures for one org | Disable new invoices; manual ops only |
| **Rail pause** | Stripe webhook broken | Stop Stripe invoices; Wise/Hedera/manual only |
| **Platform rollback** | Bad deploy / widespread confirmPayment failure | Render rollback to last known good commit; freeze onboarding |
| **Data rollback** | Incorrect PAID state | **No** mass delete — Eng case-by-case with Finance |

### Escalation processes

```text
Support L1 → Eng on-call (payment/settlement)
         → Finance (ledger/Xero/commission)
         → PM (merchant comms, scope)
         → Eng lead (rollback decision)
```

**P0 criteria:** money received, invoice not PAID, or duplicate charge/settlement.  
**P1 criteria:** Xero/commission wrong for live invoice.  
**P2 criteria:** UI confusion, pilot deal display (R8).

---

## Section 6 — Launch recommendation

### Earliest safe launch date

| Milestone | Earliest date (from plan start 2026-06-04) |
|-----------|-----------------------------------------------|
| Complete Tier 0–2 verification | **Day 5** (2026-06-08) |
| Complete smoke tests (Section 2) | **Day 8** (2026-06-11) |
| **Wave 1 first merchant live payment** | **Day 11** (2026-06-14) — earliest safe |
| **Full 10–20 cohort active** | **Day 14** (2026-06-17) |

If Tier 2 shows unresolved **must-repair** rows for pilot orgs, add **2–5 days** before Wave 1.

### Blockers — must complete first

1. Production deploy with all assumed remediations live.  
2. B5 env validation (`CRON_SECRET`, Stripe webhook secret).  
3. All 8 crons active and authenticated.  
4. Stripe webhook configured and smoke-tested.  
5. `launch-financial-verification` — zero **must-repair** cohort for Wave 1 orgs (or written waiver).  
6. Smoke test sign-off for every rail each Wave 1 merchant will use.  
7. Org-scoped backfill verified (cross-tenant denied).  
8. Support runbook + escalation tree published.

### Blockers — can defer

| Item | Defer to | Notes |
|------|----------|-------|
| B2 / `ignoreBuildErrors` | Post-launch quality sprint | Mitigate with smoke tests; not a controlled-GA code blocker |
| Historical reconcile (inactive links) | Days 11–30 | Forward path is canonical |
| W-A1 / R8 operator training depth | Week 2 | Support doc sufficient for launch |
| `HEALTHCHECK_DEEP=1` | Week 1 post-launch | Recommended, not required |
| Wise rail smoke | Before first Wise merchant | Required for that merchant only |
| Public / enterprise GA | TBD | Out of 14-day scope |
| Partner payouts (B6 off) | Product roadmap | Documented limitation |
| Dedicated nightly commission repair cron | Month 2 | Use R5 on replay + manual batch |

### Final recommendation

**Proceed with controlled GA** per this plan: **Wave 1 no earlier than Day 11**, contingent on Section 1 Tier 0–2 and Section 2 sign-off. Architecture and security remediations are sufficient for 10–20 merchants; remaining risk is **operational proof** and **historical data hygiene**, not further settlement refactors.

---

## 14-day calendar (at a glance)

| Day | Date | Focus |
|-----|------|-------|
| 1 | Jun 4 | P0 deploy + env (Tier 0) |
| 2 | Jun 5 | Crons + webhooks (Tier 1) |
| 3 | Jun 6 | Financial verification + historical SQL (Tier 2) |
| 4 | Jun 7 | Per-org integrations (Tier 3) |
| 5 | Jun 8 | Support docs + go/no-go prep (Tier 4) |
| 6 | Jun 9 | Smoke: Stripe (+ Wise if needed) |
| 7 | Jun 10 | Smoke: Hedera + manual |
| 8 | Jun 11 | Smoke: bank/crypto + sign-off |
| 9 | Jun 12 | Go/no-go; fix blockers |
| 10 | Jun 13 | Onboarding Wave 1 merchants (setup only) |
| 11 | Jun 14 | **Wave 1 live payments** |
| 12 | Jun 15 | Wave 1 monitor + tune |
| 13 | Jun 16 | Wave 2 onboarding |
| 14 | Jun 17 | **Wave 2 live**; 30-day monitoring begins |

---

## References

- [pre-launch-operational-checklist.md](./pre-launch-operational-checklist.md)
- [production-smoke-test-plan.md](./production-smoke-test-plan.md)
- [launch-risk-review.md](./launch-risk-review.md)
- [final-launch-certification.md](./final-launch-certification.md)
- [backfill-security-verification.md](./backfill-security-verification.md)
- [docs/b5-deployment-checklist.md](./b5-deployment-checklist.md) (if present)
- [docs/b3-production-verification.md](./b3-production-verification.md) (if present)
