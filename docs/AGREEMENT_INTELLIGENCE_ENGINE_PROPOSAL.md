# Agreement Intelligence Engine — Product & Engineering Proposal

**Phase 7 — Planning document only (not implemented)**  
**Date:** June 2026  
**Context:** Phase 6 delivered the Agreement Intelligence Briefing on `/dashboard/projects/[id]`. The briefing composes existing data into an executive layout. This proposal defines how Provvypay evolves from **displaying agreement information** to **generating operational intelligence**.

**Goal:** Make Agreement Intelligence genuinely intelligent — not a reporting interface with purple styling.

---

## Executive Summary

Provvypay already contains a substantial **operational truth layer**: coordination graphs, release blockers, funding stages, KPI engines, explainability bundles, and audit timelines. Phase 6 surfaces a subset of this on the agreement page. Phase 7 should **centralize intelligence derivation** behind a single engine that:

1. Consumes canonical operational selectors (no parallel logic).
2. Produces **signals → insights → recommendations** with explicit provenance.
3. Powers the Agreement Briefing, dashboard widgets, and future automation from one source.

The intelligence ladder:

```
Raw state (participants, obligations, treasury, audit)
    ↓
Signals (KPIs, blockers, stages, confidence)
    ↓
Insights (health, risk, dependency, compliance gaps)
    ↓
Recommendations (next action, nudge, escalation)
    ↓
Automation (future: scheduled nudges, repair, reconciliation)
```

**North star:** An operator opens an agreement and within 10 seconds knows who is involved, what was agreed, what happens next, whether settlement can occur, and **why** — with one primary recommended action.

---

## Current State (Post–Phase 6)

The Agreement Intelligence Briefing (`composeAgreementBriefingSnapshot`) already:

- Infers agreement type from commercial roles and deal metadata.
- Maps participants to settlement status via the coordination graph.
- Groups obligations into Pending / In Progress / Completed / Blocked.
- Synthesizes approval placeholders from participant approval + confirmation flags.
- Computes a settlement readiness score from release confidence + payout-ready ratio.
- Lists ready / blocking / missing requirements from checklist rules.
- Renders audit timeline via `OperationalAuditTimeline`.

**What it does not yet do:**

- Expose `deriveOperationalNextActions` or categorized release blockers with CTAs.
- Show funding coordination **stage** (connected → reserved → settled → release-funded).
- Surface release confidence explainability bullets in the hero.
- Compare commercial terms to configured compensation (compliance).
- Track intelligence **trends** over time (only a static trend label).
- Reuse onboarding extraction insights (`AgreementIntelligenceInsight`) after activation.
- Rank recommendations by urgency or participant impact.

The briefing is a **composition layer**. The engine proposal makes composition **downstream** of intelligence derivation.

---

## 1. Intelligence Signals That Already Exist

These signals are computed today in `src/lib/operations/` and related modules. They should be treated as **engine inputs**, not reimplemented in UI.

### Agreement & lifecycle

| Signal | Source | Granularity |
|---|---|---|
| Project / agreement phase | `safeProjectState`, `PROJECT_PHASE_OPERATOR` | Agreement |
| Canonical agreement lifecycle | `deriveCanonicalAgreementState` (DRAFT → READY_FOR_PAYOUT) | Participant |
| Agreement approval state | `deriveAgreementApprovalState` | Participant |
| Agreement type inference | Briefing model + onboarding `inferAgreementType` | Agreement |
| Creation source | Conversation import, template, manual (`deal.createdVia`, `importedConversation`) | Agreement |
| Needs attention flag | `ProjectWorkspaceSummary.needsAttention` | Agreement |

### Participants & coordination

| Signal | Source | Granularity |
|---|---|---|
| Participant count / ready / pending | `ProjectWorkspaceSummary`, graph summary | Agreement |
| Earnings configured | `OperationalKPIs.earningsConfiguredCount` | Agreement |
| Payout-ready count | `OperationalKPIs.payoutReadyCount` | Agreement |
| Approved agreement count | `OperationalKPIs.approvedAgreementCount` | Agreement |
| Attribution active count | `OperationalKPIs.attributionActiveCount` | Agreement |
| Missing confirmation | `deriveParticipantViewStats.missingConfirmation` | Agreement |
| Pending agreements | `deriveParticipantViewStats.pendingAgreements` | Agreement |
| Per-participant release readiness | `derivePayoutReleaseReadiness` → `releaseReady`, blockers | Participant |
| Compensation classification | `classifyParticipantCompensation` | Participant |
| Attribution link eligibility | `canGenerateAttributionLink` | Participant |

