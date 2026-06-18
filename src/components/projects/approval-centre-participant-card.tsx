'use client';

/**
 * Approval Centre Participant Card
 *
 * Action-driven per-participant card. Designed to answer within 2 seconds:
 *   3. Who is blocking it?
 *   4. What should I do next?
 *   5. Can I complete that action from this page?
 *
 * Each card surfaces:
 *   - Participant identity (name, email, role)
 *   - Earnings model (so the operator can confirm correct terms without navigating away)
 *   - Last activity timestamp (derived from persisted timestamps only)
 *   - Operational status badge with clear colour semantics:
 *       Green  → Approved
 *       Amber  → Waiting for approval (sent, not yet approved)
 *       Blue   → Ready to send (link exists, not yet sent)
 *       Grey   → Needs earnings configured
 *   - Exactly ONE primary action based on the agreement lifecycle state
 *
 * Primary action state machine (persisted data only — no optimistic state):
 *
 *   Earnings not configured → "Configure earnings"
 *   NOT_CREATED / DRAFTED   → "Send approval"  (action sheet)
 *   GENERATED               → "Send approval"  (action sheet)
 *   SHARED / VIEWED         → "Send approval"  (action sheet — resend context)
 *   SIGNED                  → "View agreement"
 *   APPROVED                → "View agreement"
 *
 * "Send approval" opens an action sheet (Popover) with:
 *   Copy approval link · Email participant · WhatsApp · QR code
 *
 * No completion logic lives here.
 * All state derives from deriveAgreementLifecycleState() (persisted backend fields).
 */

import * as React from 'react';
import {
  CheckCircle2,
  ChevronDown,
  Copy,
  ExternalLink,
  Mail,
  MessageCircle,
  QrCode,
  Send,
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
import {
  deriveAgreementLifecycleState,
  type AgreementLifecycleState,
} from '@/lib/operations/lifecycle/agreement-lifecycle';
import { participantAgreementPath } from '@/lib/projects/participant-entitlement';
import {
  hydrateParticipant,
  participantEntity,
} from '@/lib/operations/hydration/hydrate-participant';
import { isParticipantEarningsConfigured } from '@/lib/operations/selectors/participant-earnings-selectors';
import { operationalRoleLabel } from '@/lib/projects/participants-for-project';
import { cn } from '@/lib/utils';

/* ─── Operational status labels & colours ─────────────────────────────────── */

/**
 * Maps lifecycle state → human-readable operational label.
 * Avoids internal state names — operators speak in operational terms.
 */
function operationalStatusLabel(
  lifecycle: AgreementLifecycleState,
  earningsConfigured: boolean
): string {
  if (!earningsConfigured) return 'Needs earnings configured';
  switch (lifecycle) {
    case 'APPROVED': return 'Approved';
    case 'SIGNED':   return 'Signed — awaiting review';
    case 'VIEWED':   return 'Viewed — awaiting approval';
    case 'SHARED':   return 'Waiting for approval';
    case 'GENERATED':
    case 'DRAFTED':
    case 'NOT_CREATED':
    default:         return 'Ready to send';
  }
}

/** Colour class set for the status badge */
function statusBadgeClass(
  lifecycle: AgreementLifecycleState,
  earningsConfigured: boolean
): string {
  if (!earningsConfigured) {
    return 'border-border text-muted-foreground bg-muted/40';
  }
  switch (lifecycle) {
    case 'APPROVED':
      return 'border-transparent bg-[rgb(29,111,66)] text-white hover:bg-[rgb(29,111,66)]';
    case 'SIGNED':
    case 'VIEWED':
    case 'SHARED':
      return 'border-amber-300/70 text-amber-700 bg-amber-50/80 dark:bg-amber-950/40 dark:text-amber-300';
    case 'GENERATED':
    case 'DRAFTED':
    case 'NOT_CREATED':
    default:
      return 'border-blue-300/70 text-blue-700 bg-blue-50/80 dark:bg-blue-950/40 dark:text-blue-300';
  }
}

/* ─── Last activity ────────────────────────────────────────────────────────── */

/**
 * Derives a human-readable last activity string from persisted timestamps.
 * Returns null when no activity has been recorded.
 */
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
  if (p.agreementViewedAt) return `Viewed ${ago(p.agreementViewedAt) ?? ''}`;
  if (p.agreementSharedAt) return `Sent ${ago(p.agreementSharedAt) ?? ''}`;
  if (p.inviteSentAt) return `Invited ${ago(p.inviteSentAt) ?? ''}`;
  return null;
}

