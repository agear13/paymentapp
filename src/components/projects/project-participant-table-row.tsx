'use client';

import * as React from 'react';
import Link from 'next/link';
import { Copy, ExternalLink, MoreHorizontal, Pencil } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import {
  deriveParticipantCommercialTablePresentation,
} from '@/lib/commercial/participant-commercial-lifecycle';
import { projectOperatorReviewPath } from '@/lib/projects/project-routes';
import { AGREEMENT_ACTION_COPY } from '@/lib/operations/merchant-operational-copy';
import { cn } from '@/lib/utils';
import { hydrateParticipant, participantEntity, type HydrateParticipantContext } from '@/lib/operations/hydration/hydrate-participant';
import {
  attributionChipLabelFromContract,
  attributionSecondaryFromContract,
  participantDisplayName,
  participantEmail,
} from '@/lib/operations/contracts/participant-presentation';
import { participantTableCellClass } from '@/components/projects/participant-table-layout';
import { ParticipantReleaseButton } from '@/components/projects/participant-release-button';
import type { OperationalSyncHandlers } from '@/lib/operations/orchestration/operational-sync-client';

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
  onSendPaymentRequest?: (p: DemoParticipant) => void;
  onSharePaymentRequest?: (p: DemoParticipant) => void;
  projectId?: string;
  onEdit: (p: DemoParticipant) => void;
  onConfigureCompensation: (p: DemoParticipant) => void;
  organizationId?: string | null;
  workspaceCurrency?: string;
  releaseReady?: boolean;
  canRelease?: boolean;
  releaseDisabledReason?: string | null;
  releaseSyncHandlers?: OperationalSyncHandlers;
};

function ProjectParticipantTableRowComponent({
  participant,
  catalogContext,
  highlighted = false,
  onCopyAgreement,
  onShareAgreement,
  onSendPaymentRequest,
  onSharePaymentRequest,
  projectId,
  onEdit,
  onConfigureCompensation,
  organizationId,
  workspaceCurrency = 'AUD',
  releaseReady = false,
  canRelease = false,
  releaseDisabledReason,
  releaseSyncHandlers,
}: ProjectParticipantTableRowProps) {
  const hydrated = React.useMemo(
    () => hydrateParticipant(participant, catalogContext),
    [participant, catalogContext]
  );
  const entity = hydrated._entity;
  const share = onShareAgreement ?? onCopyAgreement;
  const exempt = hydrated.compensation.exemptFromPayout;
  const tablePresentation = deriveParticipantCommercialTablePresentation(entity);

  const viewAgreement = () => {
    const base = entity.agreementUrl ?? participantAgreementPath(entity.inviteToken);
    // Append ?mode=preview so the agreement page enforces a genuinely read-only view.
    const path = base.includes('?') ? `${base}&mode=preview` : `${base}?mode=preview`;
    if (typeof window !== 'undefined') {
      window.open(path, '_blank', 'noopener,noreferrer');
    }
  };

  const openCompensation = () => onConfigureCompensation(participantEntity(hydrated));
  const openEdit = () => onEdit(participantEntity(hydrated));
  const openShare = () => share(participantEntity(hydrated));
  const openCopy = () => onCopyAgreement(participantEntity(hydrated));

  const handlePrimaryAction = () => {
    const kind = tablePresentation.primaryAction.kind;
    const p = participantEntity(hydrated);
    switch (kind) {
      case 'send_payment_request':
        onSendPaymentRequest?.(p);
        break;
      case 'share_payment_request':
        onSharePaymentRequest?.(p);
        break;
      case 'configure_earnings':
        openCompensation();
        break;
      case 'send_agreement':
        openShare();
        break;
      default:
        break;
    }
  };

  const primaryActionKind = tablePresentation.primaryAction.kind;
  const showPrimaryButton =
    primaryActionKind !== 'none' &&
    primaryActionKind !== 'review_payment' &&
    tablePresentation.primaryAction.label;

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
          chip={tablePresentation.agreementChip}
          secondary={tablePresentation.agreementSecondary}
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
          <StackedOperationalCell
            chip={tablePresentation.commercialChip}
            chipVariant={
              tablePresentation.stage === 'SETTLEMENT_READY' ? 'default' : 'outline'
            }
            secondary={tablePresentation.commercialSecondary}
          />
        )}
      </TableCell>

      <TableCell className={participantTableCellClass('earnings')}>
        <button
          type="button"
          className="flex flex-col items-start gap-1 leading-tight text-left w-full underline-offset-2 hover:underline"
          title={hydrated.compensation.earningsTitle}
          onClick={openCompensation}
        >
          <span className="text-sm font-medium text-foreground/90 break-words max-w-full leading-snug">
            {hydrated.compensation.earningsPrimaryCompact}
          </span>
          <span className="text-xs text-muted-foreground leading-snug whitespace-normal">
            {hydrated.compensation.earningsSecondary}
          </span>
        </button>
      </TableCell>

      <TableCell className={participantTableCellClass('actions')}>
        <div className="flex justify-end items-center gap-1.5 w-full">
          {showPrimaryButton ? (
            <Button
              type="button"
              size="sm"
              className="h-8 shrink-0"
              onClick={handlePrimaryAction}
            >
              {tablePresentation.primaryAction.label}
            </Button>
          ) : null}
          {primaryActionKind === 'review_payment' && projectId ? (
            <Button asChild size="sm" className="h-8 shrink-0">
              <Link href={projectOperatorReviewPath(projectId, hydrated.id)}>
                {tablePresentation.primaryAction.label}
              </Link>
            </Button>
          ) : null}
          {releaseSyncHandlers ? (
            <ParticipantReleaseButton
              participantId={hydrated.id}
              participantName={participantDisplayName(hydrated)}
              organizationId={organizationId}
              currency={workspaceCurrency}
              releaseReady={releaseReady}
              canRelease={canRelease}
              disabledReason={releaseDisabledReason}
              syncHandlers={releaseSyncHandlers}
            />
          ) : null}
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
              <DropdownMenuItem
                onClick={openCopy}
                title={AGREEMENT_ACTION_COPY.copyLink.tooltip}
              >
                <Copy className="mr-2 h-3.5 w-3.5" />
                {AGREEMENT_ACTION_COPY.copyLink.label}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={openShare}
                title={AGREEMENT_ACTION_COPY.shareForApproval.tooltip}
              >
                {AGREEMENT_ACTION_COPY.shareForApproval.label}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={viewAgreement}
                title={AGREEMENT_ACTION_COPY.preview.tooltip}
              >
                <ExternalLink className="mr-2 h-3.5 w-3.5" />
                {AGREEMENT_ACTION_COPY.preview.label}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </TableCell>
    </TableRow>
  );
}

export const ProjectParticipantTableRow = React.memo(ProjectParticipantTableRowComponent);
