# Agreement Intelligence Validation Program (Phase 8)

Objective: validate whether operators understand, value, and act on Agreement Intelligence. This phase adds **measurement only** — no new intelligence features.

## Dashboard

**Route:** `/dashboard/reports/agreement-intelligence`

**Nav:** Reporting → Agreement Intelligence

The dashboard surfaces four report sections:

| Section | Purpose |
|---------|---------|
| Agreement Intelligence Usage Report | Briefing views, section views, interactions, dwell time |
| Recommendation Effectiveness Report | Viewed → acted → dismissed → completed funnel per recommendation |
| Health Score Accuracy Report | Health category vs settlement readiness / release outcomes |
| Outcome timing + User understanding | Milestone timing and Yes/No feedback prompts |

## Instrumentation

Client events POST to `POST /api/agreements/intelligence/analytics`. Aggregates are served by `GET /api/agreements/intelligence/analytics?since=…`.

### Usage events

| Event | Trigger |
|-------|---------|
| `briefing_viewed` | Agreement Intelligence briefing mounted |
| `briefing_dwell_recorded` | Briefing unmount (dwell ms) |
| `health_section_viewed` | `#briefing-health` intersects viewport |
| `recommendation_viewed` | Primary recommendation rendered |
| `recommendation_cta_clicked` | Hero or panel CTA clicked |
| `recommendation_acted_upon` | Same as CTA click (paired event) |
| `recommendation_dismissed` | Briefing closed without acting on recommendation |
| `recommendation_completed` | Reserved for future completion hooks |
| `blocker_panel_viewed` | `#briefing-blockers` intersects viewport |
| `blocker_cta_clicked` | Blocker resolution CTA clicked |
| `participant_action_clicked` | Participant required-action link clicked |
| `settlement_readiness_viewed` | `#briefing-settlement` intersects viewport |
| `funding_funnel_viewed` | `#briefing-funnel` intersects viewport |

### Outcome milestones

| Event | Trigger |
|-------|---------|
| `outcome_first_agreement` | First agreement created (onboarding, manual create, conversation import) |
| `outcome_first_participant` | Briefing shows participant count > 0 |
| `outcome_first_obligation` | Briefing shows obligation count > 0 |
| `outcome_settlement_readiness` | Health ≥ 75 or settlement readiness score ≥ 75 |
| `outcome_settlement_release` | Funding funnel step `settlement-released` is complete |

Outcome events dedupe via `localStorage` key `provvypay:ai-outcome:{event}:{projectId|workspace}`.

### Feedback prompts

Shown once per session (4s delay) on agreement briefings:

- **Recommendation:** “Was this recommendation helpful?” → `feedback_recommendation_helpful` / `feedback_recommendation_not_helpful`
- **Blockers:** “Did you understand what was blocking settlement?” → `feedback_blocker_understood_yes` / `feedback_blocker_understood_no`

Session dedupe: `sessionStorage` key `provvypay:ai-feedback:{kind}`.

### Health samples

`health_score_recorded` fires on each briefing view with score, category, and settlement readiness score. Used for health accuracy correlation.

## Report definitions

### Recommendation effectiveness

For each `recommendationAction`:

- **Viewed** — `recommendation_viewed`
- **Acted** — `recommendation_acted_upon` or `recommendation_cta_clicked`
- **Dismissed** — `recommendation_dismissed`
- **Completed** — `recommendation_completed`
- **Action rate** — acted / viewed (%)
- **Completion rate** — completed / acted (%)

### Health score accuracy

Groups `health_score_recorded` by `healthCategory`. For each category:

- **Reached readiness** — same `projectId` also has `outcome_settlement_readiness`
- **Released** — same `projectId` also has `outcome_settlement_release`
- **Predictive rate** — readiness reached / samples (%)

### Outcome timing

Median hours from first `briefing_viewed` per agreement to each outcome event (when both exist).

## Interview program

Recruit **10 operators** (mix of new and experienced workspace users).

### Sessions (45–60 min each)

1. **Agreement creation** — observe onboarding or manual create; note where intelligence is absent vs expected.
2. **Agreement review** — open briefing; watch recommendation, health, blockers, funnel usage.
3. **Settlement preparation** — follow recommendation CTAs through to settlement surfaces.

### Questions

- What confused you?
- What was valuable?
- What felt unnecessary?
- Did the recommendation match what you would do next?
- Did health score match your sense of agreement readiness?

### Success signals

- ≥ 60% recommendation helpful (Yes) on feedback prompts
- ≥ 40% recommendation action rate on top recommendations
- Health categories with higher scores show higher readiness/release rates
- Median time-to-readiness decreases for operators who view briefings repeatedly

## Production notes

- Server store is an **in-memory ring buffer** (10k events per process). Restart clears buffer.
- All events also log as `agreement.intelligence.validation` for log pipeline export.
- For durable analytics, pipe structured logs to your warehouse (BigQuery, Datadog, etc.) or replace the store with Postgres/Redis before launch-scale validation.

## Key files

```
src/lib/agreements/validation/agreement-intelligence-analytics.ts
src/lib/agreements/validation/agreement-intelligence-validation-store.server.ts
src/lib/agreements/validation/aggregate-validation-metrics.ts
src/hooks/use-agreement-intelligence-tracking.ts
src/components/agreements/validation/agreement-intelligence-validation-dashboard.tsx
src/app/api/agreements/intelligence/analytics/route.ts
src/app/(dashboard)/dashboard/reports/agreement-intelligence/page.tsx
```
