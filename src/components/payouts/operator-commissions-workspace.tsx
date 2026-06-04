'use client';

import * as React from 'react';
import Link from 'next/link';
import { RefreshCw } from 'lucide-react';
import { useOrganization } from '@/hooks/use-organization';
import { useOrganizationCurrency } from '@/hooks/use-organization-currency';
import { formatPayoutCurrency } from '@/lib/payouts/format-payout-currency';
import { PAYOUT_TRUST_COPY } from '@/lib/payouts/payout-trust-copy';
import { Button } from '@/components/ui/button';
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { toast } from 'sonner';
import {
  PAYOUTS_OBLIGATIONS_HREF,
  PAYOUTS_SETTLEMENTS_HREF,
} from '@/lib/navigation/operator-nav';
import {
  groupParticipantEarningsByBucket,
  PARTICIPANT_EARNINGS_BUCKET_META,
  type ParticipantEarningsBucket,
  type ParticipantEarningsRowInput,
} from '@/lib/operations/selectors/derive-participant-earnings-buckets';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import { PayoutEmptyState } from '@/components/payouts/payout-empty-state';
import { OperationalActivitySection } from '@/components/operations/operational-activity-section';
import { OperationalSettlementInitialization } from '@/components/operations/operational-settlement-initialization';
import { ReleaseInteractionNotice } from '@/components/payouts/release-interaction-notice';
import { useOperationalCoordinationState } from '@/hooks/use-operational-coordination-state';
import type { OperationalCapabilities } from '@/lib/operations/capabilities/derive-operational-capabilities';
import { shouldSuppressOperationalErrorToast } from '@/lib/operations/coordination/operational-fetch-guards';
import {
  parseOperationalApiJson,
  readOperationalApiResponseDiagnostics,
} from '@/lib/operations/dev/operational-api-fetch-diagnostics';
import type { PayoutEmptyIconVariant } from '@/components/payouts/payout-empty-state';
import { cn } from '@/lib/utils';

type PilotObligation = {
  id: string;
  deal_id: string;
  participant_id: string | null;
  amount_owed: string | number;
  currency: string;
  status: string;
  obligation_type: string;
  deal?: { id: string; name: string; partner: string | null } | null;
  participant?: {
    id: string;
    name: string;
    role: string;
    onboardingStatus?: string;
    approvalStatus?: string;
    payoutVerificationConfirmed?: boolean;
    compensationProfile?: DemoParticipant['compensationProfile'];
  } | null;
};

type OrgCommission = {
  id: string;
  paymentLinkId: string;
  referralCode: string;
  consultantAmount: number;
  bdPartnerAmount: number;
  currency: string;
  status: string;
  createdAt: string;
  shortCode?: string;
};

type AttributionEarningsSummary = {
  participantId: string;
  participantName: string;
  dealId: string | null;
  dealName: string | null;
  outstandingAmount: number;
  paidAmount: number;
  currency: string;
  items: Array<{
    id: string;
    amount: number;
    currency: string;
    status: string;
    shortCode: string | null;
  }>;
};

type SectionEmphasis = 'primary' | 'caution' | 'muted' | 'default';

type OperationalSection = {
  id: string;
  title: string;
  description: string;
  rows: PilotObligation[];
  emptyTitle: string;
  emptyDescription: string;
  emptyAction?: React.ReactNode;
  emptyIcon: PayoutEmptyIconVariant;
  emphasis: SectionEmphasis;
};

function sectionSpacing(emphasis: SectionEmphasis): string {
  switch (emphasis) {
    case 'primary':
      return 'pb-8 mb-2 border-b border-emerald-500/15';
    case 'caution':
      return 'pb-6';
    case 'muted':
      return 'pb-4 opacity-75';
    default:
      return 'pb-6';
  }
}

