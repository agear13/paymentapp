# Agreement Intelligence Briefing — Product Spec

**Phase 5 — Planning document only (not implemented)**  
**Purpose:** Blueprint for transforming agreement detail pages into Agreement Intelligence Briefings.  
**Route:** Continues to use `/dashboard/projects/[id]` until a future route alias phase.

---

## Vision

The agreement detail page should feel like an **intelligence briefing**, not an admin form or payment dashboard. Operators should immediately sense: *"The platform understood my agreement."*

This spec extends the onboarding `AgreementIntelligenceReport` pattern into the live operator workspace.

---

## Design Principles

1. **Agreement-first** — The agreement is the hero object; funding and settlement are sections, not the page title.
2. **Readiness-forward** — Confidence and settlement readiness visible above the fold.
3. **Progressive disclosure** — Summary first; drill into participants, obligations, audit.
4. **Same voice as onboarding** — Reuse Intelligence badge, score visualization, section dividers.
5. **No new business logic in v1** — Compose existing data sources; do not add APIs in first implementation.

---

## Page Structure

```
┌──────────────────────────────────────────────────────────────────┐
│  [← All agreements]                    [Agreement Intelligence]  │
│                                                                  │
│  {Agreement name}                                                │
│  {Agreement type badge} · {Phase pill} · {Currency}              │
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │ Readiness   │  │ Confidence  │  │ Next coordination step  │  │
│  │ score ring  │  │ indicator   │  │ (primary CTA)           │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
├──────────────────────────────────────────────────────────────────┤
│  SECTION NAV (sticky sub-nav or tabs)                            │
│  Summary · Participants · Terms · Obligations · Approvals ·    │
│  Settlement · Activity · Audit                                   │
├──────────────────────────────────────────────────────────────────┤
│  {Active section content}                                        │
└──────────────────────────────────────────────────────────────────┘
```

---

## Section Specifications

### 1. Agreement Summary

**Purpose:** At-a-glance identity and coordination status.

**Content:**

| Field | Source (existing) |
|---|---|
| Agreement name | `deal.dealName` / project summary |
| Agreement type | Workflow/use-case metadata |
| Creation source | Conversation import, template, manual |
| Coordination phase | `PROJECT_PHASE_OPERATOR` / operational state |
| Participant count | Project participants |
| Obligation summary | Outstanding / funded / ready counts |
| Blocking issues | Attention items filtered to this agreement |

**User-facing helper:** *"Commercial relationship status and coordination phase for this agreement."*

**Empty state:** *"This agreement is still being configured. Add participants and commercial terms to generate obligations."*

---

### 2. Participants

**Purpose:** All parties to the agreement with approval and earnings status.

**Reuses:** `project-participants-view.tsx` table and KPIs (reframed).

**KPI labels (canonical):**

| Legacy | Briefing label |
|---|---|
| Pending agreements | Approvals pending |
| Missing confirmation | Confirmations needed |
| Ready for payout | Settlement ready |
| Active attribution | Active attribution |

**Primary CTA:** Invite participant  
**Secondary:** Configure earnings

---

### 3. Commercial Terms

**Purpose:** Roles, budgets, and extracted terms that define the arrangement.

**Reuses:** `project-commercial-roles-view.tsx` + optional extracted terms panel from intelligence insights (when available).

**Merge:** "Commercial roles" tab → "Commercial terms" in briefing nav.

**Helper:** *"Roles, budgets, and terms that define this commercial relationship."*

---

### 4. Obligations

**Purpose:** What is owed, funded, and ready before settlement.

**Reuses:** `project-obligations-view.tsx`, obligations workspace filtered to agreement.

**Table columns:** Participant · Type · Amount · Obligation status

**Helper:** *"Amounts owed under this agreement — funding and approvals determine settlement eligibility."*

**Empty:** *"No obligations in this agreement yet. They appear when participants and earnings are configured."*

---

### 5. Approvals

**Purpose:** Dedicated surface for gating items — currently scattered across participant KPIs.

**Content (composed v1):**

- Participant agreements awaiting signature
- Operator settlement confirmations pending
- Manual review items (bank transfer verification linked to agreement funding)

**Helper:** *"Sign-offs required before obligations can settle."*

**Empty:** *"No pending approvals. Settlement can proceed when obligations are funded."*

**Implementation note:** v1 may aggregate from existing participant approval flags; dedicated API optional in v2.

---

### 6. Settlement Readiness

**Purpose:** Replace current "Payouts" tab — readiness and eligibility, not raw disbursement UI.

**Reuses:**