### Obligations

| Signal | Source | Granularity |
|---|---|---|
| Obligation count | KPIs + pilot obligation API rows | Agreement |
| Obligation readiness | `deriveObligationState` (`awaiting_funding`, `ready`, `blocked`, etc.) | Obligation |
| Amount funded vs owed | Obligation rows + treasury totals | Obligation / Agreement |
| Release-ready obligations | `operational.releaseReady` on hydrated obligations | Obligation |
| Obligation approval state | `deriveObligationApprovalState` | Participant × obligation |

### Funding & treasury

| Signal | Source | Granularity |
|---|---|---|
| Treasury health | `ProjectTreasurySummary.projectHealth` (`settlement_risk`, `ready_for_payout`, etc.) | Agreement |
| Confirmed / pending / forecast funding | Treasury summary fields | Agreement |
| Obligations total / ready / awaiting | Treasury summary | Agreement |
| Funding coordination stage | `deriveFundingCoordinationStage` (connected → release-funded) | Agreement |
| Funding label / subcopy | `ProjectWorkspaceSummary`, treasury | Agreement |
| Legacy payment link / paid marker | `deal.paymentLink`, `deal.paymentStatus` | Agreement |

### Settlement & release

| Signal | Source | Granularity |
|---|---|---|
| Release confidence level & score | `deriveReleaseConfidence`, graph adapter | Workspace / Agreement |
| Release confidence explainability | Headline + bullets on snapshot | Workspace / Agreement |
| Release blockers (categorized) | `deriveOperationalReleaseBlockers` (8 categories) | Participant / Agreement |
| Operational blockers (legacy detail) | `deriveOperationalBlocker` | Participant |
| Release interaction gate | `deriveReleaseInteractionState` | Workspace |
| Release eligible count | KPIs + graph `releaseReadyCount` | Agreement |
| Currency consistency warnings | `deriveCurrencyConsistencyWarnings` | Agreement |

### Guidance & actions

| Signal | Source | Granularity |
|---|---|---|
| Next operational actions | `deriveOperationalNextActions` | Workspace / Agreement |
| Blocking actions narrative | `deriveOperationalBlockingActions` | Agreement |
| Workspace activation checklist | `deriveWorkspaceActivationFromOperations` | Workspace |
| Activation blockers / warnings | Activation bridge | Workspace |
| Trust signals | `deriveTrustSignals` | Workspace |

### Activity & audit

| Signal | Source | Granularity |
|---|---|---|
| Operational audit entries | `useOperationalAuditStore`, conversation import audit | Agreement |
| Merged audit timeline | `mergeAuditTimeline` | Agreement |
| Timeline projection | Graph adapter `TimelineEvent[]` | Agreement |

### Onboarding & extraction (pre-activation)

| Signal | Source | Granularity |
|---|---|---|
| Extraction confidence | `ExtractionResult.overallConfidence` | Agreement (onboarding) |
| Extracted parties / terms / payment terms | AI extractor pipeline | Agreement |
| Inferred obligations & gaps | `buildInsightsFromExtraction`, `derivePotentialGaps` | Agreement (onboarding) |
| Readiness score (onboarding) | `computeReadinessScore` in `agreement-intelligence-insights.ts` | Agreement (onboarding) |

### Settlement operations (backend)

| Signal | Source | Granularity |
|---|---|---|
| Commission reconcile / repair status | `commission-reconcile.server.ts`, repair trace | Payment event |
| Assisted review settlement | Assisted review settlement server | Payment link |
| Hedera mirror settlement trace | Hedera mirror settlement server | On-chain |
| Historical payment repair | Historical payment repair core | Workspace |

These backend signals are not yet wired to agreement briefing but represent **high-value intelligence sources** for settlement risk and compliance.

---

## 2. Intelligence Signals Derivable From Existing Data

No new schema is required for the first two roadmap phases. The following can be computed by **composing** existing selectors.

### Agreement health composites

| Derived signal | Inputs | Output |
|---|---|---|
| Agreement health score | Release confidence score, blocker count, treasury health, KPI ratios | 0–100 + label (Healthy / In coordination / Needs attention / At risk) |
| Health trend | Audit timestamps + stored readiness snapshots (see Next) | improving / stable / declining |
| Configuration completeness | Participants identified, earnings configured, terms captured, funding linked, obligations exist | Percent complete + missing step |
| Staleness | Last audit event timestamp, last treasury update | Days idle + "no progress" flag |