/* ─── Send approval action sheet ──────────────────────────────────────────── */

type SendApprovalSheetProps = {
  participant: DemoParticipant;
  agreementUrl: string;
  fullAgreementUrl: string;
  onResend: () => void;
  isResend: boolean;
};

function SendApprovalSheet({
  participant,
  agreementUrl,
  fullAgreementUrl,
  onResend,
  isResend,
}: SendApprovalSheetProps) {
  const [open, setOpen] = React.useState(false);
  const qrHref = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(fullAgreementUrl)}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fullAgreementUrl);
      toast.success('Approval link copied');
      setOpen(false);
    } catch {
      toast.error('Could not copy — try right-clicking the link instead.');
    }
  };

  const handleEmail = () => {
    if (!participant.email?.trim()) {
      toast.error('No email address on file for this participant.');
      return;
    }
    const subject = encodeURIComponent('Your participation agreement');
    const body = encodeURIComponent(
      `Hi ${participant.name},\n\nPlease review and approve your participation agreement:\n${fullAgreementUrl}\n\nThis should only take a few minutes.`
    );
    window.location.href = `mailto:${participant.email.trim()}?subject=${subject}&body=${body}`;
    setOpen(false);
  };

  const handleWhatsApp = () => {
    const text = encodeURIComponent(
      `Hi ${participant.name}, please review and approve your participation agreement: ${fullAgreementUrl}`
    );
    window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener,noreferrer');
    setOpen(false);
  };

  const handleQr = () => {
    window.open(qrHref, '_blank', 'noopener,noreferrer');
    setOpen(false);
  };

  const handleResend = () => {
    onResend();
    setOpen(false);
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
          {isResend ? 'Resend approval' : 'Send approval'}
          <ChevronDown className="h-3 w-3 ml-0.5 opacity-70" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-52 p-1.5 shadow-md"
        sideOffset={4}
      >
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-2 py-1.5">
          {isResend ? 'Resend via' : 'Send via'}
        </p>

        <button
          type="button"
          className="flex items-center gap-2.5 w-full px-2 py-1.5 text-xs rounded-sm hover:bg-accent text-foreground transition-colors"
          onClick={() => void handleCopy()}
        >
          <Copy className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          Copy approval link
        </button>

        <button
          type="button"
          className="flex items-center gap-2.5 w-full px-2 py-1.5 text-xs rounded-sm hover:bg-accent text-foreground transition-colors"
          onClick={handleEmail}
        >
          <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          Email participant
        </button>

        <button
          type="button"
          className="flex items-center gap-2.5 w-full px-2 py-1.5 text-xs rounded-sm hover:bg-accent text-foreground transition-colors"
          onClick={handleWhatsApp}
        >
          <MessageCircle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          WhatsApp
        </button>

        <button
          type="button"
          className="flex items-center gap-2.5 w-full px-2 py-1.5 text-xs rounded-sm hover:bg-accent text-foreground transition-colors"
          onClick={handleQr}
        >
          <QrCode className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          Generate QR code
        </button>

        {isResend ? (
          <>
            <div className="my-1 h-px bg-border/50" />
            <button
              type="button"
              className="flex items-center gap-2.5 w-full px-2 py-1.5 text-xs rounded-sm hover:bg-accent text-foreground transition-colors"
              onClick={handleResend}
            >
              <Send className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              Open share dialog
            </button>
          </>
        ) : null}
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
  /**
   * Opens the full share dialog (generates link if needed + shows share modal).
   * Entitlement check lives in the parent.
   */
  onShareAgreement: (p: DemoParticipant) => void;
  onConfigureEarnings: (p: DemoParticipant) => void;
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
}: ApprovalCentreParticipantCardProps) {
  const lifecycle = deriveAgreementLifecycleState(participant);

  const entity = React.useMemo(
    () => participantEntity(hydrateParticipant(participant)),
    [participant]
  );

  const earningsConfigured = isParticipantEarningsConfigured(entity);
  const roleLabel = operationalRoleLabel(entity);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hydrated = hydrateParticipant(participant) as any;
  const earningsModel: string | null =
    hydrated?.compensation?.earningsPrimaryCompact ?? null;

  const lastActivity = React.useMemo(() => deriveLastActivity(participant), [participant]);

  const agreementPath =
    participant.agreementUrl ?? participantAgreementPath(participant.inviteToken);
  const fullAgreementUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}${agreementPath}`
      : agreementPath;

  const referralUrl =
    participant.referralCode && typeof window !== 'undefined'
      ? `${window.location.origin}/r/${participant.referralCode}`
      : null;

  const handleViewAgreement = React.useCallback(() => {
    const preview = agreementPath.includes('?')
      ? `${agreementPath}&mode=preview`
      : `${agreementPath}?mode=preview`;
    window.open(preview, '_blank', 'noopener,noreferrer');
  }, [agreementPath]);

  const handleCopyReferralLink = React.useCallback(async () => {
    if (!referralUrl) return;
    try {
      await navigator.clipboard.writeText(referralUrl);
      toast.success('Referral link copied');
    } catch {
      toast.error('Could not copy link');
    }
  }, [referralUrl]);

  /* ─── Derived display values ─── */

  const statusLabel = operationalStatusLabel(lifecycle, earningsConfigured);
  const badgeClass = statusBadgeClass(lifecycle, earningsConfigured);
  const isApproved = lifecycle === 'APPROVED';
  const needsSend =
    earningsConfigured &&
    (lifecycle === 'NOT_CREATED' ||
      lifecycle === 'DRAFTED' ||
      lifecycle === 'GENERATED' ||
      lifecycle === 'SHARED' ||
      lifecycle === 'VIEWED');
  const isResend = lifecycle === 'SHARED' || lifecycle === 'VIEWED';

  return (
    <div
      id={id}
      data-approval-card={dataApprovalCard ? '' : undefined}
      data-pending={dataPending}
      className={cn(
        'rounded-lg border px-4 py-3 transition-colors duration-700',
        isHighlighted && 'bg-primary/5 border-primary/30',
        isApproved && !isHighlighted
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
              isApproved
                ? 'bg-[rgba(29,111,66,0.12)] text-[rgb(29,111,66)]'
                : !earningsConfigured
                  ? 'bg-muted/60 text-muted-foreground/60'
                  : 'bg-muted text-muted-foreground'
            )}
            aria-hidden
          >
            {isApproved ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              (participant.name?.[0] ?? '?').toUpperCase()
            )}
          </div>

          {/* Name + email + role + earnings + activity */}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground truncate leading-snug">
              {participant.name}
            </p>
            {participant.email ? (
              <p className="text-xs text-muted-foreground truncate">{participant.email}</p>
            ) : null}

            {/* Role · Earnings — inline metadata row */}
            {(roleLabel || earningsModel) ? (
              <p className="text-xs text-muted-foreground/70 mt-0.5 truncate">
                {[roleLabel, earningsModel].filter(Boolean).join(' · ')}
              </p>
            ) : null}

            {/* Last activity */}
            {lastActivity ? (
              <p className="text-[10px] text-muted-foreground/50 mt-0.5 tabular-nums">
                {lastActivity}
              </p>
            ) : null}
          </div>
        </div>

        {/* ── Middle: status badge ── */}
        <div className="sm:w-44 shrink-0">
          <Badge
            variant="outline"
            className={cn('text-xs whitespace-nowrap font-medium', badgeClass)}
          >
            {statusLabel}
          </Badge>
        </div>

        {/* ── Right: actions ── */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap sm:justify-end shrink-0">
          {!earningsConfigured ? (
            <Button
              type="button"
              size="sm"
              className="h-7 px-3 text-xs font-medium bg-foreground hover:bg-foreground/90 text-background"
              onClick={() => onConfigureEarnings(participant)}
            >
              Configure earnings
            </Button>
          ) : needsSend ? (
            <SendApprovalSheet
              participant={participant}
              agreementUrl={agreementPath}
              fullAgreementUrl={fullAgreementUrl}
              onResend={() => onShareAgreement(participant)}
              isResend={isResend}
            />
          ) : lifecycle === 'SIGNED' ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-2.5 text-xs gap-1"
                onClick={() => onShareAgreement(participant)}
              >
                <Send className="h-3 w-3" />
                Resend
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-2.5 text-xs gap-1"
                onClick={handleViewAgreement}
              >
                <ExternalLink className="h-3 w-3" />
                View agreement
              </Button>
            </>
          ) : (
            // APPROVED
            <>
              {referralUrl ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2.5 text-xs gap-1"
                  onClick={() => void handleCopyReferralLink()}
                >
                  <Copy className="h-3 w-3" />
                  Referral link
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-2.5 text-xs gap-1"
                onClick={handleViewAgreement}
              >
                <ExternalLink className="h-3 w-3" />
                View agreement
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
