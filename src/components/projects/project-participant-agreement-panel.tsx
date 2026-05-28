'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { RecentDeal } from '@/lib/data/mock-deal-network';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import {
  COMMISSION_STRUCTURE_OPTIONS,
  resolveParticipantCommissionUsd,
  computeParticipantCommissionTotalsForDeal,
  demoParticipantToPilotRow,
} from '@/lib/deal-network-demo/commission-structure';
import { ParticipantAttributionAgreementSummary } from '@/components/projects/participant-attribution-agreement-summary';
import { ReferralSharePanel } from '@/components/referrals/referral-share-panel';
import { buildReferralQrApiPath } from '@/lib/referrals/referral-share-url';
import { operationalRoleLabel } from '@/lib/projects/participants-for-project';
import {
  formatApprovalTimestamp,
  type ScopedServiceCommissionRow,
} from '@/lib/projects/participant-compensation-copy';
import { shouldIssueAttributionForParticipant, canGenerateAttributionLink, deriveAttributionExplanation } from '@/lib/operations/truth/attribution-truth';
import {
  isAttributionActive,
  referralIssuanceFromParticipant,
} from '@/lib/projects/participant-lifecycle';
import { deriveAttributionStatus } from '@/lib/projects/participant-entitlement';
import {
  deriveCommissionScope,
  isAllActiveCatalogSource,
  isCatalogScopedCommission,
  resolveAgreementCatalogItems,
} from '@/lib/operations/derivations/commission-scope';
import { OperationalActivitySection } from '@/components/operations/operational-activity-section';
import { appendOperationalAuditEntry } from '@/hooks/use-operational-audit-store';
import {
  applyOperationalSyncRefresh,
  createPostConvergenceVerifier,
  parseOperationalSync,
} from '@/lib/operations/orchestration/operational-sync-client';
import { notifyWorkspaceActivationRefresh } from '@/hooks/use-workspace-activation';
import { useOrganizationCurrency } from '@/hooks/use-organization-currency';

function roleAmountsFromDeal(deal: RecentDeal) {
  return {
    Introducer: deal.introducerAmount,
    Closer: deal.closerAmount,
    Platform: deal.platformFee,
  };
}

type CommerceLink = { code: string; referralUrl: string };

type InvitePayload = {
  deal: RecentDeal;
  participant: DemoParticipant;
  dealParticipants?: DemoParticipant[];
  referralIssuance?: CommerceLink;
  scopedServiceRows?: ScopedServiceCommissionRow[];
};

async function fetchInviteState(token: string): Promise<InvitePayload | null> {
  const res = await fetch(`/api/deal-network-pilot/invites/${encodeURIComponent(token)}`, {
    cache: 'no-store',
  });
  if (!res.ok) return null;
  return (await res.json()) as InvitePayload;
}

function commerceFromPayload(data: InvitePayload): CommerceLink | null {
  if (data.referralIssuance?.referralUrl) {
    return data.referralIssuance;
  }
  return referralIssuanceFromParticipant(data.participant);
}

type Props = {
  token: string;
  deal: RecentDeal;
  participant: DemoParticipant;
  dealParticipants: DemoParticipant[];
  initialApproved: boolean;
  initialReferralIssuance: CommerceLink | null;
  initialScopedServiceRows?: ScopedServiceCommissionRow[];
};