### Obligation risk

| Derived signal | Inputs | Output |
|---|---|---|
| Outstanding obligation exposure | Sum of unfunded obligation amounts | Currency amount |
| Blocked obligation count | Grouped obligations + approval state | Count + participant names |
| Funding coverage ratio | `confirmedFunding / obligationsTotal` | % covered |
| Forecast reliance ratio | `forecastFunding / totalExpectedInflows` | Risk flag if forecast-heavy |
| Obligation dependency chain | Participant approval → obligation approval → funding | Ordered unblock sequence |

### Settlement readiness (enhanced)

| Derived signal | Inputs | Output |
|---|---|---|
| Participant readiness matrix | Graph participants × release readiness | Who is ready / blocked / waiting |
| Release readiness gap | `releaseReadyCount` vs `participantCount` | "2 of 4 ready" |
| Funding stage position | `deriveFundingCoordinationStage` | Funnel step + blocker label |
| Held-back revenue | Release confidence `heldBack`, `heldBackReasons` | Amount + reasons |
| Settlement risk level | Treasury `settlement_risk` + BLOCKED confidence + blocked obligations | Low / Medium / High |

### Approval dependencies

| Derived signal | Inputs | Output |
|---|---|---|
| Approval dependency graph | Canonical lifecycle per participant | Share → View → Approve → Confirm chain |
| Critical path participant | First participant blocking release for most obligations | Named participant + action |
| Approval aging | `agreementSharedAt`, `inviteSentAt` vs now | Days waiting |
| Unlock preview | Release blocker `unlockCondition` fields | "Unlocks when …" per blocker |

### Funding progress

| Derived signal | Inputs | Output |
|---|---|---|
| Funding funnel | Treasury amounts by status | Connected → Pending → Confirmed → Allocated |
| Revenue vs obligation delta | `confirmedFunding - obligationsTotal` | Surplus / shortfall |
| Pending settlement exposure | `pendingFunding` + expected dates | Amount + date |
| Infrastructure gap | Workspace stripe/wise/hedera flags + `hasFundingSources` | Collection vs settlement rail status |

### Participant coordination

| Derived signal | Inputs | Output |
|---|---|---|
| Participant action queue | Per-participant blockers + lifecycle state | Prioritized list of who needs what |
| Coordination bottleneck | Participant with most blockers or holding most obligation value | Single bottleneck entity |
| Invite / nudge eligibility | Lifecycle DRAFT vs SHARED, email present | Resend invite / request approval |
| Confirmation backlog | `missingConfirmation` by participant name | Named list |

### Commercial compliance

| Derived signal | Inputs | Output |
|---|---|---|
| Terms vs configuration drift | Commercial roles from deal vs `compensationProfile` / `classifyParticipantCompensation` | Mismatch warnings |
| Unconfigured role | Commercial role without matching participant earnings | Role title + gap |
| Attribution scope gap | Compensation requires attribution but no catalog scope | Warning |
| Currency mismatch | `deriveCurrencyConsistencyWarnings` | Blocking vs warning |
| Extraction vs live drift | Onboarding insight terms vs current commercial roles (when import metadata exists) | "Terms changed since import" |

---

## 3. Insights That Should Appear on Agreement Briefing Pages

Organized by briefing section. **Bold** = not fully surfaced today.

### Summary (hero)

| Insight | Priority | Classification |
|---|---|---|
| Agreement name, type, phase, created date | Shipped (Phase 6) | — |
| Settlement readiness score ring | Shipped | — |
| **Primary recommended action** (from `deriveOperationalNextActions[0]`) | P0 | **Now** |
| **Release confidence headline + top 2 bullets** | P0 | **Now** |
| Participant / obligation counts | Shipped | — |
| **Agreement health label with explanation** (not just Healthy / Needs attention) | P1 | **Next** |
| **Configuration completeness bar** (% steps done) | P1 | **Next** |

### Participants

| Insight | Priority | Classification |
|---|---|---|
| Participant cards with role, approval, settlement status | Shipped | — |
| **Per-participant primary blocker** (one line + CTA) | P0 | **Now** |
| **Canonical lifecycle step** (Shared / Viewed / Approved / Confirmed) | P1 | **Now** |
| **Approval aging** ("waiting 5 days") | P2 | **Next** |
| Relationship visualization (primary vs partner) | Shipped (badge) | — |

### Commercial terms

