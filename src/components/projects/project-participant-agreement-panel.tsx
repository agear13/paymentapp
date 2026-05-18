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

function roleAmountsFromDeal(deal: RecentDeal) {
  return {
    Introducer: deal.introducerAmount,
    Closer: deal.closerAmount,
    Platform: deal.platformFee,
  };
}

type Props = {
  token: string;
  deal: RecentDeal;
  participant: DemoParticipant;
  dealParticipants: DemoParticipant[];
  initialApproved: boolean;
  initialReferralIssuance: { code: string; referralUrl: string } | null;
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
  const [commerceLink, setCommerceLink] = React.useState<{
    code: string;
    referralUrl: string;
  } | null>(initialReferralIssuance);

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
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || 'Approval failed');
      }
      const data = (await res.json()) as {
        participant: DemoParticipant;
        referralIssuance?: { code: string; referralUrl: string };
      };
      setParticipant(data.participant);
      setApproved(true);
      if (data.referralIssuance) {
        setCommerceLink(data.referralIssuance);
      } else if (data.participant.customerCommerceUrl?.trim()) {
        const url = data.participant.customerCommerceUrl.trim();
        const codeMatch = url.match(/\/r\/([A-Z0-9_-]+)/i) ?? url.match(/\/ref\/([a-z0-9_-]+)/i);
        setCommerceLink({
          referralUrl: url,
          code: codeMatch?.[1]?.toUpperCase() ?? 'LINK',
        });
      }
      toast.success('Participation approved');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Approval failed');
    }
  }

  const showCommerceAfterApproval =
    approved &&
    commerceLink &&
    shouldIssueReferralLink(participant.referralCommerce);

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
            <p className="text-sm font-medium">Trackable customer payment link</p>
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
        ) : approved && shouldIssueReferralLink(participant.referralCommerce) ? (
          <p className="text-sm text-muted-foreground">
            Your trackable customer link is being prepared. Refresh this page in a moment.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
