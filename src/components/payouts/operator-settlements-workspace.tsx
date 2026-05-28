'use client';

import * as React from 'react';
import Link from 'next/link';
import { Plus, RefreshCw, Download, ChevronRight } from 'lucide-react';
import { useOrganization } from '@/hooks/use-organization';
import { useOrganizationCurrency } from '@/hooks/use-organization-currency';
import { formatPayoutCurrency } from '@/lib/payouts/format-payout-currency';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { PAYOUTS_SETTLEMENTS_HREF } from '@/lib/navigation/operator-nav';
import { PAYOUT_TRUST_COPY } from '@/lib/payouts/payout-trust-copy';
import { PayoutEmptyState } from '@/components/payouts/payout-empty-state';
import { OperationalActivitySection } from '@/components/operations/operational-activity-section';
import {
  applyGlobalOperationalSync,
  useGlobalOperationalSyncHandlers,
} from '@/hooks/use-global-operational-sync';
import { cn } from '@/lib/utils';
import type { OperationalCapabilities } from '@/lib/operations/capabilities/derive-operational-capabilities';
import { useWorkspaceActivation } from '@/hooks/use-workspace-activation';
import { OperationalSettlementInitialization } from '@/components/operations/operational-settlement-initialization';
import { useOperationalCoordinationState } from '@/hooks/use-operational-coordination-state';
import { ReleaseInteractionNotice } from '@/components/payouts/release-interaction-notice';

interface Batch {
  id: string;
  currency: string;
  status: string;
  payoutCount: number;
  totalAmount: number;
  createdAt: string;
}

const SUPPORTED_CURRENCIES = ['AUD', 'USD', 'EUR', 'GBP'] as const;

type OperatorSettlementsWorkspaceProps = {
  releaseCapabilities?: OperationalCapabilities;
};

