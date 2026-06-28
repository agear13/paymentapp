'use client';

/**
 * Approval Centre Participant Card
 *
 * Renders participant workflow state from `deriveParticipantOperationalWorkflow`.
 *
 * Agreement lifecycle is intentionally not consumed here. Agreement state feeds
 * the canonical participant workflow engine, and this component renders only
 * the canonical status, explanation, primary CTA, and secondary CTAs.
 */

import * as React from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Copy,
  Mail,
  MessageCircle,
  QrCode,
  Send,
  Share2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import { participantAgreementPath } from '@/lib/projects/participant-entitlement';
import {
  hydrateParticipant,
  participantEntity,
} from '@/lib/operations/hydration/hydrate-participant';
import { operationalRoleLabel } from '@/lib/projects/participants-for-project';
import { cn } from '@/lib/utils';
import type { CommercialTimelineEvent } from '@/lib/commercial/commercial-timeline-events';
import { buildParticipantCommercialJourney } from '@/lib/commercial/commercial-timeline-events';
import { ParticipantCommercialHistory } from '@/components/commercial/commercial-timeline';
import {
  deriveParticipantOperationalWorkflow,
  type ParticipantWorkflowCta,
} from '@/lib/commercial/participant-commercial-lifecycle';
import {
  projectOperatorReviewPath,
  projectXeroExportPath,
} from '@/lib/projects/project-routes';
import { ParticipantReleaseButton } from '@/components/projects/participant-release-button';
import { AccountingReconciliationCard } from '@/components/commercial/accounting-reconciliation-card';
import type { AccountingReconciliationResult } from '@/lib/commercial/accounting-reconciliation';
import type { OperationalSyncHandlers } from '@/lib/operations/orchestration/operational-sync-client';

/* ─── Workflow display classes ────────────────────────────────────────────── */

const WORKFLOW_BADGE_CLASS: Record<
  ReturnType<typeof deriveParticipantOperationalWorkflow>['readiness'],
  string
> = {
  blocked: 'border-border text-muted-foreground bg-muted/40',
  waiting: 'border-amber-300/70 text-amber-700 bg-amber-50/80 dark:bg-amber-950/40 dark:text-amber-300',
  ready: 'border-blue-300/70 text-blue-700 bg-blue-50/80 dark:bg-blue-950/40 dark:text-blue-300',
  complete: 'border-transparent bg-[rgb(29,111,66)] text-white hover:bg-[rgb(29,111,66)]',
};

/* ─── Last activity ────────────────────────────────────────────────────────── */