- `project-payouts-view.tsx` readiness cards
- `ReleaseConfidenceSummary` scoped to agreement
- Link to workspace settlement releases for execution

**Helper:** *"Funding, confirmations, and eligibility for settlement under this agreement."*

**Sub-sections:**

| Block | Content |
|---|---|
| Readiness summary | X/Y participants settlement-ready |
| Funding linkage | Funding sources panel (compact) |
| Eligible obligations | Count ready for settlement batch |
| Action | Review settlement / Create settlement batch (deep link) |

---

### 7. Activity Timeline

**Purpose:** Coordination events in chronological order.

**Reuses:** `OperationalActivitySection`, `OperationalAuditTimeline` filtered by `projectId`.

**Default copy:** *"Coordination events as this agreement progresses — approvals, funding, obligations, and settlement."*

**Event label migration:**

| Current event label | Briefing label |
|---|---|
| Payout obligation approved | Obligation approved |
| Payout release created | Settlement release created |
| Payout settlement completed | Settlement completed |

---

### 8. Audit History

**Purpose:** Immutable record for operators and accountants.

**Reuses:** Ledger cross-links, export actions, reconciliation pointers scoped to agreement.

**Content:**

- Key financial events tied to agreement funding sources
- Settlement release history
- Export agreement audit pack (future)

**Helper:** *"Immutable record of agreement, approval, and settlement events."*

---

## Navigation Within Briefing

**Recommended tab order:**

1. Summary (default)
2. Participants
3. Commercial terms
4. Obligations
5. Approvals
6. Settlement readiness
7. Activity
8. Audit

**Tab label migration from current `project-context-nav.tsx`:**

| Current | Briefing |
|---|---|
| Overview | Summary |
| Commercial roles | Commercial terms |
| Participants | Participants |
| Funding sources | *(merged into Settlement readiness + Summary)* |
| Obligations | Obligations |
| Payouts | Settlement readiness |
| Activity | Activity |
| *(new)* | Approvals |
| *(new)* | Audit |

Funding sources panel remains accessible from Settlement readiness and Summary cards — not a top-level tab in v1 briefing.

---

## Intelligence Visual Language

Reuse from Phase 3 onboarding components:

| Element | Component | Usage on briefing |
|---|---|---|
| Intelligence badge | `IntelligenceBadge` | Page header when insights available |
| Readiness ring | `ScoreRing` from report | Summary section |
| Confidence indicator | Report confidence viz | Summary section |
| Section dividers | Report section pattern | Between briefing blocks |
| Surface classes | `surface-intelligence`, `surface-settlement` | Readiness vs settlement blocks |

**Analyzing state:** Show shimmer/pulse when intelligence refresh in progress (future AI re-analysis).

---

## Data Composition (No New APIs v1)

| Section | Existing hooks / components |
|---|---|
| Summary | `useProjectWorkspace`, `useOperationalCoordinationState` |
| Participants | `project-participants-view` data layer |
| Commercial terms | Commercial roles API + deal metadata |
| Obligations | Project obligations view / coordination snapshot |
| Approvals | Participant approval flags + review queues |
| Settlement readiness | `project-payouts-view`, release confidence |
| Activity | `OperationalActivitySection` |
| Audit | Ledger filters by agreement funding sources |

---

## Responsive Behavior

- **Desktop:** Summary hero + horizontal section nav
- **Mobile:** Section nav collapses to dropdown; readiness rings stack vertically
- **Print/export:** Summary + Audit sections optimized for PDF export (future)

---

## Success Metrics (Future)

- Time to find settlement blocker on agreement page
- Reduction in support questions conflating invoice vs obligation
- Operator comprehension survey: "What is the primary object?" → Agreement

---

## Implementation Phases (Recommended)

| Phase | Scope |
|---|---|
| **5** | Terminology + this spec (current) |
| **6a** | Rename tabs + headers to briefing labels; no layout change |
| **6b** | Summary hero with readiness rings; compose existing widgets |
| **6c** | Approvals section aggregation |
| **6d** | Audit section + export |
| **6e** | Live intelligence re-analysis (AI) |

---

## Out of Scope (This Spec)

- Route changes (`/agreements/[id]`)
- Database rename (`projects` → `agreements`)
- New permission models
- Payer-facing invoice/payment UI changes
- Analytics event renames

---

*Cross-reference: [CANONICAL_DOMAIN_MODEL.md](./CANONICAL_DOMAIN_MODEL.md), [TERMINOLOGY_MIGRATION_MAP.md](./TERMINOLOGY_MIGRATION_MAP.md)*