| Insight | Priority | Classification |
|---|---|---|
| Structured term summary from roles + deal fields | Shipped | — |
| **Compliance status**: terms captured vs earnings configured | P1 | **Next** |
| **Drift warning** (imported terms vs current configuration) | P2 | **Next** |
| **Missing term categories** (e.g. settlement schedule undefined) | P2 | **Next** |

### Obligations

| Insight | Priority | Classification |
|---|---|---|
| Grouped obligation lists | Shipped | — |
| **Funding coverage per obligation** (funded % or amount) | P1 | **Now** |
| **Dependency hint** ("blocked until participant approval") | P1 | **Now** |
| **Outstanding exposure total** | P1 | **Next** |
| Due date / aging (when dates exist on rows) | P2 | **Next** |

### Approvals

| Insight | Priority | Classification |
|---|---|---|
| Approval list from participant flags | Shipped (placeholder) | — |
| **Approval dependency chain** per participant | P1 | **Now** |
| **Unlock condition** for each pending approval | P1 | **Now** |
| Approval history from audit entries | P2 | **Next** |

### Settlement readiness

| Insight | Priority | Classification |
|---|---|---|
| Readiness score, ready / blocking / missing lists | Shipped | — |
| Release confidence summary (compact) | Shipped | — |
| **Funding coordination stage** (5-step funnel) | P0 | **Now** |
| **Held-back revenue + reasons** | P1 | **Now** |
| **Participant readiness matrix** (ready vs blocked) | P1 | **Next** |
| **Settlement risk badge** (treasury health + confidence) | P1 | **Next** |

### Activity timeline

| Insight | Priority | Classification |
|---|---|---|
| Unified audit timeline | Shipped | — |
| **Milestone markers** (first funding, first approval, release-ready) | P2 | **Next** |
| **Trend annotation** ("3 blockers resolved this week") | P3 | **Future** |

### Audit history

| Insight | Priority | Classification |
|---|---|---|
| Compact audit list | Shipped | — |
| **Change summary** (what field changed — when audit payload supports it) | P2 | **Next** |

### Intelligence panel (right rail)

| Insight | Priority | Classification |
|---|---|---|
| Static KPI tiles | Shipped | — |
| **Top recommendation** with CTA | P0 | **Now** |
| **Critical blocker** (single highest-severity) | P0 | **Now** |
| **Funding progress mini-funnel** | P1 | **Next** |
| **Health trend sparkline** | P3 | **Future** |

---

## 4. Proactive Recommendations the Engine Can Generate

Recommendations must come from **`deriveOperationalNextActions`** and **`OperationalReleaseBlockerDetail`** first — these already include `remediation`, `unlockCondition`, `ctaHref`, and `urgency`.

### Recommendation taxonomy

| Type | Example | Source |
|---|---|---|
| **Setup** | Configure earnings for 2 participants | `deriveOperationalNextActions` |
| **Approval** | Request signature from Coastal Promotions | Release blockers + lifecycle |
| **Funding** | Confirm pending invoice funding ($12,400) | Funding stage + treasury |
| **Obligation** | Review obligations after funding confirmed | Post-rails progression actions |
| **Settlement** | Review settlement release (3 participants ready) | Release eligible count |
| **Confirmation** | Confirm external payout details for [name] | Missing confirmation stats |
| **Infrastructure** | Connect settlement provider | Workspace capabilities |
| **Compliance** | Align revenue share % with commercial role | Terms vs config drift (derived) |

### Proactive surfaces (beyond briefing)

| Surface | Recommendation style | Classification |
|---|---|---|
| Agreement briefing hero | One primary + up to 2 secondary actions | **Now** |
| Intelligence panel | Top action + blocker | **Now** |
| Dashboard agreement list | "Needs attention" + top blocker per agreement | **Next** |
| Email / in-app nudge | Resend approval after N days idle | **Future** |
| Weekly intelligence digest | Agreements at risk, funding gaps | **Future** |

### Ranking rules (proposed engine policy)

1. **Blocking release** beats **blocking setup**.
2. **Participant-facing** actions (approval) before **operator config** when settlement is otherwise funded.
3. **Funding confirmation** before **release review** when obligations are unfunded.
4. **Graph not converged** suppresses release actions — show recovery action only.
5. Deduplicate via existing `deduplicateOperationalActions` / `compressOperationalBlockers`.

---

## 5. Blockers the Engine Can Automatically Detect

Already implemented in `deriveOperationalReleaseBlockers` — the engine should **expose, categorize, and rank** these rather than re-detect.

### Blocker categories (existing)

