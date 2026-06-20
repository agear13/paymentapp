'use client';

/**
 * ParticipantOnboardingStatusCard
 *
 * Inline onboarding status card for the Participants page.
 * Routes to the dedicated supplier onboarding form or operator review page
 * depending on the participant's current stage.
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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import { projectOperatorReviewPath, projectSupplierOnboardingPath } from '@/lib/projects/project-routes';
import { deriveLifecycleStatus } from '@/lib/commercial/build-supplier-onboarding-input';
import type { SupplierOnboardingLifecycle } from '@/lib/commercial/supplier-onboarding-domain';

type DisplayPhase = 'NOT_STARTED' | 'IN_PROGRESS' | 'AWAITING_REVIEW' | 'APPROVED' | 'REJECTED';

function toDisplayPhase(lifecycle: SupplierOnboardingLifecycle): DisplayPhase {
  switch (lifecycle) {
    case 'APPROVED': return 'APPROVED';
    case 'REJECTED': return 'REJECTED';
    case 'SUBMITTED':
    case 'UNDER_REVIEW': return 'AWAITING_REVIEW';
    case 'IN_PROGRESS': return 'IN_PROGRESS';
    case 'INVITED': return 'IN_PROGRESS';
    default: return 'NOT_STARTED';
  }
}

const PHASE_CONFIG: Record<
  DisplayPhase,
  { label: string; detail: string; icon: React.ReactNode; ctaLabel: string; ctaVariant: 'default' | 'outline' | 'ghost'; useReviewPath: boolean }
> = {
  NOT_STARTED: {
    label: 'Payment details requested',
    detail: 'Bank details, ABN, and GST status are required before settlement.',
    icon: <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/40" />,
    ctaLabel: 'Prepare for payment',
    ctaVariant: 'default',
    useReviewPath: false,
  },
  IN_PROGRESS: {
    label: 'Waiting for payment information',
    detail: 'Supplier is completing their payment information.',
    icon: <Clock className="h-4 w-4 text-amber-500" />,
    ctaLabel: 'Continue payment setup',
    ctaVariant: 'outline',
    useReviewPath: false,
  },
  AWAITING_REVIEW: {
    label: 'Ready for review',
    detail: 'Payment information submitted — review and approve before Xero export.',
    icon: <AlertCircle className="h-4 w-4 text-amber-600" />,
    ctaLabel: 'Review payment information',
    ctaVariant: 'default',
    useReviewPath: true,
  },
  APPROVED: {
    label: 'Ready for accounting',
    detail: 'Payment information confirmed. Ready for Xero export.',
    icon: <CheckCircle2 className="h-4 w-4 text-green-600" />,
    ctaLabel: 'View record',
    ctaVariant: 'ghost',
    useReviewPath: true,
  },
  REJECTED: {
    label: 'Changes requested',
    detail: 'Operator has requested changes. Supplier can resubmit after corrections.',
    icon: <XCircle className="h-4 w-4 text-red-500" />,
    ctaLabel: 'View changes requested',
    ctaVariant: 'outline',
    useReviewPath: true,
  },
};

type ParticipantOnboardingStatusCardProps = {
  participant: DemoParticipant;
  projectId: string;
};

/**
 * Inline status card showing one participant's supplier onboarding state.
 * Appears in the Participants page supplier onboarding panel.
 */
export function ParticipantOnboardingStatusCard({
  participant,
  projectId,
}: ParticipantOnboardingStatusCardProps) {
  const lifecycle = deriveLifecycleStatus(participant);
  const phase = toDisplayPhase(lifecycle);
  const config = PHASE_CONFIG[phase];
  const isApproved = phase === 'APPROVED';
  const isRejected = phase === 'REJECTED';

  const ctaHref = config.useReviewPath
    ? projectOperatorReviewPath(projectId, participant.id)
    : projectOperatorReviewPath(projectId, participant.id); // H-1: always route operator to the review/prep screen

  return (
    <div
      className={cn(
        'flex items-start justify-between gap-4 rounded-lg border px-4 py-3',
        isApproved
          ? 'border-green-200 bg-green-50/40 dark:border-green-900/40 dark:bg-green-950/20'
          : isRejected
          ? 'border-red-200 bg-red-50/30 dark:border-red-900/40 dark:bg-red-950/10'
          : phase === 'AWAITING_REVIEW'
          ? 'border-amber-200 bg-amber-50/30 dark:border-amber-900/40 dark:bg-amber-950/10'
          : 'bg-card'
      )}
    >
      <div className="flex items-start gap-3 min-w-0">
        <div className="mt-0.5 shrink-0">
          <UserCircle className="h-8 w-8 text-muted-foreground/60" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">{participant.name}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            {config.icon}
            <span className="text-xs font-medium text-muted-foreground">{config.label}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{config.detail}</p>
        </div>
      </div>

      <div className="shrink-0 flex items-center gap-2">
        <Button asChild size="sm" variant={config.ctaVariant} className="whitespace-nowrap">
          <Link href={ctaHref}>
            {config.ctaLabel}
            <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>
    </div>
  );
}