function OperationalSectionBlock({
  section,
  orgCurrency,
  canCreateReleaseBatch,
}: {
  section: OperationalSection;
  orgCurrency: string;
  canCreateReleaseBatch: boolean;
}) {
  const titleClass = cn(
    section.emphasis === 'primary' && 'text-xl font-semibold tracking-tight',
    section.emphasis === 'caution' && 'text-base font-semibold',
    section.emphasis === 'muted' && 'text-sm font-medium text-muted-foreground',
    section.emphasis === 'default' && 'text-base font-semibold'
  );

  return (
    <section id={section.id} className={sectionSpacing(section.emphasis)}>
      <div className="mb-3">
        <h2 className={titleClass}>
          {section.title}
          <span className="font-normal ml-2 tabular-nums text-muted-foreground">
            ({section.rows.length})
          </span>
        </h2>
        <p
          className={cn(
            'mt-0.5',
            section.emphasis === 'muted' ? 'text-xs text-muted-foreground/70' : 'text-sm text-muted-foreground'
          )}
        >
          {section.description}
        </p>
        {section.emphasis === 'primary' && section.rows.length > 0 && canCreateReleaseBatch ? (
          <Button size="sm" className="mt-3 h-8" asChild>
            <Link href={PAYOUTS_SETTLEMENTS_HREF}>Create release batch</Link>
          </Button>
        ) : null}
      </div>
      {section.rows.length === 0 ? (
        <PayoutEmptyState
          iconVariant={section.emptyIcon}
          title={section.emptyTitle}
          description={section.emptyDescription}
          action={section.emptyAction}
        />
      ) : (
        <ul className="divide-y divide-border/20">
          {section.rows.slice(0, 12).map((row) => (
            <li
              key={row.id}
              className="flex items-center justify-between gap-4 py-3 text-sm transition-colors hover:bg-muted/15 -mx-2 px-2 rounded-md"
            >
              <div className="min-w-0">
                <p className="font-medium truncate">
                  {row.participant?.name ?? row.deal?.name ?? '—'}
                </p>
                <p className="text-muted-foreground/80 text-xs truncate">
                  {row.deal?.name ?? row.deal_id}
                </p>
              </div>
              <span className="shrink-0 tabular-nums font-semibold">
                {formatPayoutCurrency(
                  typeof row.amount_owed === 'string'
                    ? parseFloat(row.amount_owed)
                    : row.amount_owed,
                  row.currency,
                  orgCurrency
                )}
              </span>
            </li>
          ))}
          {section.rows.length > 12 ? (
            <li className="py-2 text-xs text-muted-foreground">
              +{section.rows.length - 12} more —{' '}
              <Link
                href={PAYOUTS_OBLIGATIONS_HREF}
                className="text-primary underline-offset-2 hover:underline"
              >
                View in Obligations
              </Link>
            </li>
          ) : null}
        </ul>
      )}
    </section>
  );
}

type OperatorCommissionsWorkspaceProps = {
  releaseCapabilities: OperationalCapabilities;
  isBetaAdmin: boolean;
};

