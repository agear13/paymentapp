'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
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
import { earningsStructureSummary } from '@/lib/projects/participant-entitlement';
import { shouldIssueReferralLink } from '@/lib/referrals/referral-commerce-config';
import {
  isAttributionActive,
  referralIssuanceFromParticipant,
} from '@/lib/projects/participant-lifecycle';
import { deriveAttributionStatus } from '@/lib/projects/participant-entitlement';

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
};

export function ProjectParticipantAgreementPanel({
  token,
  deal,
  participant: initialParticipant,
  dealParticipants,
  initialApproved,
  initialReferralIssuance,
}: Props) {
  const [participant, setParticipant] = React.useState(initialParticipant);
  const [approved, setApproved] = React.useState(initialApproved);
  const [note, setNote] = React.useState(initialParticipant.approvalNote ?? '');
  const [commerceLink, setCommerceLink] = React.useState<CommerceLink | null>(
    initialReferralIssuance
  );
  const [issuingCommerce, setIssuingCommerce] = React.useState(false);

  const attribution = deriveAttributionStatus(participant);
  const expectsCommerce = shouldIssueReferralLink(participant.referralCommerce);

  const applyInvitePayload = React.useCallback((data: InvitePayload) => {
    setParticipant(data.participant);
    setApproved(data.participant.approvalStatus === 'Approved');
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
      const data = (await res.json()) as {
        participant: DemoParticipant;
        referralIssuance?: CommerceLink;
      };
      setParticipant(data.participant);
      setApproved(true);

      const immediate =
        data.referralIssuance ?? referralIssuanceFromParticipant(data.participant);
      if (immediate) {
        setCommerceLink(immediate);
      } else if (expectsCommerce) {
        setIssuingCommerce(true);
        const refreshed = await refreshInvite();
        const link = refreshed ? commerceFromPayload(refreshed) : null;
        if (link) setCommerceLink(link);
        setIssuingCommerce(false);
      }

      toast.success('Participation approved');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Approval failed');
    }
  }

  const showCommerceAfterApproval = approved && !!commerceLink && expectsCommerce;

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>Participant agreement</CardTitle>
        <CardDescription>
          Review your operational role, payout allocation, and attribution permissions for this
          project. Approving confirms your participation — payout onboarding can be completed later.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
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
          {expectsCommerce ? (
            <div className="sm:col-span-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Attribution</p>
              <Badge variant={isAttributionActive(attribution) ? 'default' : 'outline'}>
                {isAttributionActive(attribution) ? 'Active' : 'Inactive'}
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
          <p className="text-sm font-medium">Payout allocation</p>
          <p className="text-xs text-muted-foreground">{earningsStructureSummary(participant)}</p>
          <p className="text-xs text-muted-foreground">{commissionStructureLabel}</p>
          {rolePayout && rolePayout.total > 0 ? (
            <>
              <p className="text-sm text-muted-foreground">{rolePayout.previewLine}</p>
              <p className="font-semibold">Estimated allocation: ${rolePayout.total.toLocaleString()}</p>
            </>
          ) : null}
        </div>

        <ParticipantAttributionAgreementSummary commerce={participant.referralCommerce} />

        {!approved ? (
          <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
            Customer payment links are issued only after you approve participation. Attribution
            tracking begins after approval; identity verification is required before payout release.
          </div>
        ) : null}

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!approved) void approve();
          }}
        >
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="agreement-note">
              Optional confirmation note
            </label>
            <Textarea
              id="agreement-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Internal note for the operator record"
              disabled={approved}
            />
          </div>
          <Button type="submit" disabled={approved}>
            {approved ? 'Participation approved' : 'Approve participation'}
          </Button>
        </form>

        {showCommerceAfterApproval ? (
          <div className="rounded-md border p-4 bg-background space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium">Trackable customer payment link</p>
              <Badge>Active</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Share this link with customers for service checkout. Commission and payout mechanics
              are not shown to customers.
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
              : 'Customer link unavailable — contact the project operator.'}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
