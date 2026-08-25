'use client';

import * as React from 'react';
import Link from 'next/link';
import { useProjectWorkspace } from '@/components/projects/project-workspace-provider';
import { OperationalActivitySection } from '@/components/operations/operational-activity-section';
import { deriveApprovalStats } from '@/components/projects/approval-centre-header';
import {
  commercialWorkspaceSettlementLabel,
  commercialWorkspaceSourceOf,
  toCommercialWorkspaceListItem,
} from '@/lib/commercial-os/commercial-workspace-collection';
import { commercialWorkspaceNextStep } from '@/lib/commercial-os/commercial-workspace-next-step';
import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <div className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">{label}</div>
      <div className="mt-2 text-[15px] font-semibold">{value}</div>
      {hint ? <p className="mt-1 text-[12px] text-ink-soft">{hint}</p> : null}
    </div>
  );
}

export function CommercialWorkspaceOverviewPanel() {
  const { deal, summary, projectParticipants, projectId } = useProjectWorkspace();
  if (!deal) return null;

  const item = toCommercialWorkspaceListItem(deal, projectParticipants);
  const approvals = deriveApprovalStats(projectParticipants);
  const hasFunding = Boolean(summary?.treasury?.hasFundingSources);
  const next = commercialWorkspaceNextStep({
    workspaceId: projectId,
    participantCount: projectParticipants.length,
    pendingApprovals: approvals.pending,
    hasFundingSources: hasFunding,
    fundingLabel: summary?.fundingLabel ?? item.settlementLabel,
    obligationAwaitingCount: summary?.treasury?.obligationsAwaitingFunding,
  });
  const source = commercialWorkspaceSourceOf(deal);
  const valueLabel = summary?.currencyLabel ?? (deal.value ? String(deal.value) : 'Not set');

  return (
    <div className="space-y-6" data-testid="commercial-workspace-overview">
      <p className="max-w-2xl text-[14px] text-ink-soft">
        You are in the Commercial Workspace for this arrangement — not the Agreement Intelligence
        extraction. Participants, obligations, funding, and settlement stay on this operational
        graph.
      </p>

      {summary?.needsAttention || approvals.pending > 0 || projectParticipants.length === 0 ? (
        <div
          className="rounded-2xl border border-primary/30 bg-secondary/40 p-5 shadow-card"
          data-testid="workspace-next-step"
        >
          <div className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">
            Next step
          </div>
          <h2 className="mt-2 text-[16px] font-semibold">{next.title}</h2>
          <p className="mt-1 text-[13px] text-ink-soft">{next.description}</p>
          <Link
            href={next.href}
            className="mt-3 inline-flex text-[13px] font-medium text-primary hover:underline"
          >
            {next.cta}
          </Link>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <div className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">
            Next step
          </div>
          <h2 className="mt-2 text-[16px] font-semibold">{next.title}</h2>
          <p className="mt-1 text-[13px] text-ink-soft">{next.description}</p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard label="Status" value={item.statusLabel} />
        <MetricCard
          label="Counterparty"
          value={deal.partner?.trim() || item.name}
        />
        <MetricCard label="Commercial value" value={valueLabel} />
        <MetricCard
          label="Participants"
          value={String(projectParticipants.length)}
          hint={
            approvals.pending > 0
              ? `${approvals.pending} pending approval`
              : approvals.total > 0
                ? `${approvals.approved} accepted`
                : undefined
          }
        />
        <MetricCard
          label="Settlement"
          value={summary?.payoutLabel ?? commercialWorkspaceSettlementLabel(deal)}
          hint={summary?.fundingLabel}
        />
        <MetricCard label="Source" value={item.sourceLabel} />
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <div className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">
          Recent activity
        </div>
        <div className="mt-3">
          <OperationalActivitySection
            projectId={projectId}
            title="Workspace events"
            defaultOpen
            maxItems={6}
            emptyMessage="No operational events recorded for this workspace yet."
          />
        </div>
        <Link
          href={COMMERCIAL_OS_ROUTES.arrangementActivity(projectId)}
          className="mt-3 inline-flex text-[13px] font-medium text-primary hover:underline"
        >
          Open Activity
        </Link>
      </div>

      {source === 'manual' ? (
        <p className="text-[12px] text-ink-soft">
          Created manually. There is no linked Agreement Intelligence extraction for this workspace.
        </p>
      ) : null}
    </div>
  );
}