function deriveLastActivity(p: DemoParticipant): string | null {
  const now = Date.now();

  function ago(iso: string | undefined): string | null {
    if (!iso) return null;
    const diff = now - new Date(iso).getTime();
    const minutes = Math.round(diff / 60_000);
    if (minutes < 2) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.round(diff / 3_600_000);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.round(diff / 86_400_000);
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    const weeks = Math.round(days / 7);
    if (weeks < 5) return `${weeks}w ago`;
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  if (p.approvedAt) return `Approved ${ago(p.approvedAt) ?? ''}`;
  if (p.agreementViewedAt) return `Opened ${ago(p.agreementViewedAt) ?? ''}`;
  if (p.agreementSharedAt) return `Sent ${ago(p.agreementSharedAt) ?? ''}`;
  if (p.inviteSentAt) return `Invited ${ago(p.inviteSentAt) ?? ''}`;
  return null;
}

/* ─── Send agreement sheet ─────────────────────────────────────────────────
 *
 * The primary CTA for the canonical send-agreement state.
 * Opens a popover with delivery options.
 */

type SendApprovalSheetProps = {
  participant: DemoParticipant;
  fullAgreementUrl: string;
  onShareAgreement: () => void | Promise<void>;
  label: string;
};

function SendApprovalSheet({
  participant,
  fullAgreementUrl,
  onShareAgreement,
  label,
}: SendApprovalSheetProps) {
  const [open, setOpen] = React.useState(false);
  const [sharingMethod, setSharingMethod] = React.useState<string | null>(null);

  const handleCopy = async () => {
    setSharingMethod('copy');
    try {
      await navigator.clipboard.writeText(fullAgreementUrl);
      await onShareAgreement();
      toast.success('Agreement link copied');
      setOpen(false);
    } catch {
      toast.error('Could not copy — try right-clicking the link instead.');
    } finally {
      setSharingMethod(null);
    }
  };

  const handleEmail = async () => {
    if (!participant.email?.trim()) {
      toast.error('No email address on file for this participant.');
      return;
    }
    setSharingMethod('email');
    const subject = encodeURIComponent('Your participation agreement');
    const body = encodeURIComponent(
      `Hi ${participant.name},\n\nPlease review and approve your participation agreement:\n${fullAgreementUrl}\n\nThis should only take a few minutes.`
    );
    try {
      window.location.href = `mailto:${participant.email.trim()}?subject=${subject}&body=${body}`;
      await onShareAgreement();
      setOpen(false);
    } finally {
      setSharingMethod(null);
    }
  };

  const handleWhatsApp = async () => {
    setSharingMethod('whatsapp');
    const text = encodeURIComponent(
      `Hi ${participant.name}, please review and approve your participation agreement: ${fullAgreementUrl}`
    );
    try {
      window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener,noreferrer');
      await onShareAgreement();
      setOpen(false);
    } finally {
      setSharingMethod(null);
    }
  };

  const handleQr = async () => {
    setSharingMethod('qr');
    const qrHref = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(fullAgreementUrl)}`;
    try {
      window.open(qrHref, '_blank', 'noopener,noreferrer');
      await onShareAgreement();
      setOpen(false);
    } finally {
      setSharingMethod(null);
    }
  };

  const handleNativeShare = async () => {
    if (typeof navigator === 'undefined' || !navigator.share) {
      toast.error('Native share is not available in this browser.');
      return;
    }
    setSharingMethod('native');
    try {
      await navigator.share({
        title: 'Participation agreement',
        text: `Please review and approve your participation agreement for ${participant.name}.`,
        url: fullAgreementUrl,
      });
      await onShareAgreement();
      setOpen(false);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      toast.error('Could not open native share.');
    } finally {
      setSharingMethod(null);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          size="sm"
          className="h-7 px-3 text-xs font-medium gap-1.5 bg-foreground hover:bg-foreground/90 text-background"
        >
          <Send className="h-3 w-3" />
          {label}
          <ChevronDown className="h-3 w-3 ml-0.5 opacity-70" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-48 p-1.5 shadow-md" sideOffset={4}>
        <button
          type="button"
          className="flex items-center gap-2.5 w-full px-2 py-1.5 text-xs rounded-sm hover:bg-accent text-foreground transition-colors"
          onClick={() => void handleCopy()}
          disabled={sharingMethod != null}
        >
          <Copy className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          {sharingMethod === 'copy' ? 'Saving…' : 'Copy approval link'}
        </button>
        <button
          type="button"
          className="flex items-center gap-2.5 w-full px-2 py-1.5 text-xs rounded-sm hover:bg-accent text-foreground transition-colors"
          onClick={() => void handleEmail()}
          disabled={sharingMethod != null}
        >
          <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          {sharingMethod === 'email' ? 'Saving…' : 'Email participant'}
        </button>
        <button
          type="button"
          className="flex items-center gap-2.5 w-full px-2 py-1.5 text-xs rounded-sm hover:bg-accent text-foreground transition-colors"
          onClick={() => void handleWhatsApp()}
          disabled={sharingMethod != null}
        >
          <MessageCircle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          {sharingMethod === 'whatsapp' ? 'Saving…' : 'WhatsApp'}
        </button>
        <button
          type="button"
          className="flex items-center gap-2.5 w-full px-2 py-1.5 text-xs rounded-sm hover:bg-accent text-foreground transition-colors"
          onClick={() => void handleQr()}
          disabled={sharingMethod != null}
        >
          <QrCode className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          {sharingMethod === 'qr' ? 'Saving…' : 'Generate QR code'}
        </button>
        <button
          type="button"
          className="flex items-center gap-2.5 w-full px-2 py-1.5 text-xs rounded-sm hover:bg-accent text-foreground transition-colors disabled:opacity-50"
          onClick={() => void handleNativeShare()}
          disabled={
            sharingMethod != null ||
            typeof navigator === 'undefined' ||
            !navigator.share
          }
        >
          <Share2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          {sharingMethod === 'native' ? 'Saving…' : 'Native share'}
        </button>
      </PopoverContent>
    </Popover>
  );
}

/* ─── Props ─────────────────────────────────────────────────────────────────── */

export type ApprovalCentreParticipantCardProps = {
  participant: DemoParticipant;
  id?: string;
  isHighlighted?: boolean;
  'data-approval-card'?: boolean;
  'data-pending'?: string;
  onShareAgreement: (
    p: DemoParticipant,
    options?: { showDialog?: boolean }
  ) => void | Promise<void>;
  onConfigureEarnings: (p: DemoParticipant) => void;
  onSendPaymentRequest?: (p: DemoParticipant) => void;
  projectId?: string;
  organizationId?: string | null;
  workspaceCurrency?: string;
  releaseReady?: boolean;
  canRelease?: boolean;
  releaseDisabledReason?: string | null;
  accountingReconciliation?: AccountingReconciliationResult | null;
  releaseSyncHandlers?: OperationalSyncHandlers;
  /**
   * Commercial timeline events for this agreement.
   * When provided, shows the participant's commercial relationship history
   * below the card.
   */
  commercialTimeline?: CommercialTimelineEvent[];
};

/* ─── Main export ───────────────────────────────────────────────────────────── */

export function ApprovalCentreParticipantCard({
  participant,
  id,
  isHighlighted = false,
  'data-approval-card': dataApprovalCard,
  'data-pending': dataPending,
  onShareAgreement,
  onConfigureEarnings,
  onSendPaymentRequest,
  projectId,
  organizationId,
  workspaceCurrency = 'AUD',
  releaseReady = false,
  canRelease = false,
  releaseDisabledReason,
  accountingReconciliation,
  releaseSyncHandlers,
  commercialTimeline,
}: ApprovalCentreParticipantCardProps) {
  const entity = React.useMemo(
    () => participantEntity(hydrateParticipant(participant)),
    [participant]
  );

  const workflow = deriveParticipantOperationalWorkflow(entity);
  const roleLabel = operationalRoleLabel(entity);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hydrated = hydrateParticipant(participant) as any;
  const earningsModel: string | null =
    hydrated?.compensation?.earningsPrimaryCompact ?? null;

  const lastActivity = React.useMemo(() => deriveLastActivity(participant), [participant]);

  const agreementPath = participant.agreementUrl ?? participantAgreementPath(participant.inviteToken);
  const fullAgreementUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}${agreementPath}`
      : agreementPath;

  const renderCta = (cta: ParticipantWorkflowCta, secondary = false) => {
    const variant = secondary ? 'outline' : cta.buttonVariant;
    const className = secondary
      ? 'h-7 px-3 text-xs gap-1 text-muted-foreground hover:text-foreground'
      : 'h-7 px-3 text-xs font-medium bg-foreground hover:bg-foreground/90 text-background gap-1';

    switch (cta.destination) {
      case 'configure_earnings':
        return (
          <Button
            key={cta.kind}
            type="button"
            variant={variant}
            size="sm"
            className={className}
            onClick={() => onConfigureEarnings(entity)}
          >
            {cta.label}
            {!secondary ? <ArrowRight className="h-3 w-3" /> : null}
          </Button>
        );
      case 'send_agreement':
        return (
          <SendApprovalSheet
            key={cta.kind}
            participant={entity}
            fullAgreementUrl={fullAgreementUrl}
            onShareAgreement={() => onShareAgreement(entity, { showDialog: false })}
            label={cta.label}
          />
        );
      case 'send_payment_request':
        return (
          <Button
            key={cta.kind}
            type="button"
            variant={variant}
            size="sm"
            className={className}
            onClick={() => onSendPaymentRequest?.(entity)}
            disabled={!onSendPaymentRequest}
          >
            {cta.label}
            {!secondary ? <ArrowRight className="h-3 w-3" /> : null}
          </Button>
        );
      case 'review_payment':
        return projectId ? (
          <Button key={cta.kind} asChild variant={variant} size="sm" className={className}>
            <Link href={projectOperatorReviewPath(projectId, entity.id)}>
              {cta.label}
              {!secondary ? <ArrowRight className="h-3 w-3" /> : null}
            </Link>
          </Button>
        ) : null;
      case 'xero_export':
        return projectId ? (
          <Button key={cta.kind} asChild variant={variant} size="sm" className={className}>
            <Link href={projectXeroExportPath(projectId)}>
              {cta.label}
              {!secondary ? <ArrowRight className="h-3 w-3" /> : null}
            </Link>
          </Button>
        ) : null;
      case 'settlement':
        return releaseSyncHandlers ? (
          <div key={cta.kind} className="space-y-2">
            {accountingReconciliation ? (
              <AccountingReconciliationCard reconciliation={accountingReconciliation} />
            ) : null}
            <ParticipantReleaseButton
              participantId={entity.id}
              participantName={entity.name}
              organizationId={organizationId}
              currency={workspaceCurrency}
              releaseReady={releaseReady}
              canRelease={canRelease && (accountingReconciliation?.releaseAllowed ?? true)}
              disabledReason={
                accountingReconciliation && !accountingReconciliation.releaseAllowed
                  ? accountingReconciliation.reason
                  : releaseDisabledReason
              }
              reconciliation={accountingReconciliation}
              syncHandlers={releaseSyncHandlers}
              className="h-7 px-3 text-xs font-medium gap-1 shrink-0"
              label={cta.label}
            />
          </div>
        ) : (
          <Badge key={cta.kind} variant="outline" className="h-7 px-3 text-xs">
            {cta.label}
          </Badge>
        );
      case 'await_participant':
      case 'none':
      default:
        return (
          <Badge
            key={cta.kind}
            variant="outline"
            className="h-7 px-3 text-xs border-amber-300/80 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-300"
          >
            {cta.label}
          </Badge>
        );
    }
  };

  return (
    <div
      id={id}
      data-approval-card={dataApprovalCard ? '' : undefined}
      data-pending={dataPending}
      className={cn(
        'rounded-lg border px-4 py-3 transition-colors duration-700',
        isHighlighted && 'bg-primary/5 border-primary/30',
        workflow.readiness === 'complete' && !isHighlighted
          ? 'border-[rgba(29,111,66,0.2)] bg-[rgba(29,111,66,0.015)]'
          : !isHighlighted && 'border-border/70 bg-card'
      )}
    >
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        {/* ── Left: identity ── */}
        <div className="flex items-start gap-3 flex-1 min-w-0">
          {/* Avatar */}
          <div
            className={cn(
              'h-9 w-9 rounded-full flex items-center justify-center shrink-0 text-sm font-semibold select-none',
              workflow.readiness === 'complete'
                ? 'bg-[rgba(29,111,66,0.12)] text-[rgb(29,111,66)]'
                : workflow.readiness === 'blocked'
                  ? 'bg-muted/60 text-muted-foreground/60'
                  : 'bg-muted text-muted-foreground'
            )}
            aria-hidden
          >
            {workflow.readiness === 'complete' ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              (participant.name?.[0] ?? '?').toUpperCase()
            )}
          </div>

          {/* Name · role · earnings · activity */}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground truncate leading-snug">
              {participant.name}
            </p>

            {/* Role · Earnings — compact metadata */}
            {(roleLabel || earningsModel) ? (
              <p className="text-xs text-muted-foreground/70 mt-0.5 truncate">
                {[roleLabel, earningsModel].filter(Boolean).join(' · ')}
              </p>
            ) : null}
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              {workflow.explanation}
            </p>
            {workflow.integrityIssues.length > 0 ? (
              <div className="mt-1 space-y-0.5">
                {workflow.integrityIssues.map((issue) => (
                  <p
                    key={`${issue.field}-${issue.message}`}
                    className="text-[11px] text-amber-700 dark:text-amber-300 leading-snug"
                  >
                    {issue.message}
                  </p>
                ))}
              </div>
            ) : null}

            {/* Last activity */}
            {lastActivity ? (
              <p className="text-[10px] text-muted-foreground/50 mt-0.5 tabular-nums">
                {lastActivity}
              </p>
            ) : null}
          </div>
        </div>

        {/* ── Status badge ── */}
        <div className="sm:w-44 shrink-0">
          <Badge
            variant="outline"
            className={cn('text-xs whitespace-nowrap font-medium', WORKFLOW_BADGE_CLASS[workflow.readiness])}
          >
            {workflow.badge}
          </Badge>
        </div>

        {/* ── Participant commercial journey (if timeline provided) ── */}
        {commercialTimeline && participant.id ? (
          <ParticipantCommercialHistory
            journey={buildParticipantCommercialJourney(commercialTimeline, participant.id)}
            className="sm:hidden"
          />
        ) : null}

        {/* ── Actions: one primary + optional more menu ── */}
        <div className="flex items-center gap-1.5 shrink-0 justify-end">
          {renderCta(workflow.primaryCta)}
          {workflow.secondaryCtas.map((cta) => renderCta(cta, true))}
        </div>
      </div>

      {/* Commercial relationship history — shown on md+ as a compact journey bar */}
      {commercialTimeline && participant.id ? (
        <ParticipantCommercialHistory
          journey={buildParticipantCommercialJourney(commercialTimeline, participant.id)}
          className="hidden sm:flex mt-2 pt-2 border-t border-border/30"
        />
      ) : null}
    </div>
  );
}
