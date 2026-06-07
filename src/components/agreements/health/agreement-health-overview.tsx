'use client';

import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import type { AgreementHealthPortfolioSummary } from '@/lib/agreements/health/agreement-health.types';
import { IntelligenceBadge } from '@/components/provvypay/intelligence-badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { projectOverviewPath } from '@/lib/projects/project-routes';

type AgreementHealthOverviewProps = {
  portfolio: AgreementHealthPortfolioSummary | null;
  loading?: boolean;
  compact?: boolean;
};

const categoryColors: Record<keyof AgreementHealthPortfolioSummary['byCategory'], string> = {
  excellent: 'text-[rgb(29,111,66)]',
  healthy: 'text-emerald-700',
  attention_required: 'text-amber-700',
  at_risk: 'text-orange-700',
  critical: 'text-red-700',
};

export function AgreementHealthOverview({
  portfolio,
  loading,
  compact = false,
}: AgreementHealthOverviewProps) {
  if (loading) {
    return (
      <Card className="surface-intelligence border-0">
        <CardContent className="py-8 flex items-center justify-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          Calculating agreement health…
        </CardContent>
      </Card>
    );
  }

  if (!portfolio || portfolio.totalAgreements === 0) {
    return null;
  }

  const attentionCount =
    portfolio.byCategory.attention_required +
    portfolio.byCategory.at_risk +
    portfolio.byCategory.critical;

  return (
    <Card className="surface-intelligence border-0">
      <CardHeader className={compact ? 'pb-3' : undefined}>
        <div className="flex flex-wrap items-center gap-2">
          <IntelligenceBadge />
          <CardTitle className={compact ? 'text-lg' : 'text-xl'}>Agreement health overview</CardTitle>
        </div>
        <CardDescription>
          {portfolio.totalAgreements} agreement{portfolio.totalAgreements === 1 ? '' : 's'} · Average
          health {portfolio.averageScore}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Total agreements" value={String(portfolio.totalAgreements)} />
          <StatTile
            label="Healthy"
            value={String(portfolio.byCategory.excellent + portfolio.byCategory.healthy)}
            tone="positive"
          />
          <StatTile label="Attention required" value={String(attentionCount)} tone="attention" />
          <StatTile label="Average health" value={String(portfolio.averageScore)} highlight />
        </div>

        {!compact ? (
          <div className="grid gap-2 sm:grid-cols-5 text-sm">
            {(Object.keys(portfolio.byCategory) as (keyof typeof portfolio.byCategory)[]).map((key) => (
              <div
                key={key}
                className="rounded-lg border border-[rgba(124,92,255,0.1)] bg-white/70 px-3 py-2"
              >
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  {portfolio.categoryLabels[key]}
                </p>
                <p className={cn('text-lg font-semibold mt-1', categoryColors[key])}>
                  {portfolio.byCategory[key]}
                </p>
              </div>
            ))}
          </div>
        ) : null}

        {attentionCount > 0 ? (
          <div className="rounded-lg border border-amber-500/25 bg-amber-50/50 px-4 py-3">
            <p className="text-sm font-medium text-amber-900">
              {attentionCount} agreement{attentionCount === 1 ? '' : 's'} need attention
            </p>
            <ul className="mt-2 space-y-1">
              {portfolio.snapshots
                .filter((s) => s.category === 'attention_required' || s.category === 'at_risk' || s.category === 'critical')
                .slice(0, 3)
                .map((s) => (
                  <li key={s.projectId}>
                    <Link
                      href={`${projectOverviewPath(s.projectId)}#briefing-health`}
                      className="text-sm text-amber-900/90 hover:underline"
                    >
                      {s.agreementName} · {s.score} ({s.categoryLabel})
                    </Link>
                  </li>
                ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function StatTile({
  label,
  value,
  tone,
  highlight,
}: {
  label: string;
  value: string;
  tone?: 'positive' | 'attention';
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-xl border px-4 py-3',
        highlight && 'border-[rgba(124,92,255,0.2)] bg-[rgba(124,92,255,0.05)]',
        tone === 'positive' && 'border-[rgba(29,111,66,0.15)] bg-[rgba(223,247,232,0.35)]',
        tone === 'attention' && 'border-amber-500/20 bg-amber-50/40',
        !tone && !highlight && 'border-border/60 bg-white/60'
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold mt-1">{value}</p>
    </div>
  );
}
