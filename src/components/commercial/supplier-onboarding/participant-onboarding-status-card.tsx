'use client';

/**
 * ParticipantOnboardingStatusCard
 *
 * Stage-based status card driven by the commercial lifecycle state machine.
 * Never surfaces payout details before agreement acceptance.
 */

import * as React from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  ArrowRight,
  UserCircle,
  FileText,
  Send,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import { projectOperatorReviewPath } from '@/lib/projects/project-routes';
import {
  deriveParticipantCommercialLifecycle,
  deriveParticipantLifecycleAction,
  LIFECYCLE_STAGE_OPERATOR_LABELS,
  type ParticipantCommercialLifecycleStage,
} from '@/lib/commercial/participant-commercial-lifecycle';
import { ParticipantLifecycleTimeline } from '@/components/commercial/payment-tax/participant-lifecycle-timeline';

const STAGE_CONFIG: Record<
  ParticipantCommercialLifecycleStage,
  {
    icon: React.ReactNode;
    useReviewPath: boolean;
    ctaVariant: 'default' | 'outline' | 'ghost';
  }
> = {
  DRAFT: {
    icon: <FileText className="h-4 w-4 text-muted-foreground" />,
    useReviewPath: false,
    ctaVariant: 'default',
  },
  EARNINGS_CONFIGURED: {
    icon: <Send className="h-4 w-4 text-blue-600" />,
    useReviewPath: false,
    ctaVariant: 'default',
  },
  AGREEMENT_SENT: {
    icon: <Clock className="h-4 w-4 text-amber-500" />,
    useReviewPath: false,
    ctaVariant: 'outline',
  },
  AGREEMENT_ACCEPTED: {
    icon: <Clock className="h-4 w-4 text-amber-500" />,
    useReviewPath: false,
    ctaVariant: 'outline',
  },
  PAYMENT_INFO_PENDING: {
    icon: <Clock className="h-4 w-4 text-amber-500" />,
    useReviewPath: false,
    ctaVariant: 'outline',
  },
  PAYMENT_INFO_SUBMITTED: {
    icon: <AlertCircle className="h-4 w-4 text-amber-600" />,
    useReviewPath: true,
    ctaVariant: 'default',
  },
  OPERATOR_REVIEW: {
    icon: <AlertCircle className="h-4 w-4 text-amber-600" />,
    useReviewPath: true,
    ctaVariant: 'default',
  },
  XERO_INVOICE: {
    icon: <CheckCircle2 className="h-4 w-4 text-green-600" />,
    useReviewPath: true,
    ctaVariant: 'default',
  },
  SETTLEMENT_READY: {
    icon: <CheckCircle2 className="h-4 w-4 text-green-600" />,
    useReviewPath: true,
    ctaVariant: 'ghost',
  },
  PAID: {
    icon: <CheckCircle2 className="h-4 w-4 text-green-600" />,
    useReviewPath: true,
    ctaVariant: 'ghost',
  },
};

type ParticipantOnboardingStatusCardProps = {
  participant: DemoParticipant;
  projectId: string;
  onSendPaymentRequest?: (participant: DemoParticipant) => void;
  onSharePaymentRequest?: (participant: DemoParticipant) => void;
};

export function ParticipantOnboardingStatusCard({
  participant,
  projectId,
  onSendPaymentRequest,
  onSharePaymentRequest,
}: ParticipantOnboardingStatusCardProps) {
  const stage = deriveParticipantCommercialLifecycle(participant);
  const action = deriveParticipantLifecycleAction(participant);
  const config = STAGE_CONFIG[stage];
  const stageLabel = LIFECYCLE_STAGE_OPERATOR_LABELS[stage];

  const isComplete = stage === 'SETTLEMENT_READY' || stage === 'PAID';
  const isRejected = participant.supplierOnboarding?.rejection != null;

  const ctaHref = projectOperatorReviewPath(projectId, participant.id);

  return (
    <div
      className={cn(
        'flex items-start justify-between gap-4 rounded-lg border px-4 py-3',
        isComplete
          ? 'border-green-200 bg-green-50/40 dark:border-green-900/40 dark:bg-green-950/20'
          : isRejected
          ? 'border-red-200 bg-red-50/30 dark:border-red-900/40 dark:bg-red-950/10'
          : stage === 'OPERATOR_REVIEW' || stage === 'PAYMENT_INFO_SUBMITTED'
          ? 'border-amber-200 bg-amber-50/30 dark:border-amber-900/40 dark:bg-amber-950/10'
          : 'bg-card'
      )}
    >
      <div className="flex items-start gap-3 min-w-0 flex-1">
        <div className="mt-0.5 shrink-0">
          <UserCircle className="h-8 w-8 text-muted-foreground/60" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold truncate">{participant.name}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            {isRejected ? (
              <XCircle className="h-4 w-4 text-red-500" />
            ) : (
              config.icon
            )}
            <span className="text-xs font-medium text-muted-foreground">{stageLabel}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{action.description}</p>
          <div className="mt-3 max-w-md">
            <ParticipantLifecycleTimeline participant={participant} compact={false} />
          </div>
        </div>
      </div>

      <div className="shrink-0 flex items-center gap-2">
        {action.destination === 'send_payment_request' && onSendPaymentRequest ? (
          <Button
            type="button"
            size="sm"
            variant={config.ctaVariant}
            className="whitespace-nowrap"
            onClick={() => onSendPaymentRequest(participant)}
          >
            {action.label}
            <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
          </Button>
        ) : null}
        {action.destination === 'share_payment_request' && onSharePaymentRequest ? (
          <Button
            type="button"
            size="sm"
            variant={config.ctaVariant}
            className="whitespace-nowrap"
            onClick={() => onSharePaymentRequest(participant)}
          >
            {action.label}
            <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
          </Button>
        ) : null}
        {action.destination !== 'none' &&
        action.urgency !== 'none' &&
        action.destination !== 'send_payment_request' &&
        action.destination !== 'share_payment_request' ? (
          <Button asChild size="sm" variant={config.ctaVariant} className="whitespace-nowrap">
            <Link href={ctaHref}>
              {action.label}
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
