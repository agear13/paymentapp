'use client';

import * as React from 'react';
import { Copy, ExternalLink, MoreHorizontal, Pencil } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TableCell, TableRow } from '@/components/ui/table';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import { operationalRoleLabel } from '@/lib/projects/participants-for-project';
import {
  attributionStatusLabel,
  deriveAttributionStatus,
  earningsStructureSummary,
} from '@/lib/projects/participant-entitlement';
import {
  agreementDisplayLabel,
  derivePayoutOnboardingState,
  payoutOnboardingLabel,
  attributionDisplayLabel,
} from '@/lib/projects/participant-lifecycle';
import { canGenerateAttributionLink } from '@/lib/operations/truth/attribution-truth';
import { PAYOUT_CONFIRMATION_LABELS } from '@/lib/operations/merchant-operational-copy';
import { cn } from '@/lib/utils';
import { hydrateOperationalParticipant } from '@/lib/operations/hydration/hydrate-operational-participant';
import { participantAgreementPath } from '@/lib/projects/participant-entitlement';

export type ProjectParticipantTableRowProps = {
  participant: DemoParticipant;
  highlighted?: boolean;
  onCopyAgreement: (p: DemoParticipant) => void;
  onShareAgreement?: (p: DemoParticipant) => void;
  onPayoutVerificationChange: (id: string, confirmed: boolean) => void;
  onEdit: (p: DemoParticipant) => void;
  onConfigureCompensation: (p: DemoParticipant) => void;
};

function ProjectParticipantTableRowComponent({
  participant,
  highlighted = false,
  onCopyAgreement,
  onShareAgreement,
  onPayoutVerificationChange,
  onEdit,
  onConfigureCompensation,
}: ProjectParticipantTableRowProps) {
  const p = React.useMemo(() => hydrateOperationalParticipant(participant), [participant]);
  const attribution = deriveAttributionStatus(p);
  const payoutState = derivePayoutOnboardingState(p);
  const exempt = p.compensationProfile?.exemptFromPayout === true;
  const verified = p.payoutVerificationConfirmed === true;
  const earnings = earningsStructureSummary(p);
  const share = onShareAgreement ?? onCopyAgreement;

  const viewAgreement = () => {
    const path = p.agreementUrl ?? participantAgreementPath(p.inviteToken);
    if (typeof window !== 'undefined') {
      window.open(path, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <TableRow
      id={`participant-${p.id}`}
      className={cn(
        highlighted && 'bg-emerald-500/10 transition-colors duration-700',
        'align-middle'
      )}
    >
      <TableCell className="min-w-[140px] max-w-[220px]">
        <div className="font-medium truncate" title={p.name}>
          {p.name}
        </div>
        <div className="text-xs text-muted-foreground truncate" title={p.email?.trim() || undefined}>
          {p.email?.trim() || 'No email'}
        </div>
      </TableCell>
      <TableCell className="w-[100px] whitespace-nowrap text-sm">
        {operationalRoleLabel(p)}
      </TableCell>
      <TableCell className="w-[120px]">
        <Badge variant="outline" className="whitespace-nowrap text-xs">
          {agreementDisplayLabel(p)}
        </Badge>
      </TableCell>
      <TableCell className="w-[110px]">
        {canGenerateAttributionLink(p) ? (
          <Badge
            variant={attribution === 'active' ? 'default' : 'secondary'}
            className="whitespace-nowrap text-xs"
          >
            {attributionStatusLabel(attribution)}
          </Badge>
        ) : (
          <span
            className="text-xs text-foreground/70 truncate block max-w-[100px]"
            title={attributionDisplayLabel(p)}
          >
            {attributionDisplayLabel(p)}
          </span>
        )}
      </TableCell>
      <TableCell className="w-[148px]" onClick={(e) => e.stopPropagation()}>
        {exempt ? (
          <span className="text-xs text-muted-foreground whitespace-nowrap">No payout</span>
        ) : (
          <div className="space-y-1">
            <Badge variant={verified ? 'default' : 'outline'} className="whitespace-nowrap text-xs">
              {payoutOnboardingLabel(payoutState)}
            </Badge>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <Checkbox
                checked={verified}
                onCheckedChange={(v) => onPayoutVerificationChange(p.id, v === true)}
                className="h-3.5 w-3.5"
              />
              <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                {PAYOUT_CONFIRMATION_LABELS.toggleLabel}
              </span>
            </label>
          </div>
        )}
      </TableCell>
      <TableCell className="min-w-[120px] max-w-[180px]">
        <button
          type="button"
          className="text-left text-sm text-muted-foreground hover:text-foreground truncate block w-full underline-offset-2 hover:underline"
          title={earnings}
          onClick={() => onConfigureCompensation(p)}
        >
          {earnings}
        </button>
      </TableCell>
      <TableCell className="w-12 text-right">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Participant actions">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => onConfigureCompensation(p)}>
              <Pencil className="mr-2 h-3.5 w-3.5" />
              Configure earnings
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onEdit(p)}>
              Edit participant
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onCopyAgreement(p)}>
              <Copy className="mr-2 h-3.5 w-3.5" />
              Copy agreement
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => share(p)}>
              Share agreement
            </DropdownMenuItem>
            <DropdownMenuItem onClick={viewAgreement}>
              <ExternalLink className="mr-2 h-3.5 w-3.5" />
              View agreement
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}

export const ProjectParticipantTableRow = React.memo(ProjectParticipantTableRowComponent);
