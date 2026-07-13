'use client';

import * as React from 'react';
import Link from 'next/link';
import { MoreHorizontal, Pencil } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TableCell, TableRow } from '@/components/ui/table';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import { operationalRoleLabel } from '@/lib/projects/participants-for-project';
import {
  deriveParticipantCommercialTablePresentation,
  type ParticipantTableNextAction,
} from '@/lib/commercial/participant-commercial-lifecycle';
import {
  projectOperatorReviewPath,
  projectXeroExportPath,
} from '@/lib/projects/project-routes';
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
import { ParticipantWorkspaceActions } from '@/components/participant-portal/participant-portal-actions';
import type { OperationalSyncHandlers } from '@/lib/operations/orchestration/operational-sync-client';
import type { AccountingReconciliationResult } from '@/lib/commercial/accounting-reconciliation';

const ROW_ACTION_BUTTON_CLASS =
  'h-9 px-3 text-xs font-medium gap-1 shrink-0';

function StackedAttributionCell({
  lifecycle,
  enabled,
  active,
}: {
  lifecycle: string;
  enabled: boolean;
  active: boolean;
}) {
  return (
    <div className="flex flex-col items-start gap-1.5 leading-tight">
      <Badge
        variant={enabled && active ? 'default' : enabled ? 'secondary' : 'outline'}
        className="whitespace-nowrap text-xs shrink-0"
      >
        {attributionChipLabelFromContract(lifecycle, enabled)}
      </Badge>
      <p className="text-xs text-muted-foreground leading-snug whitespace-normal">
        {attributionSecondaryFromContract(lifecycle, enabled)}
      </p>
    </div>
  );
}

function TableStatusLabel({
  label,
  hint,
}: {
  label: string;
  hint?: string | null;
}) {
  return (
    <div className="leading-tight">
      <span className="text-sm font-medium text-foreground">{label}</span>
      {hint ? (
        <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>
      ) : null}
    </div>
  );
}

