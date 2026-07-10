'use client';

import { cn } from '@/lib/utils';
import { formatCompactCurrency } from '@/lib/formatters/format-currency';
import type { AgreementHealthPortfolioSummary } from '@/lib/agreements/health/agreement-health.types';
import type { OperationalKPIs } from '@/lib/operations/reducer/types';
import type { CommercialFinancialSnapshot } from '@/lib/commercial/commercial-financial-snapshot';
import type { AttentionItem } from '@/lib/operations/severity';

type BusinessSnapshotHeroProps = {
  portfolio: AgreementHealthPortfolioSummary | null;
  snapshot: CommercialFinancialSnapshot | null | undefined;
  kpis: OperationalKPIs | null | undefined;
  attentionItems: AttentionItem[];
  loading?: boolean;
};

type FlowMetric = {
  label: string;
  value: string;
  tone?: 'default' | 'positive' | 'urgent' | 'muted';
};

type FlowGroup = {
  heading: string;
  metrics: FlowMetric[];
};

function fmt(amount: number, currency: string): string {
  if (amount <= 0) return '—';
  return formatCompactCurrency(amount, currency);
}

function num(n: number): string {
  return n > 0 ? String(n) : '—';
}

export function BusinessSnapshotHero({
  portfolio,
  snapshot,
  kpis,
  attentionItems,
  loading,
}: BusinessSnapshotHeroProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-border/60 bg-muted/20 px-4 py-5 space-y-3 animate-pulse"
          >
            <div className="h-2.5 w-16 bg-muted rounded" />
            <div className="space-y-1.5">
              <div className="h-5 w-12 bg-muted rounded" />
              <div className="h-3 w-20 bg-muted rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const currency = snapshot?.currency ?? 'AUD';
  const settlement = snapshot?.settlement;
  const hasRevenue = snapshot?.hasRevenueSources ?? false;

  const availableRevenue = hasRevenue ? (settlement?.availableRevenue ?? 0) : 0;
  const readyToRelease = hasRevenue ? (settlement?.readyToRelease ?? 0) : 0;
  const waitingForApprovals = settlement?.waitingForApprovals ?? 0;

  const totalAgreements = portfolio?.totalAgreements ?? 0;
  const needsAttentionCount =
    (portfolio?.byCategory.attention_required ?? 0) +
    (portfolio?.byCategory.at_risk ?? 0) +
    (portfolio?.byCategory.critical ?? 0);
  const readyCount =
    (portfolio?.byCategory.excellent ?? 0) + (portfolio?.byCategory.healthy ?? 0);

  const totalParticipants = kpis?.participantCount ?? 0;
  const approved = kpis?.approvedAgreementCount ?? 0;
  const awaitingApproval = Math.max(0, totalParticipants - approved);
  const payoutReady = kpis?.payoutReadyCount ?? 0;

  const critical = attentionItems.filter((i) => i.severity === 'CRITICAL').length;
  const medium = attentionItems.filter((i) => i.severity === 'ACTION_REQUIRED').length;

  const groups: FlowGroup[] = [
    {
      heading: 'Revenue',
      metrics: [
        {
          label: 'Available',
          value: fmt(availableRevenue, currency),
          tone: availableRevenue > 0 ? 'positive' : 'muted',
        },
        {
          label: 'Ready to release',
          value: fmt(readyToRelease, currency),
          tone: readyToRelease > 0 ? 'default' : 'muted',
        },
        {
          label: 'Obligations',
          value: fmt(waitingForApprovals, currency),
          tone: waitingForApprovals > 0 ? 'default' : 'muted',
        },
      ],
    },
    {
      heading: 'Agreements',
      metrics: [
        { label: 'Active', value: num(totalAgreements), tone: 'default' },
        {
          label: 'Needs attention',
          value: needsAttentionCount > 0 ? String(needsAttentionCount) : '—',
          tone: needsAttentionCount > 0 ? 'urgent' : 'muted',
        },
        { label: 'Ready', value: num(readyCount), tone: readyCount > 0 ? 'positive' : 'muted' },
      ],
    },
    {
      heading: 'Participants',
      metrics: [
        {
          label: 'Awaiting approval',
          value: num(awaitingApproval),
          tone: awaitingApproval > 0 ? 'urgent' : 'muted',
        },
        { label: 'Payout-ready', value: num(payoutReady), tone: payoutReady > 0 ? 'positive' : 'muted' },
      ],
    },
    {
      heading: 'Actions',
      metrics: [
        { label: 'Critical', value: critical > 0 ? String(critical) : '—', tone: critical > 0 ? 'urgent' : 'muted' },
        { label: 'Medium', value: medium > 0 ? String(medium) : '—', tone: medium > 0 ? 'default' : 'muted' },
      ],
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {groups.map((group) => (
        <FlowGroupCard key={group.heading} group={group} />
      ))}
    </div>
  );
}

function FlowGroupCard({ group }: { group: FlowGroup }) {
  return (
    <div className="rounded-xl border border-border/60 bg-white/70 px-4 py-4 space-y-3">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/80">
        {group.heading}
      </p>
      <div className="space-y-2">
        {group.metrics.map((m) => (
          <div key={m.label} className="flex items-baseline justify-between gap-2">
            <span className="text-xs text-muted-foreground truncate">{m.label}</span>
            <span
              className={cn(
                'text-sm font-semibold tabular-nums shrink-0',
                m.tone === 'positive' && 'text-[rgb(29,111,66)]',
                m.tone === 'urgent' && 'text-amber-700',
                m.tone === 'default' && 'text-foreground',
                m.tone === 'muted' && 'text-muted-foreground font-normal'
              )}
            >
              {m.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