| Category | Detection basis | User-facing framing |
|---|---|---|
| `funding_missing` | No source, unconfirmed funding, allocation gap | Funding not coordinated |
| `participant_approval_missing` | Agreement not approved | Participation agreement pending |
| `payout_details_missing` | Payout verification not confirmed | Settlement account / confirmation needed |
| `compensation_configuration_missing` | Earnings not saved | Commercial terms not configured |
| `operational_graph_initializing` | Graph not ready / not converged | Coordination still syncing |
| `obligation_sync_pending` | Obligation count mismatch | Obligations updating |
| `settlement_reconciliation_pending` | Reconcile/repair in progress | Settlement reconciliation pending |
| `provider_missing` | No stripe/wise/hedera | Settlement infrastructure missing |

### Additional derivable blockers (no new backend)

| Blocker | Detection | Classification |
|---|---|---|
| Currency mismatch | `deriveCurrencyConsistencyWarnings` (blocking) | **Now** |
| Forecast-only funding | Treasury health `forecast_heavy` | **Next** |
| Obligation blocked by approval | `deriveObligationApprovalState !== ready` | **Now** |
| Commercial terms drift | Role budget ≠ participant compensation | **Next** |
| Stale approval | Shared > N days, not approved | **Next** |
| Commission repair failed | Repair trace status `failed` | **Next** (when wired) |
| Attribution scope missing | Classification ATTRIBUTED_* but no catalog | **Next** |

### Blocker presentation rules

- Show **max 3** blockers above the fold; link to full list.
- Each blocker: **reason → remediation → unlock condition → CTA**.
- Never show raw internal enums (`participant_approval_missing`) to operators.
- Empty state: *"No settlement blockers detected"* (already in Phase 6).

---

## 6. Settlement Risks the Engine Should Surface

Settlement risk is distinct from blockers: blockers are **actionable now**; risks are **probability or exposure** if nothing changes.

### Risk signals (composable today)

| Risk | Condition | Severity | Classification |
|---|---|---|---|
| **Funding shortfall** | `confirmedFunding < obligationsTotal` | High | **Now** |
| **Forecast-dependent** | `projectHealth === 'forecast_heavy'` | Medium | **Now** |
| **Settlement risk treasury flag** | `projectHealth === 'settlement_risk'` | High | **Now** |
| **Blocked release confidence** | `releaseConfidence.level === 'BLOCKED'` | High | **Now** |
| **Pending funding at scale** | `pendingFunding / obligationsTotal > 0.3` | Medium | **Next** |
| **Partial participant readiness** | Some release-ready, some blocked with funding confirmed | Medium | **Next** |
| **Currency inconsistency** | Blocking currency warnings | High | **Now** |
| **Held-back revenue** | `heldBack > 0` with reasons | Medium | **Now** |
| **Reconciliation uncertainty** | Commission repair incomplete | Medium | **Next** |
| **Single-participant bottleneck** | One participant blocks >50% obligation value | Medium | **Next** |

### Risk presentation on briefing

**Settlement Readiness section** should add a **Risk summary** strip:

```
Settlement risk: Medium
• $4,200 obligation exposure unfunded
• 1 participant approval pending with confirmed revenue on file
```

Use calm operator language from `design-language.ts` — avoid alarmist fintech tone.

### Future predictive risks

| Risk | Approach | Classification |
|---|---|---|
| Predicted settlement delay | ML on historical approval + funding cycles | **Future** |
| Revenue attrition | Funding source confidence decay | **Future** |
| Compliance escalation | Terms drift uncorrected > N days | **Future** |

---

## 7. Participant Actions the Engine Can Recommend

Per-participant recommendations turn the briefing from **agreement-level reporting** into **coordination orchestration**.

### Action catalog

| Participant state | Recommended action | CTA destination |
|---|---|---|
| DRAFT, no invite sent | Share participation agreement | Participant workspace |
| SHARED, not viewed | Resend invitation | Participant workspace |
| VIEWED, not approved | Request approval | Participant workspace |
| Approved, earnings missing | Configure earnings | Commercial terms / earnings |
| Approved, payout unconfirmed | Confirm settlement details | Participant earnings |
| Release-ready | Include in settlement batch | Settlement releases |
| Attribution eligible, no link | Generate attribution link | Referral / attribution surface |
| Blocked obligation | Resolve [specific blocker] | Blocker `ctaHref` |

### Prioritization

1. Compute per-participant `releaseReadiness` + `operationalBlockers`.
2. Map to **one primary action** per participant (briefing Participants section).
3. Agreement-level **critical path participant** = participant whose unblock moves readiness score most (Next: simple heuristic — first blocking release blocker with `participantId`).

