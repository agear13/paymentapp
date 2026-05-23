'use client';

import * as React from 'react';
import { Copy, Pencil } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { TableCell, TableRow } from '@/components/ui/table';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import { operationalRoleLabel } from '@/lib/projects/participants-for-project';
import {
  attributionStatusLabel,
  deriveAttributionStatus,
  earningsStructureSummary,
} from '@/lib/projects/participant-entitlement';
import {
  deriveInviteState,
  deriveParticipationLabel,
  inviteStateLabel,
  payoutOnboardingLabel,
  derivePayoutOnboardingState,
  attributionDisplayLabel,
  participationLabelText,
} from '@/lib/projects/participant-lifecycle';
import { canGenerateAttributionLink } from '@/lib/operations/truth/attribution-truth';
import {
  OPERATOR_PAYOUT_DISCLAIMER,
  PAYOUT_CONFIRMATION_LABELS,
} from '@/lib/operations/merchant-operational-copy';
import { cn } from '@/lib/utils';
import { hydrateOperationalParticipant } from '@/lib/operations/hydration/hydrate-operational-participant';

export type ProjectParticipantTableRowProps = {
  participant: DemoParticipant;
  highlighted?: boolean;
  onCopyAgreement: (p: DemoParticipant) => void;
  onPayoutVerificationChange: (id: string, confirmed: boolean) => void;
  onEdit: (p: DemoParticipant) => void;
  onConfigureCompensation: (p: DemoParticipant) => void;
};

function ProjectParticipantTableRowComponent({
  participant,
  highlighted = false,
  onCopyAgreement,
  onPayoutVerificationChange,
  onEdit,
  onConfigureCompensation,
}: ProjectParticipantTableRowProps) {
  const p = React.useMemo(() => hydrateOperationalParticipant(participant), [participant]);
  const invite = deriveInviteState(p);
  const participation = deriveParticipationLabel(p);
  const attribution = deriveAttributionStatus(p);
  const payoutState = derivePayoutOnboardingState(p);
  const exempt = p.compensationProfile?.exemptFromPayout === true;
  const verified = p.payoutVerificationConfirmed === true;

  return (
    <TableRow
      id={`participant-${p.id}`}
      className={cn(
        highlighted && 'animate-pulse bg-emerald-500/10 transition-colors duration-700'
      )}
    >
      <TableCell>
        <div className="font-medium">{p.name}</div>
        <div className="text-xs text-muted-foreground">{p.email?.trim() || 'No email'}</div>
      </TableCell>
      <TableCell>{operationalRoleLabel(p)}</TableCell>
      <TableCell>
        <Badge
          variant={
            invite === 'approved'
              ? 'default'
              : invite === 'opened' || invite === 'sent'
                ? 'secondary'
                : 'outline'
          }
        >
          {inviteStateLabel(invite)}
        </Badge>
      </TableCell>
      <TableCell>
        <Badge variant={participation === 'approved' ? 'default' : 'outline'}>
          {participationLabelText(participation)}
        </Badge>
      </TableCell>
      <TableCell>
        {canGenerateAttributionLink(p) ? (
          <Badge variant={attribution === 'active' ? 'default' : 'secondary'}>
            {attributionStatusLabel(attribution)}
          </Badge>
        ) : (
          <span className="text-xs text-foreground/70">{attributionDisplayLabel(p)}</span>
        )}
      </TableCell>
      <TableCell onClick={(e) => e.stopPropagation()}>
        {exempt ? (
          <span className="text-xs text-muted-foreground">No payout</span>
        ) : (
          <div className="space-y-2 max-w-[220px]">
            <Badge variant={verified ? 'default' : 'outline'}>
              {payoutOnboardingLabel(payoutState)}
            </Badge>
            <label className="flex items-start gap-2 text-xs cursor-pointer leading-snug">
              <Checkbox
                checked={verified}
                onCheckedChange={(v) => onPayoutVerificationChange(p.id, v === true)}
                className="mt-0.5"
              />
              <span>{PAYOUT_CONFIRMATION_LABELS.toggleLabel}</span>
            </label>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {OPERATOR_PAYOUT_DISCLAIMER}
            </p>
          </div>
        )}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        <button
          type="button"
          className="text-left hover:text-foreground underline-offset-2 hover:underline"
          onClick={() => onConfigureCompensation(p)}
        >
          {earningsStructureSummary(p)}
        </button>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex flex-col items-end gap-1">
          <Button variant="ghost" size="sm" onClick={() => onConfigureCompensation(p)}>
            <Pencil className="mr-1 h-3.5 w-3.5" />
            Earnings
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onEdit(p)}>
            Edit
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onCopyAgreement(p)}>
            <Copy className="mr-1 h-3.5 w-3.5" />
            Agreement
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

export const ProjectParticipantTableRow = React.memo(ProjectParticipantTableRowComponent);
