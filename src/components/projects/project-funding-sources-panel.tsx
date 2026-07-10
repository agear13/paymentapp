'use client';

import * as React from 'react';
import Link from 'next/link';
import { Loader2, Trash2 } from 'lucide-react';
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
import { AddFundingSourceDialog } from '@/components/projects/add-funding-source-dialog';
import { ProjectTreasuryMetrics } from '@/components/projects/project-treasury-metrics';
import {
  formatFundingSourceStatus,
  formatTreasuryAmount,
} from '@/lib/projects/funding-sources/format-funding-source';
import type { ProjectFundingSourceDto, ProjectTreasurySummary } from '@/lib/projects/funding-sources/types';
import {
  applyOperationalSyncRefresh,
  parseOperationalSync,
  type OperationalSyncHandlers,
} from '@/lib/operations/orchestration/operational-sync-client';
import { appendOperationalAuditEntry } from '@/hooks/use-operational-audit-store';
import type { OperationalAuditEntry } from '@/lib/operations/audit/operational-audit';
import { toast } from 'sonner';
import { createInvoiceHref } from '@/lib/navigation/payment-routes';

type ProjectFundingSourcesPanelProps = {
  projectId: string;
  defaultCurrency?: string;
  onTreasuryChange?: () => void;
  operationalSyncHandlers?: OperationalSyncHandlers;
  /** When true, hides CRUD actions — operational read-only view. */
  readOnly?: boolean;
};

export function ProjectFundingSourcesPanel({
  projectId,
  defaultCurrency = 'USD',
  onTreasuryChange,
  operationalSyncHandlers,
  readOnly = false,
}: ProjectFundingSourcesPanelProps) {
  const [sources, setSources] = React.useState<ProjectFundingSourceDto[]>([]);
  const [treasury, setTreasury] = React.useState<ProjectTreasurySummary | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [srcRes, treRes] = await Promise.all([
        fetch(`/api/projects/${encodeURIComponent(projectId)}/funding-sources`, {
          credentials: 'include',
          cache: 'no-store',
        }),
        fetch(`/api/projects/${encodeURIComponent(projectId)}/treasury-summary`, {
          credentials: 'include',
          cache: 'no-store',
        }),
      ]);
      if (srcRes.ok) {
        const json = (await srcRes.json()) as { data: ProjectFundingSourceDto[] };
        setSources(Array.isArray(json.data) ? json.data : []);
      } else {
        setSources([]);
      }
      if (treRes.ok) {
        const json = (await treRes.json()) as { data: ProjectTreasurySummary };
        setTreasury(json.data ?? null);
      } else {
        setTreasury(null);
      }
    } catch {
      setSources([]);
      setTreasury(null);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const handleCreated = () => {
    void load();
    onTreasuryChange?.();
  };

  const handleDelete = async (sourceId: string) => {
    setDeletingId(sourceId);
    try {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/funding-sources/${encodeURIComponent(sourceId)}`,
        { method: 'DELETE', credentials: 'include' }
      );
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        fundingSourceAudit?: OperationalAuditEntry;
        operationalSync?: unknown;
      };
      if (!res.ok) {
        toast.error(json.error ?? 'Failed to remove funding source');
        return;
      }
      if (json.fundingSourceAudit) {
        appendOperationalAuditEntry(json.fundingSourceAudit);
      }
      if (operationalSyncHandlers) {
        const sync = parseOperationalSync(json);
        await applyOperationalSyncRefresh(operationalSyncHandlers, sync, {
          mutation: 'funding_source_crud',
          projectId,
          surface: 'project-funding-sources-panel',
        });
      }
      await load();
      onTreasuryChange?.();
    } finally {
      setDeletingId(null);
    }
  };

  const currency = treasury?.currency ?? defaultCurrency;

  return (
    <div className="space-y-6">
      {treasury ? <ProjectTreasuryMetrics treasury={treasury} /> : null}

      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-lg">Funding sources</CardTitle>
            <CardDescription>
              Coordinate obligations before revenue fully settles. Track expected inflows and payout
              readiness across projects.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            {!readOnly && (
              <>
                <Button size="sm" onClick={() => setDialogOpen(true)}>
                  Add funding source
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <Link href={createInvoiceHref(projectId)}>Link invoice</Link>
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <Link href={createInvoiceHref(projectId)}>Create payment request</Link>
                </Button>
              </>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Loading funding sources…
            </div>
          ) : sources.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground space-y-2">
              <p className="font-medium text-foreground">No funding sources connected yet</p>
              <p>
                Add invoices, payment links, sponsorships, ticketing revenue, or manual forecasts.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-1">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Source</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    {!readOnly && <TableHead className="w-10" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sources.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{formatFundingSourceStatus(s.status)}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatTreasuryAmount(s.amount, s.currency)}
                      </TableCell>
                      {!readOnly && (
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            disabled={deletingId === s.id}
                            onClick={() => void handleDelete(s.id)}
                            aria-label={`Remove ${s.name}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {!readOnly && (
        <AddFundingSourceDialog
          projectId={projectId}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          defaultCurrency={currency}
          onCreated={handleCreated}
          operationalSyncHandlers={operationalSyncHandlers}
        />
      )}
    </div>
  );
}
