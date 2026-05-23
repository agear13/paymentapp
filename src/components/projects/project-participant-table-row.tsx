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
import { hydrateParticipant, participantEntity, type HydrateParticipantContext } from '@/lib/operations/hydration/hydrate-participant';
import {
  agreementLabelFromContract,
  agreementSecondaryFromContract,
  attributionChipLabelFromContract,
  attributionSecondaryFromContract,
  participantDisplayName,
  participantEmail,
  payoutVerificationLabelFromContract,
} from '@/lib/operations/contracts/participant-presentation';
import { participantTableCellClass } from '@/components/projects/participant-table-layout';

function StackedOperationalCell({
  chip,
  chipVariant = 'outline',
  secondary,
}: {
  chip: React.ReactNode;
  chipVariant?: 'default' | 'secondary' | 'outline';
  secondary: string;
}) {
  return (
    <div className="flex flex-col items-start gap-1.5 leading-tight">
      {typeof chip === 'string' ? (
        <Badge variant={chipVariant} className="whitespace-nowrap text-xs shrink-0">
          {chip}
        </Badge>
      ) : (
        chip
      )}
      <p className="text-xs text-muted-foreground leading-snug whitespace-normal">{secondary}</p>
    </div>
  );
}

export type ProjectParticipantTableRowProps = {
  participant: DemoParticipant;
  catalogContext?: HydrateParticipantContext;
  highlighted?: boolean;
  onCopyAgreement: (p: DemoParticipant) => void;
  onShareAgreement?: (p: DemoParticipant) => void;
  onPayoutVerificationChange: (id: string, confirmed: boolean) => void;
  onEdit: (p: DemoParticipant) => void;
  onConfigureCompensation: (p: DemoParticipant) => void;
};

function ProjectParticipantTableRowComponent({
  participant,
  catalogContext,
  highlighted = false,
  onCopyAgreement,
  onShareAgreement,
  onPayoutVerificationChange,
  onEdit,
  onConfigureCompensation,
}: ProjectParticipantTableRowProps) {
  const hydrated = React.useMemo(
    () => hydrateParticipant(participant, catalogContext),
    [participant, catalogContext]
  );
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
        'align-top'
      )}
    >
      <TableCell className={participantTableCellClass('participant')}>
        <div className="space-y-0.5">
          <div
            className="font-medium text-sm truncate max-w-full"
            title={participantDisplayName(hydrated)}
          >
            {participantDisplayName(hydrated)}
          </div>
          <div
            className="text-xs text-muted-foreground truncate max-w-full"
            title={hydrated.identity.email ?? undefined}
          >
            {participantEmail(hydrated)}
          </div>
        </div>
      </TableCell>

      <TableCell className={participantTableCellClass('role')}>
        {operationalRoleLabel(entity)}
      </TableCell>

      <TableCell className={participantTableCellClass('agreement')}>
        <StackedOperationalCell
          chip={agreementLabelFromContract(hydrated.lifecycle.agreement)}
          secondary={agreementSecondaryFromContract(hydrated.lifecycle.agreement)}
        />
      </TableCell>

      <TableCell className={participantTableCellClass('attribution')}>
        <StackedOperationalCell
          chip={attributionChipLabelFromContract(
            hydrated.attribution.lifecycle,
            hydrated.attribution.enabled
          )}
          chipVariant={
            hydrated.attribution.enabled && hydrated.attribution.active
              ? 'default'
              : hydrated.attribution.enabled
                ? 'secondary'
                : 'outline'
          }
          secondary={attributionSecondaryFromContract(
            hydrated.attribution.lifecycle,
            hydrated.attribution.enabled
          )}
        />
      </TableCell>

      <TableCell
        className={participantTableCellClass('payout')}
        onClick={(e) => e.stopPropagation()}
      >
        {exempt ? (
          <div className="flex flex-col gap-1.5 leading-tight">
            <Badge variant="outline" className="whitespace-nowrap text-xs w-fit">
              No payout
            </Badge>
            <p className="text-xs text-muted-foreground leading-snug">Internal or unpaid role</p>
          </div>
        ) : (
          <div className="flex flex-col items-start gap-2 leading-tight">
            <Badge
              variant={verified ? 'default' : 'outline'}
              className="whitespace-nowrap text-xs shrink-0"
            >
              {payoutVerificationLabelFromContract(
                hydrated.lifecycle.payoutVerification,
                verified,
                hydrated.payout.blocked
              )}
            </Badge>
            <label className="flex items-start gap-1.5 cursor-pointer">
              <Checkbox
                checked={verified}
                onCheckedChange={(v) => onPayoutVerificationChange(hydrated.id, v === true)}
                className="h-3.5 w-3.5 mt-0.5 shrink-0"
              />
              <span className="text-xs text-muted-foreground leading-snug">
                {PAYOUT_CONFIRMATION_LABELS.toggleLabel}
              </span>
            </label>
          </div>
        )}
      </TableCell>

      <TableCell className={participantTableCellClass('earnings')}>
        <button
          type="button"
          className="flex flex-col items-start gap-1 leading-tight text-left w-full underline-offset-2 hover:underline"
          title={hydrated.compensation.earningsTitle}
          onClick={openCompensation}
        >
          <span className="text-sm font-medium text-foreground/90 whitespace-nowrap">
            {hydrated.compensation.earningsPrimary}
          </span>
          <span className="text-xs text-muted-foreground leading-snug whitespace-normal">
            {hydrated.compensation.earningsSecondary}
          </span>
        </button>
      </TableCell>

      <TableCell className={participantTableCellClass('actions')}>
        <div className="flex justify-end items-center w-full">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                aria-label="Participant actions"
              >
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
              <DropdownMenuItem onClick={openShare}>Share agreement</DropdownMenuItem>
              <DropdownMenuItem onClick={viewAgreement}>
                <ExternalLink className="mr-2 h-3.5 w-3.5" />
                View agreement
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </TableCell>
    </TableRow>
  );
}

export const ProjectParticipantTableRow = React.memo(ProjectParticipantTableRowComponent);
