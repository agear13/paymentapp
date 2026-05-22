import type { WorkspaceActivationSnapshot } from '@/lib/onboarding/workspace-activation-types';
import { PAYOUTS_OBLIGATIONS_HREF, PAYOUTS_SETTLEMENTS_HREF } from '@/lib/navigation/operator-nav';

export type NextRecommendedAction = {
  id: string;
  title: string;
  description: string;
  href: string;
  ctaLabel: string;
  blockers?: string[];
};

export function deriveNextRecommendedAction(
  activation: WorkspaceActivationSnapshot
): NextRecommendedAction {
  if (!activation.workspaceCreated) {
    return {
      id: 'workspace',
      title: 'Create your workspace',
      description: 'Set up your workspace name and default currency to begin coordinating payouts.',
      href: '/onboarding',
      ctaLabel: 'Continue setup',
    };
  }

  if (!activation.projectCreated) {
    return {
      id: 'project',
      title: 'Create your first project',
      description: 'Projects organize participants, obligations, revenue, and payout releases.',
      href: '/onboarding',
      ctaLabel: 'Create project',
    };
  }

  if (!activation.providerConnected) {
    return {
      id: 'provider',
      title: 'Connect your first payment provider',
      description: 'Connect Stripe or another provider to collect revenue into your workspace.',
      href: '/dashboard/settings/merchant?onboarding=continue',
      ctaLabel: 'Connect provider',
      blockers: activation.activationBlockers,
    };
  }

  if (!activation.obligationsCreated) {
    return {
      id: 'obligations',
      title: 'Add your first obligation',
      description: 'Record what participants are owed so payout readiness can be tracked.',
      href: PAYOUTS_OBLIGATIONS_HREF,
      ctaLabel: 'Review obligations',
    };
  }

  if (!activation.revenueConfigured) {
    return {
      id: 'revenue',
      title: 'Create your first revenue entry',
      description: 'Issue an invoice or payment link to start collecting customer payments.',
      href: '/dashboard/payment-links',
      ctaLabel: 'Create revenue entry',
    };
  }

  if (activation.releaseEligible) {
    return {
      id: 'release',
      title: 'Create payout release batch',
      description: `${activation.releaseEligibleCount} payout${activation.releaseEligibleCount === 1 ? '' : 's'} ready for release.`,
      href: PAYOUTS_SETTLEMENTS_HREF,
      ctaLabel: 'Create release batch',
    };
  }

  if (activation.participantCount === 0) {
    return {
      id: 'participants',
      title: 'Add participants to your project',
      description: 'Participants define who receives payouts from your workspace.',
      href: '/dashboard/projects',
      ctaLabel: 'Add participants',
    };
  }

  return {
    id: 'review',
    title: 'Review settlement readiness',
    description: 'Check funding, approvals, and participant setup before your next release.',
    href: PAYOUTS_OBLIGATIONS_HREF,
    ctaLabel: 'Review obligations',
  };
}
