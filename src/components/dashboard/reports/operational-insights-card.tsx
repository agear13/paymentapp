'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type {
  OperationalInsight,
  OperationalInsightSeverity,
} from '@/lib/reports/operational-insights';
import { cn } from '@/lib/utils';

interface OperationalInsightsSnapshot {
  insights: OperationalInsight[];
  generatedAt: string;
}

interface OperationalInsightsCardProps {
  organizationId: string;
}

const SEVERITY_STYLES: Record<
  OperationalInsightSeverity,
  { row: string; icon: string; Icon: LucideIcon }
> = {
  success: {
    row: 'border-emerald-200/80 bg-emerald-50/60',
    icon: 'text-emerald-700',
    Icon: CheckCircle2,
  },
  warning: {
    row: 'border-amber-200/80 bg-amber-50/60',
    icon: 'text-amber-700',
    Icon: AlertTriangle,
  },
  error: {
    row: 'border-red-200/80 bg-red-50/60',
    icon: 'text-red-700',
    Icon: AlertCircle,
  },
  info: {
    row: 'border-border/80 bg-muted/40',
    icon: 'text-muted-foreground',
    Icon: Info,
  },
};

function InsightRow({ insight }: { insight: OperationalInsight }) {
  const { row, icon, Icon } = SEVERITY_STYLES[insight.severity];

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-lg border px-3 py-2.5 text-sm',
        row
      )}
    >
      <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', icon)} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-medium leading-snug text-foreground">{insight.message}</p>
        {insight.metadata ? (
          <p className="mt-0.5 text-xs text-muted-foreground">{insight.metadata}</p>
        ) : null}
      </div>
    </div>
  );
}

export function OperationalInsightsCard({ organizationId }: OperationalInsightsCardProps) {
  const [loading, setLoading] = useState(true);
  const [snapshot, setSnapshot] = useState<OperationalInsightsSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetchInsights();
  }, [organizationId]);

  const fetchInsights = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(
        `/api/reports/operational-insights?organizationId=${organizationId}`
      );
      if (!response.ok) throw new Error('Failed to fetch operational insights');

      const data = (await response.json()) as OperationalInsightsSnapshot;
      setSnapshot(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load insights');
      setSnapshot(null);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Operational Insights</CardTitle>
          <CardDescription>Loading operational states…</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error || !snapshot) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Operational Insights</CardTitle>
          <CardDescription>
            System-detected operational states requiring review or monitoring.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-amber-200/80 bg-amber-50/60 px-3 py-2.5 text-sm text-amber-900">
            {error ?? 'Operational insights are unavailable.'}
          </div>
        </CardContent>
      </Card>
    );
  }

  const insights = snapshot.insights;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Operational Insights</CardTitle>
        <CardDescription>
          System-detected operational states requiring review or monitoring.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {insights.length === 0 ? (
          <div className="rounded-lg border border-border/80 bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground">
            No operational states detected for this workspace.
          </div>
        ) : (
          insights.map((insight) => <InsightRow key={insight.id} insight={insight} />)
        )}
        <p className="pt-1 text-xs text-muted-foreground text-right">
          Updated {new Date(snapshot.generatedAt).toLocaleString()}
        </p>
      </CardContent>
    </Card>
  );
}
