'use client';

import * as React from 'react';
import Link from 'next/link';
import { Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useProjectWorkspace } from '@/components/projects/project-workspace-provider';
import { ProjectTreasuryMetrics } from '@/components/projects/project-treasury-metrics';
import { PAYOUTS_OBLIGATIONS_HREF } from '@/lib/navigation/operator-nav';
import {
  formatOperationalReadiness,
  operationalReadinessBadgeVariant,
} from '@/lib/projects/funding-sources/obligation-readiness';
import type { ProjectTreasurySummary } from '@/lib/projects/funding-sources/types';

type ObligationRow = {
  id: string;
  deal_id: string;
  participant_id: string | null;
  obligation_type: string;
  amount_owed: unknown;
  currency: string;
  status: string;
  participant: { name: string; role: string } | null;
};

function formatMoney(amount: unknown, currency: string): string {
  const n = typeof amount === 'number' ? amount : Number(amount);
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
    maximumFractionDigits: 2,
  }).format(n);
}

export function ProjectObligationsView() {
  const { deal, summary, projectId } = useProjectWorkspace();
  const [rows, setRows] = React.useState<ObligationRow[]>([]);
  const [treasury, setTreasury] = React.useState<ProjectTreasurySummary | null>(null);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    if (!deal) return;
    setLoading(true);
    try {
      const [oblRes, treRes] = await Promise.all([
        fetch(`/api/deal-network-pilot/obligations?dealId=${encodeURIComponent(deal.id)}`, {
          credentials: 'include',
          cache: 'no-store',
        }),
        fetch(`/api/projects/${encodeURIComponent(projectId)}/treasury-summary`, {
          credentials: 'include',
          cache: 'no-store',
        }),
      ]);
      if (oblRes.ok) {
        const json = (await oblRes.json()) as { data: ObligationRow[] };
        setRows(Array.isArray(json.data) ? json.data.filter((r) => r.deal_id === deal.id) : []);
      } else {
        setRows([]);
      }
      if (treRes.ok) {
        const json = (await treRes.json()) as { data: ProjectTreasurySummary };
        setTreasury(json.data ?? null);
      }
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [deal, projectId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  if (!deal || !summary) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{summary.name}</h1>
          <p className="text-muted-foreground mt-1 text-sm max-w-2xl">
            Allocation defines what should be paid. Funding sources define whether it can be paid
            yet. Obligations exist before revenue settles.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={PAYOUTS_OBLIGATIONS_HREF}>All obligations</Link>
          </Button>
        </div>
      </div>

      {treasury ? <ProjectTreasuryMetrics treasury={treasury} compact /> : null}

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle>Project obligations</CardTitle>
              <CardDescription>
                Operational allocation. Payout readiness follows funding sources and settlement
                state.
              </CardDescription>
            </div>
            {treasury ? (
              <Badge variant={operationalReadinessBadgeVariant(treasury.operationalReadiness)}>
                {formatOperationalReadiness(treasury.operationalReadiness)}
              </Badge>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Loading obligations…
            </div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6">
              No obligations recorded for this project yet. They appear when participants are
              allocated. Funding sources affect payout readiness, not whether obligations exist.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Participant</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Allocation status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.participant?.name ?? '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{r.obligation_type}</TableCell>
                    <TableCell>{formatMoney(r.amount_owed, r.currency)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{r.status.replace(/_/g, ' ')}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