### Operator vs participant actions

| Actor | Example | Delivery |
|---|---|---|
| Operator | Configure earnings, confirm payout, review funding | In-app CTA |
| Participant | Approve agreement, provide tax/payout info | Invite / email nudge (**Future**) |

---

## 8. Future AI Capabilities

These build on the existing **AI extractor** (`src/lib/ai-extractor/`) and onboarding **`AgreementIntelligenceInsight`** pipeline.

### Near-term AI extensions (Future phase)

| Capability | Description | Depends on |
|---|---|---|
| **Agreement Q&A** | "Why isn't settlement ready?" answered from engine snapshot | Engine API + LLM grounding |
| **Briefing narrative** | Auto-generated 2-sentence executive summary | Snapshot + template |
| **Import refresh** | Re-run extraction when conversation/email appended | Extractor + diff |
| **Clause-level terms map** | Link commercial terms bullets to source excerpts | Extractor provenance |
| **Smart obligation suggestions** | Propose obligations from terms (onboarding already infers) | `deriveObligations` pattern |

### Medium-term AI

| Capability | Description |
|---|---|
| **Anomaly detection** | Unusual commission amounts vs historical agreement pattern |
| **Approval prediction** | Estimated approval date from participant behavior |
| **Funding forecast** | Predict confirmation date from invoice/payment link history |
| **Cross-agreement patterns** | "Similar agreements typically need X before settlement" |

### Long-term AI

| Capability | Description |
|---|---|
| **Autonomous coordination** | Scheduled nudges, auto-resend, escalation workflows |
| **Self-healing settlement** | Trigger commission repair / historical repair from detected drift |
| **Multi-party negotiation assist** | Suggest term changes when compliance drift detected |
| **Natural language agreement amendments** | Parse amendment → propose structured term updates |

**Principle:** AI narrates and prioritizes; **canonical operational selectors remain source of truth** for money movement and release gates.

---

## Focus Area Deep Dive

### Agreement Health

**Definition:** Holistic coordination posture — not just settlement score.

**Formula (proposed):**

```
healthScore = weighted(
  releaseConfidence.score × 0.35,
  configurationCompleteness × 0.25,
  (1 - normalizedBlockerSeverity) × 0.25,
  treasuryHealthIndex × 0.15
)
```

**Labels:** Healthy (≥80), In coordination (60–79), Needs attention (40–59), At risk (<40 or BLOCKED confidence).

| Item | Classification |
|---|---|
| Composite health score + explanation | **Next** |
| Wire existing healthLabel to composite | **Now** (thin) |
| Trend from audit snapshots | **Future** |

### Obligation Risk

**Definition:** Exposure and dependency risk before settlement.

| Item | Classification |
|---|---|
| Grouped obligation view | Shipped |
| Unfunded exposure total | **Next** |
| Per-obligation funding % | **Now** |
| Dependency chain to approval | **Now** |
| Due-date aging alerts | **Future** (needs due dates on more rows) |

### Settlement Readiness

**Definition:** Eligibility and confidence for release — already strongest area.

| Item | Classification |
|---|---|
| Readiness score ring | Shipped |
| Ready / blocking / missing lists | Shipped |
| Funding stage funnel | **Now** |
| Release blockers with CTAs | **Now** |
| Held-back revenue | **Now** |
| Participant readiness matrix | **Next** |

### Approval Dependencies

**Definition:** Who must approve what before obligations settle.

| Item | Classification |
|---|---|
| Synthetic approval list | Shipped |
| Canonical lifecycle visualization | **Now** |
| Unlock conditions per approval | **Now** |
| Approval history from audit | **Next** |
| Automated nudges | **Future** |

### Funding Progress

**Definition:** Revenue collection → obligation coverage → release funding.

| Item | Classification |
|---|---|
| Funding label / subcopy | Shipped |
| Treasury panel | Shipped |
| 5-stage funding funnel | **Now** |
| Surplus / shortfall vs obligations | **Now** |
| Expected settlement dates | **Next** |
| Forecast reliance warning | **Next** |

### Participant Coordination

**Definition:** Who does what next across parties.

| Item | Classification |
|---|---|
| Participant cards | Shipped |
| Per-participant blocker + CTA | **Now** |
| Critical path participant | **Next** |
| Coordination bottleneck highlight | **Next** |
| Outbound nudges | **Future** |

### Commercial Compliance

**Definition:** What was agreed matches what is configured.

