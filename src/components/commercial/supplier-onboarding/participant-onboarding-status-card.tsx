'use client';

/**
 * ParticipantOnboardingStatusCard
 *
 * Inline onboarding status card for the Participants page.
 * Uses available participant fields (payoutOnboardingPhase, onboardingStatus)
 * to render a clear, actionable status without requiring the full engine output.
 *
 * For the detailed operator review (ABN, invoice, bank details), the CTA
 * routes to the dedicated review URL via resolveCommercialWorkflowDestination().
 */

import * as React from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  ArrowRight,
  UserCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import { projectOperatorReviewPath, projectSupplierOnboardingPath } from '@/lib/projects/project-routes';

type OnboardingPhase = 'NOT_STARTED' | 'INVITED' | 'IN_PROGRESS' | 'COMPLETED';

function derivePhase(participant: DemoParticipant): OnboardingPhase {
  if (
    participant.payoutVerificationConfirmed === true ||
    participant.payoutOnboardingPhase === 'COMPLETED' ||
    participant.onboardingStatus === 'COMPLETE'
  ) {
    return 'COMPLETED';
  }
  if (participant.payoutOnboardingPhase === 'IN_PROGRESS' || participant.onboardingStatus === 'INCOMPLETE') {
    return 'IN_PROGRESS';
  }
  if (participant.payoutOnboardingPhase === 'INVITED') {
    return 'INVITED';
  }
  return 'NOT_STARTED';
}

const PHASE_CONFIG: Record<
  OnboardingPhase,
  { label: string; detail: string; icon: React.ReactNode; ctaLabel: string; ctaVariant: 'default' | 'outline' | 'ghost' }
> = {
  NOT_STARTED: {
    label: 'Not started',
    detail: 'Bank details, ABN, and GST status are required before settlement.',
    icon: <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/40" />,
    ctaLabel: 'Initiate onboarding',
    ctaVariant: 'default',
  },
  INVITED: {
    label: 'Link sent',
    detail: 'Onboarding link has been sent — awaiting supplier submission.',
    icon: <Clock className="h-4 w-4 text-amber-500" />,
    ctaLabel: 'Send reminder',
    ctaVariant: 'outline',
  },
  IN_PROGRESS: {
    label: 'In progress',
    detail: 'The supplier is currently completing onboarding.',
    icon: <Clock className="h-4 w-4 text-amber-500" />,
    ctaLabel: 'View progress',
    ctaVariant: 'outline',
  },
  COMPLETED: {
    label: 'Complete',
    detail: 'Supplier details confirmed. Ready for settlement.',
    icon: <CheckCircle2 className="h-4 w-4 text-green-600" />,
    ctaLabel: 'View record',
    ctaVariant: 'ghost',
  },
};

type ParticipantOnboardingStatusCardProps = {
  participant: DemoParticipant;
  projectId: string;
};

/**
 * Inline status card showing one participant's supplier onboarding state.
 * Appears in the Participants page when the workflow is in 'preparing-payments' stage.
 */
export function ParticipantOnboardingStatusCard({
  participant,
  projectId,
}: ParticipantOnboardingStatusCardProps) {
  const phase = derivePhase(participant);
  const config = PHASE_CONFIG[phase];
  const isComplete = phase === 'COMPLETED';

  // Route submitted participants to the operator review, others to the onboarding overview
  const ctaHref =
    phase === 'IN_PROGRESS' || phase === 'COMPLETED'
      ? projectOperatorReviewPath(projectId, participant.id)
      : projectSupplierOnboardingPath(projectId, participant.id);

  return (
    <div
      className={cn(
        'flex items-start justify-between gap-4 rounded-lg border px-4 py-3',
        isComplete
          ? 'border-green-200 bg-green-50/40 dark:border-green-900/40 dark:bg-green-950/20'
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
        {!isComplete && (
          <AlertCircle className="h-4 w-4 text-amber-500 hidden sm:block" aria-hidden />
        )}
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