export function ProjectParticipantAgreementPanel({
  token,
  deal,
  participant: initialParticipant,
  dealParticipants,
  initialApproved,
  initialReferralIssuance,
  initialScopedServiceRows = [],
}: Props) {
  const { currency: workspaceCurrency } = useOrganizationCurrency();
  const [participant, setParticipant] = React.useState(initialParticipant);
  const [approved, setApproved] = React.useState(initialApproved);
  const [note, setNote] = React.useState(initialParticipant.approvalNote ?? '');
  const [commerceLink, setCommerceLink] = React.useState<CommerceLink | null>(
    initialReferralIssuance
  );
  const [scopedServiceRows, setScopedServiceRows] = React.useState(initialScopedServiceRows);
  const [issuingCommerce, setIssuingCommerce] = React.useState(false);

  const catalogItems = React.useMemo(
    () =>
      resolveAgreementCatalogItems(
        participant,
        scopedServiceRows.map((row) => ({ id: row.id, name: row.name }))
      ),
    [participant, scopedServiceRows]
  );
  const attributionEligible = canGenerateAttributionLink(participant, { catalogItems });
  const attributionExplanation = deriveAttributionExplanation(participant, { catalogItems });
  const expectsCommerce = attributionEligible;
  const approvalDateLabel = formatApprovalTimestamp(participant.approvedAt);

  const applyInvitePayload = React.useCallback((data: InvitePayload) => {
    setParticipant(data.participant);
    setApproved(data.participant.approvalStatus === 'Approved');
    setScopedServiceRows(data.scopedServiceRows ?? []);
    const link = commerceFromPayload(data);
    if (link) setCommerceLink(link);
  }, []);

  const refreshInvite = React.useCallback(async () => {
    const data = await fetchInviteState(token);
    if (data) applyInvitePayload(data);
    return data;
  }, [applyInvitePayload, token]);

  React.useEffect(() => {
    if (!approved || commerceLink || !expectsCommerce) return;

    let cancelled = false;
    let attempts = 0;
    setIssuingCommerce(true);

    const poll = async () => {
      while (!cancelled && attempts < 12) {
        attempts += 1;
        const data = await fetchInviteState(token);
        const link = data ? commerceFromPayload(data) : null;
        if (link) {
          if (!cancelled) {
            applyInvitePayload(data!);
            setIssuingCommerce(false);
          }
          return;
        }
        await new Promise((r) => setTimeout(r, 800));
      }
      if (!cancelled) setIssuingCommerce(false);
    };

    void poll();
    return () => {
      cancelled = true;
    };
  }, [approved, commerceLink, expectsCommerce, applyInvitePayload, token]);

  const rolePayout = React.useMemo(() => {
    const rows = dealParticipants.map(demoParticipantToPilotRow);
    const joint = computeParticipantCommissionTotalsForDeal(
      deal.value,
      roleAmountsFromDeal(deal),
      rows.length > 0 ? rows : [demoParticipantToPilotRow(participant)]
    );
    return resolveParticipantCommissionUsd(
      {
        commissionKind: participant.commissionKind,
        commissionValue: participant.commissionValue,
        baseParticipant: participant.baseParticipant,
        commissionBaseParticipantId: participant.commissionBaseParticipantId,
        formulaExpression: participant.formulaExpression,
      },
      deal.value,
      roleAmountsFromDeal(deal),
      {
        participantTotals: joint.totals,
        participantLabels: joint.labels,
        resolvingParticipantId: participant.id,
      }
    );
  }, [deal, participant, dealParticipants]);

  const commissionStructureLabel =
    COMMISSION_STRUCTURE_OPTIONS.find((o) => o.value === participant.commissionKind)?.label ??
    participant.commissionKind;

  async function approve() {
    try {
      const res = await fetch(`/api/deal-network-pilot/invites/${encodeURIComponent(token)}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: note.trim() || undefined }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as {
          error?: string;
          issuanceFailed?: boolean;
        };
        throw new Error(
          err.error ||
            (err.issuanceFailed
              ? 'Approval saved but customer link could not be generated'
              : 'Approval failed')
        );
      }
      const json = (await res.json()) as {
        participant: DemoParticipant;
        referralIssuance?: CommerceLink;
        scopedServiceRows?: ScopedServiceCommissionRow[];
        operationalSync?: unknown;
      };
      setParticipant(json.participant);
      setApproved(true);
      if (json.scopedServiceRows) setScopedServiceRows(json.scopedServiceRows);

      const immediate =
        json.referralIssuance ?? referralIssuanceFromParticipant(json.participant);
      if (immediate) {
        setCommerceLink(immediate);
      } else if (expectsCommerce) {
        setIssuingCommerce(true);
        const refreshed = await refreshInvite();
        const link = refreshed ? commerceFromPayload(refreshed) : null;
        if (link) setCommerceLink(link);
        setIssuingCommerce(false);
      }

      const sync = parseOperationalSync(json);
      const nextParticipants = dealParticipants.map((p) =>
        p.id === json.participant.id ? json.participant : p
      );
      await applyOperationalSyncRefresh(
        {
          invalidate: () => notifyWorkspaceActivationRefresh(),
          refreshWorkspace: async () => {
            notifyWorkspaceActivationRefresh();
          },
          reloadCoordinationSnapshot: async () => {
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('operational-coordination-reload'));
            }
          },
          notifyActivation: notifyWorkspaceActivationRefresh,
          onAudit: appendOperationalAuditEntry,
        },
        sync,
        {
          mutation: 'agreement_approval',
          projectId: participant.dealId ?? null,
          participantId: participant.id,
          surface: 'project-participant-agreement-panel',
        },
        createPostConvergenceVerifier({
          mutation: 'agreement_approval',
          projectId: participant.dealId ?? null,
          surface: 'project-participant-agreement-panel',
          participants: nextParticipants,
          sync: sync
            ? {
                payoutReadyCount: sync.payoutReadyCount,
                obligationCount: sync.obligationCount,
                releaseEligibleObligationCount: sync.releaseEligibleObligationCount,
              }
            : undefined,
        })
      );
      toast.success('Participation approved');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Approval failed');
    }
  }

  const showCommerceAfterApproval = approved && !!commerceLink && shouldIssueAttributionForParticipant(participant, { catalogItems });
  const commissionScope = React.useMemo(
    () =>
      deriveCommissionScope(participant, {
        catalogItems: scopedServiceRows.map((r) => ({ id: r.id, name: r.name })),
        workspaceCurrency,
      }),
    [participant, scopedServiceRows, workspaceCurrency]
  );
  const catalogCommission = isCatalogScopedCommission(participant);

  return (
    <>
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>Participant agreement</CardTitle>
        <CardDescription>
          Review what you earn, which services qualify, and when attribution begins.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <p className="text-base font-medium">Hi {participant.name},</p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            You are reviewing participation details for this project. If you received this in error,
            contact the operator before approving.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Project</p>
            <p className="font-medium">{deal.dealName}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Merchant</p>
            <p className="font-medium">{deal.partner}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Your role</p>
            <p className="font-medium">{operationalRoleLabel(participant)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Participation</p>
            <Badge variant={approved ? 'default' : 'secondary'}>
              {approved ? 'Approved' : 'Pending your approval'}
            </Badge>
          </div>
          {attributionEligible ? (
            <div className="sm:col-span-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Attribution</p>
              <Badge variant={approved && isAttributionActive(deriveAttributionStatus(participant)) ? 'default' : 'outline'}>
                {approved
                  ? isAttributionActive(deriveAttributionStatus(participant))
                    ? 'Active tracking'
                    : 'Pending link issuance'
                  : attributionExplanation.label}
              </Badge>
            </div>
          ) : null}
        </div>

        {participant.roleDetails?.trim() ? (
          <div className="rounded-md border p-3 bg-background">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Scope</p>
            <p className="text-sm whitespace-pre-wrap">{participant.roleDetails.trim()}</p>
          </div>
        ) : null}

        <div className="rounded-md border p-3 bg-background space-y-2">
          <p className="text-sm font-medium">Your earnings on this project</p>
          <p className="text-sm font-medium text-foreground">{commissionScope.earningsPrimary}</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {commissionScope.scopeDescription}
          </p>
          {!catalogCommission && commissionStructureLabel && participant.participationModel !== 'fixed_payout' ? (
            <p className="text-xs text-muted-foreground">Structure: {commissionStructureLabel}</p>
          ) : null}
          {!catalogCommission && !participant.compensationProfile?.configured && rolePayout && rolePayout.total > 0 ? (
            <p className="text-sm text-muted-foreground">{rolePayout.previewLine}</p>
          ) : null}
        </div>

        <ParticipantAttributionAgreementSummary
          participant={participant}
          commerce={participant.referralCommerce}
          serviceRows={scopedServiceRows}
          approved={approved}
          catalogItems={scopedServiceRows.map((r) => ({ id: r.id, name: r.name }))}
          workspaceCurrency={workspaceCurrency}
          allServicesNote={
            isAllActiveCatalogSource(participant) ||
            (!participant.referralCommerce?.enabledServiceIds?.length &&
              participant.referralCommerce?.commissionMode === 'referral_commerce')
          }
        />

        {!approved && attributionEligible ? (
          <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground leading-relaxed">
            Approving confirms your participation. Customer attribution activates after approval.
            Payout details are confirmed separately by the operator — Provvypay does not collect bank
            or KYC information at this stage.
          </div>
        ) : null}

        {approved ? (
          <Alert className="border-emerald-200 bg-emerald-50/80">
            <CheckCircle2 className="h-4 w-4 text-emerald-700" />
            <AlertDescription className="text-emerald-900">
              Participation approved
              {approvalDateLabel ? ` on ${approvalDateLabel}` : ''}. Your agreement is confirmed.
            </AlertDescription>
          </Alert>
        ) : null}

        {approved && participant.approvalNote?.trim() ? (
          <div className="rounded-md border p-3 bg-muted/30 text-sm space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Message to operator
            </p>
            <p className="whitespace-pre-wrap">{participant.approvalNote.trim()}</p>
          </div>
        ) : null}

        {!approved ? (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void approve();
            }}
          >
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="agreement-note">
                Message to operator (optional)
              </label>
              <Textarea
                id="agreement-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add a note or question for the operator"
              />
            </div>
            <Button type="submit">Approve participation</Button>
          </form>
        ) : null}

        {showCommerceAfterApproval ? (
          <div className="rounded-md border p-4 bg-background space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium">Trackable customer payment link</p>
              <Badge variant="default">Active</Badge>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Share this link with customers for service checkout. Commission terms are not shown on
              the customer page.
            </p>
            <ReferralSharePanel
              code={commerceLink.code}
              referralUrl={commerceLink.referralUrl}
              qrUrl={buildReferralQrApiPath(commerceLink.code)}
              participantLabel={participant.name}
            />
          </div>
        ) : approved && expectsCommerce ? (
          <p className="text-sm text-muted-foreground">
            {issuingCommerce
              ? 'Preparing your trackable customer link…'
              : 'Customer link unavailable. Contact the project operator.'}
          </p>
        ) : null}
      </CardContent>
    </Card>

    <OperationalActivitySection
      projectId={deal.id}
      participantId={participant.id}
      title="Agreement history"
      defaultOpen={false}
    />
    </>
  );
}
