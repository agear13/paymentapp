'use client';

import { useOperationalCoordinationState } from '@/hooks/use-operational-coordination-state';
import { useAgreementHealthPortfolio } from '@/hooks/use-agreement-health-portfolio';
import { deriveOperationalSeverity } from '@/lib/operations/severity';
import { deduplicateAttentionItems } from '@/lib/operations/explainability/deduplicate-operational-actions';
import { opPage } from '@/lib/design/operational-spacing';
import { buildWorkspaceExperience } from '@/components/workflow/operations-manager';

import { ProvvyCopilot } from '@/components/operations/provvy-copilot';
import { BusinessMomentum } from '@/components/operations/business-momentum';
import { ContinueWorkflowCard } from '@/components/operations/continue-workflow-card';
import { BusinessSnapshotHero } from '@/components/operations/business-snapshot-hero';
import { WorkspaceHealthScore } from '@/components/operations/workspace-health-score';
import { MoneyWaitingPanel } from '@/components/operations/money-waiting-panel';
import { AgreementWorkflowPanel } from '@/components/operations/agreement-workflow-panel';
import { AgreementsOperationalGrid } from '@/components/operations/agreements-operational-grid';
import { WorkspaceActivityFeed } from '@/components/operations/workspace-activity-feed';
import { AskProvvyPanel } from '@/components/operations/ask-provvy-panel';
import { deriveQueueTasksFromAttention } from '@/components/operations/operational-queue';

export function OperationalHomeCommandCenter() {
  const { guidance, loading, workspaceContext, kpis, activation, auditTimeline } =
    useOperationalCoordinationState({ traceSurface: 'operational-home-command-center' });
  const { portfolio, snapshots, loading: healthLoading } = useAgreementHealthPortfolio();

  const isLoading = loading || healthLoading;
  const primaryAction = guidance.actions[0] ?? null;

  const attentionItems = deduplicateAttentionItems(
    deriveOperationalSeverity({
      guidance,
      workspace: workspaceContext,
      projectName: undefined,
      kpis,
    }),
    {
      primaryActionLabel: primaryAction?.action ?? null,
      primaryActionHref: primaryAction?.destination ?? null,
      maxCritical: 8,
      maxPerSeverity: 8,
    }
  );

  const queueTasks = deriveQueueTasksFromAttention(attentionItems);

  // ── Operations Manager: builds the workspace experience
  //    This is the single source of truth for what the operator should do today.
  //    Replaces all per-component reasoning derivation.
  const experience = !isLoading
    ? buildWorkspaceExperience({
        snapshots,
        kpis: kpis ?? null,
        releaseConfidence: guidance.releaseConfidence ?? null,
        workspaceContext: workspaceContext ?? null,
        activation: activation ?? null,
        attentionItems,
        auditEntries: auditTimeline,
      })
    : null;

  return (
    <div className={opPage()}>

      {/* ── 0. Business Momentum ──────────────────────────────────────────
          Auto-dismiss success banner for recent milestones (within 90 min).
          "Payments are now live." — disappears after 5 seconds.           */}
      {!isLoading ? (
        <BusinessMomentum auditEntries={auditTimeline} />
      ) : null}

      {/* ── 1. Provvy Copilot — "Today" ──────────────────────────────────
          "Good afternoon. I've reviewed your business. Three things are
          worth your attention today."
          Powered by the Operations Manager. First-person. Specific.       */}
      <ProvvyCopilot
        attentionItems={attentionItems}
        kpis={kpis}
        releaseConfidence={guidance.releaseConfidence}
        snapshots={snapshots}
        queueTasks={queueTasks}
        auditEntries={auditTimeline}
        openingSummary={experience?.openingSummary}
        greeting={experience?.greeting}
        todaysFocus={experience?.todaysFocus}
        workspaceMode={experience?.workspaceMode}
        loading={isLoading}
      />

      {/* ── 2. Continue Where You Left Off ───────────────────────────────
          Session memory: "Yesterday you finished configuring earnings."
          Next step + minutes. Continue → goes directly there.             */}
      {!isLoading ? (
        <ContinueWorkflowCard
          auditEntries={auditTimeline}
          snapshots={snapshots}
          queueTasks={queueTasks}
        />
      ) : null}

      {/* ── 3. Business Snapshot + Workspace Health ───────────────────────
          Revenue / Agreements / Participants / Actions flow groups.
          Health score with human interpretation ("Almost ready...").      */}
      <div className="grid gap-3 xl:grid-cols-[1fr_260px]">
        <BusinessSnapshotHero
          portfolio={portfolio}
          kpis={kpis}
          releaseConfidence={guidance.releaseConfidence}
          attentionItems={attentionItems}
          loading={isLoading}
        />
        {!isLoading ? (
          <WorkspaceHealthScore
            portfolio={portfolio}
            kpis={kpis}
            workspace={workspaceContext}
            releaseConfidence={guidance.releaseConfidence}
          />
        ) : null}
      </div>

      {/* ── 4. Money Waiting ──────────────────────────────────────────────
          Four money states: Collected · For approvals · Ready · Held.
          Operators care about money, not health scores.                   */}
      <MoneyWaitingPanel
        releaseConfidence={guidance.releaseConfidence}
        loading={isLoading}
      />

      {/* ── 5. Today's Plan — grouped by agreement ────────────────────────
          "Finish Sunset Sessions" not "complete 3 unrelated tasks."
          ✓ Done steps + ○ Pending steps + time + Continue workflow CTA.  */}
      <AgreementWorkflowPanel tasks={queueTasks} snapshots={snapshots} />

      {/* ── 6. Your Agreements ────────────────────────────────────────────
          Workflow pipeline primary, score secondary.
          ✓ Agreement · ✓ Participants · ● Payments · ○ Ready · ○ Live   */}
      <AgreementsOperationalGrid snapshots={snapshots} loading={healthLoading} />

      {/* ── 7. Business Story ─────────────────────────────────────────────
          Not system logs — business milestones in plain language.
          "Payments are now live." + why it matters. Grouped by day.      */}
      <WorkspaceActivityFeed
        auditEntries={auditTimeline}
        timelineEvents={guidance.timeline}
      />

      {/* ── 8. Ask Provvy ────────────────────────────────────────────────
          Intelligent query panel backed by the Commercial Graph.
          Deterministic answers from live data. Feels like querying
          your business, not chatting with a bot.                         */}
      <AskProvvyPanel
        snapshots={snapshots}
        attentionItems={attentionItems}
        releaseConfidence={guidance.releaseConfidence}
        kpis={kpis}
      />

    </div>
  );
}