| Item | Classification |
|---|---|
| Commercial terms display | Shipped |
| Terms vs earnings drift detection | **Next** |
| Import vs live term diff | **Next** |
| Missing schedule / basis warnings | **Next** |
| AI-powered clause compliance | **Future** |

---

## Proposed Architecture

### Module layout (implementation phase — not now)

```
src/lib/agreements/intelligence/
  agreement-intelligence-engine.ts    # orchestrator
  agreement-health.ts                 # health composite
  agreement-risk.ts                   # settlement + obligation risk
  agreement-recommendations.ts        # wraps deriveOperationalNextActions
  agreement-compliance.ts             # terms vs config drift
  agreement-intelligence.types.ts     # Insight, Signal, Recommendation types
```

### Engine contract (sketch)

```typescript
type AgreementIntelligenceInput = {
  deal: RecentDeal;
  summary: ProjectWorkspaceSummary;
  participants: DemoParticipant[];
  obligationRows: BriefingObligationRowInput[];
  treasury: ProjectTreasurySummary | null;
  guidance: OperationalGuidanceBundle; // from useOperationalCoordinationState
  auditEntries: OperationalAuditEntry[];
  onboardingInsight?: AgreementIntelligenceInsight | null;
};

type AgreementIntelligenceOutput = {
  snapshot: AgreementBriefingSnapshot;      // existing Phase 6 shape
  health: AgreementHealthInsight;
  risks: SettlementRiskInsight[];
  recommendations: OperationalAction[];     // ranked
  blockers: OperationalReleaseBlockerDetail[]; // deduplicated
  participantActions: ParticipantActionInsight[];
  compliance: ComplianceInsight[];
};
```

**Rule:** UI components consume `AgreementIntelligenceOutput` only. No new ad-hoc derivation in React components.

---

## Roadmap & Prioritization

### Phase 7A — **Now** (4–6 weeks)

*Goal: Briefing becomes actionable intelligence using existing engines.*

| # | Deliverable | Effort | Impact |
|---|---|---|---|
| 1 | Extract `AgreementIntelligenceEngine` orchestrator wrapping existing selectors | M | Foundation |
| 2 | Surface **primary + secondary recommendations** on briefing hero | S | High |
| 3 | Wire **categorized release blockers** with CTAs to Settlement + Summary | S | High |
| 4 | Add **funding coordination stage** funnel to Settlement section | S | High |
| 5 | Show **release confidence explainability** bullets in hero | S | Medium |
| 6 | **Per-participant blocker line + CTA** on Participants section | M | High |
| 7 | **Approval dependency + unlock condition** on Approvals section | S | Medium |
| 8 | **Funding coverage** on obligation rows | S | Medium |
| 9 | Intelligence panel: **top recommendation + critical blocker** | S | High |
| 10 | Persist onboarding `AgreementIntelligenceInsight` on deal metadata for post-activation drift (read-only) | M | Medium |

**Success metric:** Operator completes top recommended action without leaving overview in ≥70% of test scenarios.

### Phase 7B — **Next** (6–10 weeks)

*Goal: Predictive and comparative intelligence across agreements.*

| # | Deliverable | Effort | Impact |
|---|---|---|---|
| 11 | Composite **Agreement Health** score with explanation | M | High |
| 12 | **Commercial compliance** drift (terms vs configuration) | M | High |
| 13 | **Settlement risk strip** (shortfall, forecast reliance, held-back) | M | High |
| 14 | **Participant readiness matrix** + critical path participant | M | Medium |
| 15 | **Outstanding obligation exposure** totals | S | Medium |
| 16 | Dashboard **agreement intelligence widgets** (health, top blocker) | L | High |
| 17 | **Staleness detection** + "no progress in N days" | S | Medium |
| 18 | Wire **commission repair / reconciliation** status into settlement risk | M | Medium |
| 19 | Snapshot **readiness history** (lightweight client or audit-derived trend) | L | Medium |
| 20 | Milestone-rich **activity timeline** | M | Low |

**Success metric:** Operators identify at-risk agreements from dashboard without opening each briefing.

### Phase 7C — **Future** (quarter+)

*Goal: AI-assisted coordination and automation.*

| # | Deliverable | Effort | Impact |
|---|---|---|---|
| 21 | Agreement **Q&A** grounded on intelligence snapshot | L | High |
| 22 | Auto-generated **executive narrative** on briefing open | M | Medium |
| 23 | **Proactive nudges** (email/in-app) for stale approvals | L | High |
| 24 | **Import refresh** — re-extract terms from new conversation context | L | Medium |
| 25 | **Anomaly detection** on commissions and funding | L | Medium |
| 26 | **Weekly intelligence digest** | M | Medium |
| 27 | **Self-healing triggers** from detected drift (repair jobs) | L | High |
| 28 | **Predictive settlement delay** | XL | Medium |

