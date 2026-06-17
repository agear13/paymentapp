'use client';

import { ContextualAIGuide } from '@/components/operations/contextual-ai-guide';
import type { OperationalGuidanceBundle } from '@/lib/operations/explainability/types';
import type { OperationalKPIs } from '@/lib/operations/reducer/types';

export type ProjectPageCopilotPage = 'money' | 'people' | 'history';

type ProjectPageCopilotProps = {
  page: ProjectPageCopilotPage;
  guidance?: OperationalGuidanceBundle | null;
  kpis?: OperationalKPIs | null;
};

/* ─── Per-page guidance derivation ─── */

type Guidance = {
  message: string;
  action?: { label: string; href: string };
  tone?: 'default' | 'positive' | 'muted';
};

function deriveMoney(
  guidance?: OperationalGuidanceBundle | null
): Guidance {
  const actions = guidance?.actions ?? [];
  const primaryAction = actions[0];

  const isPaymentProviderAction =
    primaryAction &&
    /connect stripe|payment provider|stripe|merchant/i.test(
      primaryAction.action + ' ' + (primaryAction.reason ?? '')
    );

  if (isPaymentProviderAction) {
    return {
      message:
        'Connecting your payment provider will unlock customer payments and allow revenue to flow.',
      action: primaryAction.destination
        ? { label: 'Connect provider', href: primaryAction.destination }
        : { label: 'Connect provider', href: '/dashboard/settings/merchant#payment-rails' },
      tone: 'default',
    };
  }

  const isFundingAction =
    primaryAction &&
    /funding|revenue|invoice|payment link/i.test(
      primaryAction.action + ' ' + (primaryAction.reason ?? '')
    );

  if (isFundingAction) {
    return {
      message: 'Add a funding source or payment link so customers can begin paying.',
      action: primaryAction.destination
        ? { label: 'Add funding', href: primaryAction.destination }
        : undefined,
      tone: 'default',
    };
  }

  const isObligationAction =
    primaryAction &&
    /obligation|allocation|payout/i.test(
      primaryAction.action + ' ' + (primaryAction.reason ?? '')
    );

  if (isObligationAction) {
    return {
      message:
        'Review payment obligations to confirm how revenue is distributed before settlement.',
      action: primaryAction.destination
        ? { label: 'Review obligations', href: primaryAction.destination }
        : undefined,
      tone: 'default',
    };
  }

  // No blocking action — payment is on track
  return {
    message: 'Payment setup is on track. Revenue can flow once the agreement is fully prepared.',
    tone: 'positive',
  };
}

function derivePeople(
  guidance?: OperationalGuidanceBundle | null,
  kpis?: OperationalKPIs | null
): Guidance {
  const participantCount = kpis?.participantCount ?? 0;
  const approvedCount = kpis?.approvedAgreementCount ?? 0;
  const pendingCount = participantCount - approvedCount;

  if (participantCount === 0) {
    return {
      message:
        'Add your first team member to begin preparing for payouts. Approvals unlock settlement.',
      tone: 'default',
    };
  }

  if (pendingCount > 0) {
    const actions = guidance?.actions ?? [];
    const approvalAction = actions.find((a) =>
      /approval|invite|send|participant/i.test(a.action + ' ' + (a.reason ?? ''))
    );
    return {
      message:
        pendingCount === 1
          ? 'One team member still needs to approve before payouts can be released.'
          : `${pendingCount} team members still need to approve before payouts can be released.`,
      action: approvalAction?.destination
        ? { label: 'Request approvals', href: approvalAction.destination }
        : undefined,
      tone: 'default',
    };
  }

  return {
    message: 'All team members have approved. Payouts are unlocked.',
    tone: 'positive',
  };
}

function deriveHistory(): Guidance {
  return {
    message:
      'Nothing needs your attention here. This page records business milestones for this agreement.',
    tone: 'muted',
  };
}

/* ─── Component ─── */

/**
 * Per-agreement-page copilot guidance banner.
 * Keeps Provvy present after the dashboard — operators never lose context.
 *
 * Usage:
 *   <ProjectPageCopilot page="money" guidance={guidance} />
 *   <ProjectPageCopilot page="people" guidance={guidance} kpis={kpis} />
 *   <ProjectPageCopilot page="history" />
 */
export function ProjectPageCopilot({
  page,
  guidance,
  kpis,
}: ProjectPageCopilotProps) {
  let derived: Guidance;

  if (page === 'money') {
    derived = deriveMoney(guidance);
  } else if (page === 'people') {
    derived = derivePeople(guidance, kpis);
  } else {
    derived = deriveHistory();
  }

  return (
    <ContextualAIGuide
      message={derived.message}
      action={derived.action}
      tone={derived.tone ?? 'default'}
    />
  );
}