function ParticipantTableNextActionCell({
  nextAction,
  projectId,
  participantId,
  onConfigureCompensation,
  onGenerateAgreement,
  onSharePaymentRequest,
  releaseReady,
  canRelease,
  releaseDisabledReason,
  accountingReconciliation,
  releaseSyncHandlers,
  organizationId,
  workspaceCurrency,
  participantName,
}: {
  nextAction: ParticipantTableNextAction;
  projectId?: string;
  participantId: string;
  onConfigureCompensation: () => void;
  onGenerateAgreement: () => void;
  onSharePaymentRequest?: () => void;
  releaseReady?: boolean;
  canRelease?: boolean;
  releaseDisabledReason?: string | null;
  accountingReconciliation?: AccountingReconciliationResult | null;
  releaseSyncHandlers?: OperationalSyncHandlers;
  organizationId?: string | null;
  workspaceCurrency?: string;
  participantName?: string;
}) {
  const labelWithArrow = `${nextAction.label} →`;

  if (nextAction.kind === 'waiting_participant') {
    return (
      <Badge
        variant="outline"
        className="text-xs font-medium border-amber-300/80 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-300"
      >
        {nextAction.label}
      </Badge>
    );
  }

  if (nextAction.kind === 'completed') {
    return (
      <Badge
        variant="outline"
        className="text-xs font-medium border-green-300/80 bg-green-50 text-green-800 dark:border-green-700 dark:bg-green-950/30 dark:text-green-300"
      >
        {nextAction.label}
      </Badge>
    );
  }

  if (nextAction.kind === 'ready_for_settlement') {
    if (releaseSyncHandlers && workspaceCurrency) {
      return (
        <ParticipantReleaseButton
          participantId={participantId}
          participantName={participantName ?? 'participant'}
          organizationId={organizationId}
          currency={workspaceCurrency}
          releaseReady={releaseReady ?? true}
          canRelease={(canRelease ?? false) && (accountingReconciliation?.releaseAllowed ?? true)}
          disabledReason={
            accountingReconciliation && !accountingReconciliation.releaseAllowed
              ? accountingReconciliation.reason
              : releaseDisabledReason
          }
          reconciliation={accountingReconciliation}
          syncHandlers={releaseSyncHandlers}
          className={ROW_ACTION_BUTTON_CLASS}
          label={nextAction.label}
        />
      );
    }
    return (
      <Badge
        variant="outline"
        className="text-xs font-medium border-blue-300/80 bg-blue-50 text-blue-800 dark:border-blue-700 dark:bg-blue-950/30 dark:text-blue-300"
      >
        {nextAction.label}
      </Badge>
    );
  }

  if (nextAction.kind === 'configure_earnings') {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={ROW_ACTION_BUTTON_CLASS}
        onClick={onConfigureCompensation}
      >
        {labelWithArrow}
      </Button>
    );
  }

  if (nextAction.kind === 'generate_agreement') {
    return (
      <Button
        type="button"
        variant="default"
        size="sm"
        className={ROW_ACTION_BUTTON_CLASS}
        onClick={onGenerateAgreement}
      >
        {labelWithArrow}
      </Button>
    );
  }

  if (nextAction.kind === 'share_payment_request') {
    return (
      <Button
        type="button"
        variant="default"
        size="sm"
        className={ROW_ACTION_BUTTON_CLASS}
        onClick={onSharePaymentRequest}
      >
        {labelWithArrow}
      </Button>
    );
  }

  if (nextAction.kind === 'review_submission' && projectId) {
    return (
      <Button asChild variant="default" size="sm" className={ROW_ACTION_BUTTON_CLASS}>
        <Link href={projectOperatorReviewPath(projectId, participantId)}>
          {labelWithArrow}
        </Link>
      </Button>
    );
  }

  if (nextAction.kind === 'push_to_xero' && projectId) {
    return (
      <Button asChild variant="default" size="sm" className={ROW_ACTION_BUTTON_CLASS}>
        <Link href={projectXeroExportPath(projectId)}>
          {labelWithArrow}
        </Link>
      </Button>
    );
  }

  return null;
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
  accountingReconciliation?: AccountingReconciliationResult | null;
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
  accountingReconciliation,
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

  const openCompensation = () => onConfigureCompensation(participantEntity(hydrated));
  const openEdit = () => onEdit(participantEntity(hydrated));
  const openShare = () => share(participantEntity(hydrated));
  const openSharePaymentRequest = () => {
    const p = participantEntity(hydrated);
    onSharePaymentRequest?.(p);
  };

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
        <TableStatusLabel
          label={tablePresentation.agreementChip}
          hint={tablePresentation.agreementSecondary || null}
        />
      </TableCell>

      <TableCell className={participantTableCellClass('attribution')}>
        <StackedAttributionCell
          lifecycle={hydrated.attribution.lifecycle}
          enabled={hydrated.attribution.enabled}
          active={hydrated.attribution.active}
        />
      </TableCell>

      <TableCell className={participantTableCellClass('payout')}>
        {exempt ? (
          <div className="leading-tight">
            <span className="text-sm font-medium text-foreground">No payout</span>
            <p className="text-xs text-muted-foreground mt-0.5">Internal or unpaid role</p>
          </div>
        ) : (
          <div className="leading-tight">
            <span className="text-sm font-medium text-foreground">
              {tablePresentation.commercialChip}
            </span>
            {tablePresentation.commercialSecondary ? (
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                {tablePresentation.commercialSecondary}
              </p>
            ) : null}
          </div>
        )}
      </TableCell>

      <TableCell className={participantTableCellClass('earnings')}>
        {exempt ? (
          <span className="text-sm text-muted-foreground">No payout</span>
        ) : (
          <span
            className="text-sm font-medium text-foreground/90 break-words max-w-full leading-snug"
            title={hydrated.compensation.earningsTitle}
          >
            {hydrated.compensation.earningsPrimaryCompact}
          </span>
        )}
      </TableCell>

      <TableCell
        className={participantTableCellClass('nextAction')}
        onClick={(e) => e.stopPropagation()}
      >
        {exempt ? (
          <span className="text-xs text-muted-foreground">No action required</span>
        ) : (
          <ParticipantTableNextActionCell
            nextAction={tablePresentation.nextAction}
            projectId={projectId}
            participantId={hydrated.id}
            onConfigureCompensation={openCompensation}
            onGenerateAgreement={openShare}
            onSharePaymentRequest={openSharePaymentRequest}
            releaseReady={releaseReady}
            canRelease={canRelease}
            releaseDisabledReason={releaseDisabledReason}
            accountingReconciliation={accountingReconciliation}
            releaseSyncHandlers={releaseSyncHandlers}
            organizationId={organizationId}
            workspaceCurrency={workspaceCurrency}
            participantName={participantDisplayName(hydrated)}
          />
        )}
      </TableCell>

      <TableCell className={participantTableCellClass('actions')}>
        <div className="flex justify-end items-center gap-1 w-full">
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
              <DropdownMenuItem onClick={openEdit}>
                <Pencil className="mr-2 h-3.5 w-3.5" />
                Edit participant
              </DropdownMenuItem>
              <ParticipantWorkspaceActions
                participant={entity}
                onRequestPayoutDetails={onSendPaymentRequest}
              />
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </TableCell>
    </TableRow>
  );
}

export const ProjectParticipantTableRow = React.memo(ProjectParticipantTableRowComponent);