---

## Classification Summary

| Idea | Now | Next | Future |
|---|---|---|---|
| Primary recommended action on briefing | ✓ | | |
| Release blockers with CTAs | ✓ | | |
| Funding coordination stage funnel | ✓ | | |
| Per-participant blocker + action | ✓ | | |
| Approval unlock conditions | ✓ | | |
| Obligation funding coverage | ✓ | | |
| Intelligence panel top action | ✓ | | |
| Composite agreement health score | | ✓ | |
| Commercial compliance drift | | ✓ | |
| Settlement risk strip | | ✓ | |
| Dashboard intelligence widgets | | ✓ | |
| Critical path participant | | ✓ | |
| Readiness trend / history | | ✓ | |
| Commission repair risk surfacing | | ✓ | |
| Agreement Q&A | | | ✓ |
| Proactive nudges / digest | | | ✓ |
| Predictive delay / anomalies | | | ✓ |
| Autonomous repair triggers | | | ✓ |

---

## What Makes Intelligence "Genuine"

| Reporting interface | Agreement Intelligence Engine |
|---|---|
| Shows current field values | Explains **why** state exists |
| Lists all problems equally | **Ranks** blockers and recommendations |
| Static snapshot | **Trend** and staleness (Next) |
| Agreement page only | Powers **dashboard + automation** |
| Generic empty states | Contextual **coordination language** |
| Manual navigation to fix | **One-click CTAs** to remediation surfaces |
| Terms displayed | Terms **validated against configuration** |
| Settlement score | Score + **confidence narrative + risk exposure** |

---

## Dependencies & Guardrails

### Dependencies

- `useOperationalCoordinationState` must remain the single guidance hook for project scope.
- Briefing must not fork KPI or blocker logic — engine wraps `operational-graph-adapter` outputs.
- Onboarding insight persistence requires deal metadata field or audit attachment (design in 7A).

### Guardrails (unchanged from Phase 6)

- No route changes required for 7A/7B.
- No new release/settlement business logic — intelligence **explains** existing gates.
- AI features (7C) must ground on engine snapshot; never bypass payout release checks.
- Operator language from `design-language.ts` — calm, settlement-centric.

### Non-goals for Phase 7

- Replacing dedicated workspace tabs (participants, funding, obligations).
- Building a new audit system.
- Auto-executing settlement releases without operator confirmation.
- Schema migration for `project` → `agreement` (terminology only continues).

---

## Recommended First Sprint (Phase 7A kickoff)

1. **`agreement-intelligence-engine.ts`** — input/output types; delegate to `composeAgreementBriefingSnapshot` + guidance bundle.
2. **Hero recommendation strip** — `guidance.actions[0]` with CTA.
3. **Blocker panel** — top 3 `releaseBlockers` in Settlement section.
4. **Funding stage** — `deriveFundingCoordinationStage(treasury)` visual.
5. **Refactor** `AgreementIntelligenceBriefing` to consume engine output only.

This sprint converts the briefing from **Phase 6 composition** into the first **consumer of the Agreement Intelligence Engine** — establishing the pattern for dashboard and automation work in 7B/7C.

---

## Appendix: Key Code References

| Concern | Location |
|---|---|
| Briefing composition | `src/lib/agreements/agreement-briefing.model.ts` |
| Briefing UI | `src/components/agreements/briefing/` |
| Coordination graph | `src/lib/operations/selectors/operational-coordination-snapshot.ts` |
| Guidance adapter | `src/lib/operations/selectors/operational-graph-adapter.ts` |
| Release blockers | `src/lib/operations/explainability/derive-operational-release-blockers.ts` |
| Next actions | `src/lib/operations/explainability/derive-operational-next-actions.ts` |
| Release confidence | `src/lib/operations/explainability/release-confidence.ts` |
| Funding stages | `src/lib/operations/truth/funding-coordination-semantics.ts` |
| Onboarding insights | `src/lib/onboarding/agreement-intelligence-insights.ts` |
| Domain model | `docs/CANONICAL_DOMAIN_MODEL.md` |
| Briefing spec | `docs/AGREEMENT_INTELLIGENCE_BRIEFING_SPEC.md` |

---

*End of proposal — implementation requires explicit Phase 7A kickoff approval.*