export function OperatorCommissionsWorkspace({
  releaseCapabilities,
  isBetaAdmin,
}: OperatorCommissionsWorkspaceProps) {
  const { organizationId, isLoading: isOrgLoading } = useOrganization();
  const { currency: orgCurrency } = useOrganizationCurrency();
  const {
    releaseInteraction,
    settlementInitialization,
    operationalOnboarding,
    operationalInitialization,
    loading: activationLoading,
    guidance,
    graphSnapshotConverged,
    kpis,
  } = useOperationalCoordinationState({
    releaseCapabilities,
    traceSurface: 'operator-commissions-workspace',
  });

  React.useEffect(() => {
    console.info('[ATTRIBUTION_COMMISSIONS]', {
      isBetaAdmin,
      canUseBetaSettlementFeatures: releaseCapabilities.canUseBetaSettlementFeatures,
      canQueryReferralCommissionLedger: releaseInteraction.canQueryReferralCommissionLedger,
      surface: 'OperatorCommissionsWorkspace(client)',
    });
  }, [
    isBetaAdmin,
    releaseCapabilities.canUseBetaSettlementFeatures,
    releaseInteraction.canQueryReferralCommissionLedger,
  ]);
  const [pilotRows, setPilotRows] = React.useState<PilotObligation[]>([]);
  const [attributionEarnings, setAttributionEarnings] = React.useState<AttributionEarningsSummary[]>(
    []
  );
  const [orgPosted, setOrgPosted] = React.useState<OrgCommission[]>([]);
  const [loading, setLoading] = React.useState(true);

  const showInitializationShell =
    settlementInitialization.showInitializationShell &&
    (kpis?.participantCount ?? 0) === 0 &&
    (kpis?.earningsConfiguredCount ?? 0) === 0 &&
    (kpis?.obligationCount ?? 0) === 0;

  const fetchAll = React.useCallback(async () => {
    if (showInitializationShell) {
      setPilotRows([]);
      setAttributionEarnings([]);
      setOrgPosted([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const pilotRes = await fetch('/api/deal-network-pilot/obligations', {
        credentials: 'include',
        cache: 'no-store',
      });
      const pilotDiagnostics = await readOperationalApiResponseDiagnostics(
        '/api/deal-network-pilot/obligations',
        pilotRes
      );
      if (pilotRes.status === 401) {
        throw new Error('You need to be signed in to view participant earnings.');
      }
      if (!pilotDiagnostics.shouldParseJson) {
        // Align with obligations page: gateway 502/499 must not fatal the whole workspace.
        setPilotRows([]);
      } else {
        const pilotJson = parseOperationalApiJson<{ data?: PilotObligation[]; error?: string }>(
          '/api/deal-network-pilot/obligations',
          pilotDiagnostics.bodyText
        );
        setPilotRows(pilotJson.data ?? []);
      }

      if (organizationId && releaseInteraction.canQueryReferralCommissionLedger) {
        const attrRes = await fetch('/api/commissions/attribution-earnings', {
          credentials: 'include',
          cache: 'no-store',
        });
        if (attrRes.ok) {
          const attrJson = await attrRes.json().catch(() => ({}));
          setAttributionEarnings(attrJson.data ?? []);
        } else {
          setAttributionEarnings([]);
        }

        const orgRes = await fetch(
          `/api/commissions/obligations?organizationId=${organizationId}&status=POSTED`,
          { credentials: 'include', cache: 'no-store' }
        );
        const orgDiagnostics = await readOperationalApiResponseDiagnostics(
          `/api/commissions/obligations?organizationId=${organizationId}&status=POSTED`,
          orgRes
        );
        if (!orgDiagnostics.shouldParseJson) {
          if (
            !shouldSuppressOperationalErrorToast({
              status: orgRes.status,
              message: orgDiagnostics.bodyPreview,
              releaseInteraction,
            })
          ) {
            throw new Error('Failed to load referral earnings');
          }
          setOrgPosted([]);
        } else {
          const orgJson = parseOperationalApiJson<{ data?: typeof orgPosted; error?: string }>(
            `/api/commissions/obligations?organizationId=${organizationId}&status=POSTED`,
            orgDiagnostics.bodyText
          );
          setOrgPosted(orgJson.data ?? []);
        }
      } else {
        setAttributionEarnings([]);
        setOrgPosted([]);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load participant earnings';
      if (
        !shouldSuppressOperationalErrorToast({
          message,
          releaseInteraction,
        })
      ) {
        toast.error(message);
      }
    } finally {
      setLoading(false);
    }
  }, [
    organizationId,
    releaseInteraction.canQueryReferralCommissionLedger,
    showInitializationShell,
  ]);

  React.useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const reviewObligationsBtn = (
    <Button variant="outline" size="sm" asChild>
      <Link href={PAYOUTS_OBLIGATIONS_HREF}>Review obligations</Link>
    </Button>
  );

  const refreshObligations = React.useCallback(async () => {
    try {
      const res = await fetch('/api/deal-network-pilot/obligations/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
        credentials: 'include',
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || 'Failed to refresh obligations');
      }
      toast.success('Obligation projections refreshed');
      await fetchAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Refresh failed');
    }
  }, [fetchAll]);

  const earningsRows = React.useMemo((): ParticipantEarningsRowInput[] => {
    return pilotRows.map((row) => ({
      id: row.id,
      status: row.status,
      amountOwed:
        typeof row.amount_owed === 'string' ? parseFloat(row.amount_owed) : row.amount_owed,
      participant: row.participant
        ? ({
            id: row.participant.id,
            name: row.participant.name,
            role: row.participant.role,
            approvalStatus:
              row.participant.approvalStatus === 'Approved' ? 'Approved' : 'Pending approval',
            payoutVerificationConfirmed: row.participant.payoutVerificationConfirmed === true,
            compensationProfile: row.participant.compensationProfile,
            onboardingStatus: row.participant.onboardingStatus,
          } as DemoParticipant)
        : null,
    }));
  }, [pilotRows]);

  const bucketed = React.useMemo(
    () => groupParticipantEarningsByBucket(earningsRows),
    [earningsRows]
  );

  const bucketSections: Array<{
    bucket: ParticipantEarningsBucket;
    emphasis: SectionEmphasis;
    emptyIcon: PayoutEmptyIconVariant;
  }> = [
    { bucket: 'ready_for_release', emphasis: 'primary', emptyIcon: 'release' },
    { bucket: 'awaiting_orchestration_refresh', emphasis: 'caution', emptyIcon: 'funding' },
    { bucket: 'needs_funding', emphasis: 'caution', emptyIcon: 'funding' },
    { bucket: 'awaiting_participant_approval', emphasis: 'default', emptyIcon: 'participant' },
    { bucket: 'awaiting_payout_details', emphasis: 'default', emptyIcon: 'participant' },
    { bucket: 'awaiting_participant_setup', emphasis: 'default', emptyIcon: 'participant' },
    { bucket: 'recently_released', emphasis: 'muted', emptyIcon: 'history' },
  ];

  const sections: OperationalSection[] = bucketSections.map(({ bucket, emphasis, emptyIcon }) => {
    const meta = PARTICIPANT_EARNINGS_BUCKET_META[bucket];
    const rowIds = new Set(bucketed[bucket].map((r) => r.id));
    const rows = pilotRows.filter((r) => rowIds.has(r.id));
    const refreshAction =
      bucket === 'awaiting_orchestration_refresh' ? (
        <Button variant="outline" size="sm" onClick={() => void refreshObligations()}>
          Refresh obligations
        </Button>
      ) : undefined;
    return {
      id: bucket,
      title: meta.title,
      description: meta.description,
      rows,
      emptyTitle:
        bucket === 'ready_for_release'
          ? 'No payouts ready for release'
          : bucket === 'awaiting_orchestration_refresh'
            ? 'No coordination refresh pending'
            : `No ${meta.title.toLowerCase()} right now`,
      emptyDescription:
        bucket === 'ready_for_release'
          ? 'Eligible participant payouts will appear here once funding and approvals converge.'
          : meta.description,
      emptyAction:
        bucket === 'ready_for_release'
          ? reviewObligationsBtn
          : bucket === 'awaiting_orchestration_refresh'
            ? refreshAction
            : undefined,
      emptyIcon,
      emphasis,
    };
  });

  if (isOrgLoading || activationLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Participant earnings</h1>
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  const pageHeader = (
    <>
      <h1 className="text-3xl font-bold tracking-tight">Participant earnings</h1>
      <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
        Track what participants have earned and what is ready for payout release.
      </p>
      <p className="text-xs text-muted-foreground/60 mt-2">
        {PAYOUT_TRUST_COPY.traceableAfterRelease}
      </p>
    </>
  );

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
        >
          {null}
        </OperationalSettlementInitialization>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <div className="flex items-start justify-between gap-4">
        <div>{pageHeader}</div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 shrink-0"
                onClick={() => void fetchAll()}
                disabled={loading}
                aria-label="Refresh payout data"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Refresh payout data</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {!releaseInteraction.releaseInteractionEnabled ? (
        <ReleaseInteractionNotice state={releaseInteraction} />
      ) : null}

      {loading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : (
        <div className="space-y-8">
          {releaseInteraction.canQueryReferralCommissionLedger ? (
            <section className="space-y-3 pb-6 border-b border-border/20">
              <div>
                <h2 className="text-xl font-semibold tracking-tight">Attribution commissions</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Earned per qualifying customer purchase — sourced from posted commission items,
                  not project deal value.
                </p>
              </div>
              {attributionEarnings.length === 0 ? (
                <PayoutEmptyState
                  iconVariant="earnings"
                  title="No attribution commissions yet"
                  description="Commissions appear here after customers pay through participant referral links."
                />
              ) : (
                <ul className="divide-y divide-border/20">
                  {attributionEarnings.map((row) => (
                    <li
                      key={row.participantId}
                      className="flex items-center justify-between gap-4 py-3 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="font-medium truncate">{row.participantName}</p>
                        <p className="text-muted-foreground/80 text-xs truncate">
                          {row.dealName ?? 'Attribution'} · {row.items.length} purchase
                          {row.items.length === 1 ? '' : 's'}
                        </p>
                      </div>
                      <span className="shrink-0 tabular-nums font-semibold">
                        {formatPayoutCurrency(
                          row.outstandingAmount,
                          row.currency,
                          orgCurrency
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : null}

          <div>
            <h2 className="text-xl font-semibold tracking-tight mb-1">Project obligations</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Revenue share, fixed fees, and milestones funded from project deal value.
            </p>
            <div className="space-y-2">
              {sections.map((section) => (
                <OperationalSectionBlock
                  key={section.id}
                  section={section}
                  orgCurrency={orgCurrency}
                  canCreateReleaseBatch={releaseInteraction.canCreateReleaseBatch}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      <section className="space-y-3 pt-8 mt-4 border-t border-border/20 opacity-70">
        <div>
          <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">
            Referral earnings history
          </h2>
          <p className="text-xs text-muted-foreground/60 mt-1">
            {releaseInteraction.canQueryReferralCommissionLedger
              ? 'Archive — recorded referral earnings from customer payments.'
              : 'Referral earnings history unlocks when beta payout infrastructure permits ledger access.'}
          </p>
        </div>
        {!releaseInteraction.canQueryReferralCommissionLedger ? (
          <p className="text-sm text-muted-foreground">
            {releaseInteraction.interactionGuidance ??
              'Release actions are disabled while coordination completes or beta lockdown applies.'}
          </p>
        ) : loading ? (
          <p className="text-muted-foreground text-sm">Loading…</p>
        ) : orgPosted.length === 0 ? (
          <PayoutEmptyState
            iconVariant="earnings"
            title="No referral earnings yet"
            description="Referral earnings will appear here after attributed customer payments are processed."
          />
        ) : (
          <div className="overflow-x-auto -mx-1">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-b border-border/15">
                  <TableHead className="text-xs text-muted-foreground">Date</TableHead>
                  <TableHead className="text-xs text-muted-foreground">Referral</TableHead>
                  <TableHead className="text-xs text-muted-foreground">Invoice</TableHead>
                  <TableHead className="text-right text-xs text-muted-foreground">Amount</TableHead>
                  <TableHead className="text-xs text-muted-foreground">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orgPosted.map((o) => (
                  <TableRow
                    key={o.id}
                    className="border-b border-border/10 [&>td]:py-2.5 text-muted-foreground"
                  >
                    <TableCell className="text-xs">
                      {new Date(o.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="font-mono text-[11px]">{o.referralCode}</TableCell>
                    <TableCell className="text-xs">
                      {o.shortCode ? `#${o.shortCode}` : o.paymentLinkId.slice(0, 8)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm text-foreground/80">
                      {formatPayoutCurrency(
                        o.consultantAmount + o.bdPartnerAmount,
                        o.currency,
                        orgCurrency
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] font-normal opacity-80">
                        {o.status.replace(/_/g, ' ')}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <OperationalActivitySection
        title="Participant payout activity"
        emptyMessage="Earnings configuration, obligations, and release events appear here."
        defaultOpen={false}
      />
    </div>
  );
}
