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
import { participantAgreementPath } from '@/lib/projects/participant-entitlement';
import { PAYOUT_CONFIRMATION_LABELS } from '@/lib/operations/merchant-operational-copy';
import { cn } from '@/lib/utils';
import { hydrateParticipant, participantEntity } from '@/lib/operations/hydration/hydrate-participant';
import {
  agreementLabelFromContract,
  attributionLabelFromContract,
  participantDisplayName,
  participantEmail,
  payoutVerificationLabelFromContract,
} from '@/lib/operations/contracts/participant-presentation';

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
  const hydrated = React.useMemo(() => hydrateParticipant(participant), [participant]);
  const entity = hydrated._entity;
  const share = onShareAgreement ?? onCopyAgreement;
  const exempt = hydrated.compensation.exemptFromPayout;
  const verified = hydrated.payout.verifiedExternally;

  const viewAgreement = () => {
    const path = entity.agreementUrl ?? participantAgreementPath(entity.inviteToken);
    if (typeof window !== 'undefined') {
      window.open(path, '_blank', 'noopener,noreferrer');
    }
  };

  const openCompensation = () => onConfigureCompensation(participantEntity(hydrated));
  const openEdit = () => onEdit(participantEntity(hydrated));
  const openShare = () => share(participantEntity(hydrated));
  const openCopy = () => onCopyAgreement(participantEntity(hydrated));

  return (
    <TableRow
      id={`participant-${hydrated.id}`}
      className={cn(
        highlighted && 'bg-emerald-500/10 transition-colors duration-700',
        'align-middle'
      )}
    >
      <TableCell className="min-w-[140px] max-w-[220px]">
        <div className="font-medium truncate" title={participantDisplayName(hydrated)}>
          {participantDisplayName(hydrated)}
        </div>
        <div
          className="text-xs text-muted-foreground truncate"
          title={hydrated.identity.email ?? undefined}
        >
          {participantEmail(hydrated)}
        </div>
      </TableCell>
      <TableCell className="w-[100px] whitespace-nowrap text-sm">
        {operationalRoleLabel(entity)}
      </TableCell>
      <TableCell className="w-[120px]">
        <Badge variant="outline" className="whitespace-nowrap text-xs">
          {agreementLabelFromContract(hydrated.lifecycle.agreement)}
        </Badge>
      </TableCell>
      <TableCell className="w-[110px]">
        {hydrated.attribution.enabled ? (
          <Badge
            variant={hydrated.attribution.active ? 'default' : 'secondary'}
            className="whitespace-nowrap text-xs"
          >
            {attributionLabelFromContract(
              hydrated.attribution.lifecycle,
              hydrated.attribution.enabled
            )}
          </Badge>
        ) : (
          <span
            className="text-xs text-foreground/70 truncate block max-w-[100px]"
            title={attributionLabelFromContract(
              hydrated.attribution.lifecycle,
              hydrated.attribution.enabled
            )}
          >
            {attributionLabelFromContract(
              hydrated.attribution.lifecycle,
              hydrated.attribution.enabled
            )}
          </span>
        )}
      </TableCell>
      <TableCell className="w-[148px]" onClick={(e) => e.stopPropagation()}>
        {exempt ? (
          <span className="text-xs text-muted-foreground whitespace-nowrap">No payout</span>
        ) : (
          <div className="space-y-1">
            <Badge variant={verified ? 'default' : 'outline'} className="whitespace-nowrap text-xs">
              {payoutVerificationLabelFromContract(
                hydrated.lifecycle.payoutVerification,
                verified,
                hydrated.payout.blocked
              )}
            </Badge>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <Checkbox
                checked={verified}
                onCheckedChange={(v) => onPayoutVerificationChange(hydrated.id, v === true)}
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
          title={hydrated.compensation.earningsSummary}
          onClick={openCompensation}
        >
          {hydrated.compensation.earningsSummary}
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
            <DropdownMenuItem onClick={openCompensation}>
              <Pencil className="mr-2 h-3.5 w-3.5" />
              Configure earnings
            </DropdownMenuItem>
            <DropdownMenuItem onClick={openEdit}>Edit participant</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={openCopy}>
              <Copy className="mr-2 h-3.5 w-3.5" />
              Copy agreement
            </DropdownMenuItem>
            <DropdownMenuItem onClick={openShare}>
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