export function OperatorSettlementsWorkspace({
  releaseCapabilities,
}: OperatorSettlementsWorkspaceProps) {
  const { organizationId, isLoading: isOrgLoading } = useOrganization();
  const {
    operationalOnboarding,
    operationalInitialization,
    loading: activationLoading,
    settlementInitialization,
    releaseInteraction,
    guidance,
    graphSnapshotConverged,
    kpis,
  } = useOperationalCoordinationState({
    releaseCapabilities,
    traceSurface: 'operator-settlements-workspace',
  });
  const { currency: orgCurrency } = useOrganizationCurrency();
  const syncHandlers = useGlobalOperationalSyncHandlers();
  const [batches, setBatches] = React.useState<Batch[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [createLoading, setCreateLoading] = React.useState(false);
  const [createCurrency, setCreateCurrency] = React.useState(orgCurrency);
  const [createThreshold, setCreateThreshold] = React.useState('50');
  const [eligiblePreview, setEligiblePreview] = React.useState<{
    lineCount: number;
    participantCount: number;
    total: number;
    loading: boolean;
  }>({ lineCount: 0, participantCount: 0, total: 0, loading: false });

  React.useEffect(() => {
    setCreateCurrency(orgCurrency);
  }, [orgCurrency]);

  const batchDetailHref = (id: string) => `${PAYOUTS_SETTLEMENTS_HREF}/${id}`;

  const fetchBatches = React.useCallback(async () => {
    if (!organizationId || !releaseInteraction.canQueryReleaseHistory) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/payout-batches?organizationId=${organizationId}`);
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 403) return;
        throw new Error(data.error || 'Failed to fetch');
      }
      setBatches(data.data || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load payout releases');
    } finally {
      setLoading(false);
    }
  }, [organizationId, releaseInteraction.canQueryReleaseHistory]);

  React.useEffect(() => {
    if (!releaseInteraction.canQueryReleaseHistory) {
      setBatches([]);
      setLoading(false);
      return;
    }
    void fetchBatches();
  }, [fetchBatches, releaseInteraction.canQueryReleaseHistory]);

  React.useEffect(() => {
    if (!createOpen || !releaseInteraction.canPreviewReleaseEligibility) return;
    let cancelled = false;
    const threshold = parseFloat(createThreshold);
    const minThreshold = Number.isFinite(threshold) && threshold >= 0 ? threshold : 0;

    void (async () => {
      setEligiblePreview((p) => ({ ...p, loading: true }));
      try {
        const qs = new URLSearchParams({
          currency: createCurrency,
          minThreshold: String(minThreshold),
        });
        const res = await fetch(`/api/operations/release-batch-eligibility?${qs}`, {
          credentials: 'include',
        });
        if (!res.ok) return;
        const json = (await res.json()) as {
          data?: { lineCount: number; participantCount: number; total: number };
        };
        const preview = json.data;
        if (!cancelled && preview) {
          setEligiblePreview({
            lineCount: preview.lineCount,
            participantCount: preview.participantCount,
            total: preview.total,
            loading: false,
          });
        }
      } catch {
        if (!cancelled) {
          setEligiblePreview({ lineCount: 0, participantCount: 0, total: 0, loading: false });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [createOpen, createCurrency, createThreshold, releaseInteraction.canPreviewReleaseEligibility]);

  const capabilities = {
    canCreateReleaseBatch: releaseInteraction.canCreateReleaseBatch,
    canSubmitRelease: releaseInteraction.canSubmitRelease,
    canUseBetaSettlementFeatures: releaseInteraction.releaseInteractionEnabled,
    disabledReason: releaseInteraction.disabledReason,
  };

  const handleCreateBatch = async () => {
    if (!organizationId || !releaseInteraction.releaseInteractionEnabled) return;
    if (!capabilities.canCreateReleaseBatch) return;
    const threshold = parseFloat(createThreshold);
    if (isNaN(threshold) || threshold < 0) {
      toast.error('Enter a valid minimum threshold');
      return;
    }
    if (eligiblePreview.participantCount === 0 && !eligiblePreview.loading) {
      toast.error('No eligible payouts available for this currency and threshold');
      return;
    }
    setCreateLoading(true);
    try {
      const res = await fetch('/api/payout-batches/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId,
          currency: createCurrency,
          minThreshold: threshold,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || 'Failed to create batch');
      void applyGlobalOperationalSync(syncHandlers, data, {
        mutation: 'other',
        surface: 'operator-settlements-workspace',
      });
      toast.success('Release batch created');
      setCreateOpen(false);
      void fetchBatches();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create batch');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleExport = (batchId: string) => {
    if (!organizationId || !releaseInteraction.canQueryReleaseHistory) return;
    window.open(`/api/payout-batches/${batchId}/export`, '_blank', 'noopener');
  };

  const pageHeader = (
    <>
      <h1 className="text-3xl font-bold tracking-tight">Payout releases</h1>
      <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
        Review completed payout releases and participant payouts.
      </p>
      <p className="text-xs text-muted-foreground/60 mt-2">{PAYOUT_TRUST_COPY.releaseReviewable}</p>
    </>
  );

  if (isOrgLoading) {
    return (
      <div className="space-y-6">
        {pageHeader}
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!organizationId) {
    return (
      <div className="space-y-6">
        {pageHeader}
        <p className="text-muted-foreground">No organization selected.</p>
      </div>
    );
  }

  const showInitializationShell =
    settlementInitialization.showInitializationShell &&
    (kpis?.participantCount ?? 0) === 0 &&
    (kpis?.earningsConfiguredCount ?? 0) === 0 &&
    (kpis?.obligationCount ?? 0) === 0;

  if (showInitializationShell) {
    return (
      <div className="space-y-6">
        {pageHeader}
        <OperationalSettlementInitialization
          onboarding={operationalOnboarding}
          initialization={operationalInitialization}
          loading={activationLoading}
          graphSnapshotConverged={graphSnapshotConverged}
          nextActions={guidance.actions}
          participantCount={kpis?.participantCount}
          earningsConfiguredCount={kpis?.earningsConfiguredCount}
          obligationCount={kpis?.obligationCount}
        >
          {null}
        </OperationalSettlementInitialization>
      </div>
    );
  }

  const previewAmountLabel = formatPayoutCurrency(
    eligiblePreview.total,
    createCurrency,
    orgCurrency
  );
  const noEligible =
    !eligiblePreview.loading && createOpen && eligiblePreview.participantCount === 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>{pageHeader}</div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span tabIndex={releaseInteraction.canQueryReleaseHistory ? undefined : 0}>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => void fetchBatches()}
                    disabled={loading || !releaseInteraction.canQueryReleaseHistory}
                    aria-label="Refresh payout releases"
                  >
                    <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                {releaseInteraction.canQueryReleaseHistory
                  ? 'Refresh payout releases'
                  : (releaseInteraction.interactionGuidance ?? 'Release refresh unavailable')}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Dialog
            open={createOpen}
            onOpenChange={(open) => {
              if (open && !releaseInteraction.canCreateReleaseBatch) return;
              setCreateOpen(open);
            }}
          >
            {capabilities.canCreateReleaseBatch ? (
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Create release batch
                </Button>
              </DialogTrigger>
            ) : (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span tabIndex={0}>
                      <Button disabled>
                        <Plus className="mr-2 h-4 w-4" />
                        Create release batch
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>{capabilities.disabledReason}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto gap-0">
              <DialogHeader className="space-y-1 pb-4">
                <DialogTitle>Create release batch</DialogTitle>
                <DialogDescription className="text-sm">
                  Group eligible participant payouts for review before release.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-5 py-1">
                <div className="space-y-3 text-sm">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Release summary
                  </p>
                  {eligiblePreview.loading ? (
                    <p className="text-muted-foreground">Calculating…</p>
                  ) : (
                    <dl className="space-y-2.5">
                      <div className="flex justify-between gap-4">
                        <dt className="text-muted-foreground">Participants</dt>
                        <dd className="font-semibold tabular-nums">
                          {eligiblePreview.participantCount}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="text-muted-foreground">Eligible payouts</dt>
                        <dd className="font-semibold tabular-nums">{eligiblePreview.lineCount}</dd>
                      </div>
                      <div className="flex justify-between gap-4 border-t border-border/20 pt-2.5">
                        <dt className="text-muted-foreground">Total release amount</dt>
                        <dd className="text-base font-semibold tabular-nums">{previewAmountLabel}</dd>
                      </div>
                    </dl>
                  )}
                </div>
                <p className="text-xs text-muted-foreground/80 leading-relaxed">
                  {PAYOUT_TRUST_COPY.releaseReviewable}
                </p>
                {noEligible ? (
                  <PayoutEmptyState
                    iconVariant="release"
                    title="No eligible payouts available"
                    description="Adjust currency or threshold, or approve and fund obligations first."
                  />
                ) : null}
                <div>
                  <Label htmlFor="currency">Currency</Label>
                  <Select value={createCurrency} onValueChange={setCreateCurrency}>
                    <SelectTrigger id="currency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SUPPORTED_CURRENCIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="threshold">Minimum threshold</Label>
                  <Input
                    id="threshold"
                    type="number"
                    min="0"
                    step="1"
                    value={createThreshold}
                    onChange={(e) => setCreateThreshold(e.target.value)}
                    placeholder="50"
                  />
                  <p className="text-muted-foreground mt-1 text-xs">
                    Only include participants owed at least this amount.
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => void handleCreateBatch()}
                  disabled={
                    createLoading ||
                    noEligible ||
                    eligiblePreview.loading ||
                    !capabilities.canCreateReleaseBatch
                  }
                >
                  {createLoading ? 'Creating…' : 'Create release batch'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {!releaseInteraction.releaseInteractionEnabled ? (
        <ReleaseInteractionNotice state={releaseInteraction} />
      ) : null}

      <div className="space-y-3">
        <div>
          <h2 className="text-base font-semibold">Release history</h2>
          <p className="text-muted-foreground text-sm mt-0.5">
            Completed release batches and payout status. Technical references are in batch details.
          </p>
        </div>
        <div>
          {loading ? (
            <p className="text-muted-foreground py-8 text-center text-sm">Loading…</p>
          ) : batches.length === 0 ? (
            <PayoutEmptyState
              iconVariant="history"
              title="No payout releases yet"
              description={
                releaseInteraction.releaseInteractionEnabled
                  ? 'Release batches will appear here once obligations are approved and funded.'
                  : (releaseInteraction.interactionGuidance ??
                    'Release history will appear here once release actions are available.')
              }
              action={
                capabilities.canCreateReleaseBatch ? (
                  <Button size="sm" onClick={() => setCreateOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create release batch
                  </Button>
                ) : (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span tabIndex={0}>
                          <Button size="sm" disabled>
                            <Plus className="mr-2 h-4 w-4" />
                            Create release batch
                          </Button>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        {capabilities.disabledReason ?? 'Release actions unavailable'}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-b border-border/20">
                  <TableHead>Release batch</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Participants</TableHead>
                  <TableHead className="text-right">Total amount</TableHead>
                  <TableHead>Release status</TableHead>
                  <TableHead className="text-right w-[88px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.map((b) => (
                  <TableRow
                    key={b.id}
                    className={cn(
                      'border-b border-border/15 transition-colors hover:bg-muted/15 [&>td]:py-4'
                    )}
                  >
                    <TableCell className="font-mono text-xs">{b.id.slice(0, 8)}</TableCell>
                    <TableCell className="text-sm">
                      {new Date(b.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{b.payoutCount}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {formatPayoutCurrency(b.totalAmount, b.currency, orgCurrency)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          b.status === 'COMPLETED'
                            ? 'default'
                            : b.status === 'SUBMITTED'
                              ? 'secondary'
                              : 'outline'
                        }
                        className="text-[11px] font-normal"
                      >
                        {b.status === 'COMPLETED'
                          ? 'Completed'
                          : b.status === 'SUBMITTED'
                            ? 'Submitted'
                            : b.status.replace(/_/g, ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleExport(b.id)}
                          disabled={!releaseInteraction.canQueryReleaseHistory}
                          aria-label="Export release batch"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                          <Link href={batchDetailHref(b.id)} aria-label="View release batch">
                            <ChevronRight className="h-4 w-4" />
                          </Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      <OperationalActivitySection
        title="Release activity"
        emptyMessage="Batch creation, funding, and release events appear here."
        defaultOpen={false}
      />
    </div>
  );
}
