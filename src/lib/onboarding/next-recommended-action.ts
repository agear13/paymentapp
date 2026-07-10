import { PRODUCT_TERMINOLOGY } from '@/lib/product/product-terminology';
import type { WorkspaceActivationSnapshot } from '@/lib/onboarding/workspace-activation-types';
import { PAYOUTS_OBLIGATIONS_HREF, PAYOUTS_SETTLEMENTS_HREF } from '@/lib/navigation/operator-nav';
import { projectParticipantsPath } from '@/lib/projects/project-routes';

export type NextRecommendedAction = {
  id: string;
  title: string;
  description: string;
  href: string;
  ctaLabel: string;
  blockers?: string[];
  /** When true, show guidance text only (no duplicate CTA button) */
  instructionalOnly?: boolean;
};

function participantsManagementHref(activation: WorkspaceActivationSnapshot): string {
  if (activation.primaryProjectId) {
    return projectParticipantsPath(activation.primaryProjectId);
  }
  return '/dashboard/projects';
}

export function deriveNextRecommendedAction(
  activation: WorkspaceActivationSnapshot
): NextRecommendedAction {
  if (!activation.workspaceCreated) {
    return {
      id: 'workspace',
      title: 'Create your workspace',
      description:
        'Set up your workspace name and default currency to begin coordinating economic relationships.',
      href: '/onboarding',
      ctaLabel: 'Continue setup',
    };
  }

  if (!activation.projectCreated) {
    return {
      id: 'project',
      title: 'Create your first project',
      description: 'Projects organize participants, commercial terms, obligations, and settlement.',
      href: '/onboarding',
      ctaLabel: PRODUCT_TERMINOLOGY.createProject,
    };
  }

  if (activation.participantCount === 0) {
    return {
      id: 'participants',
      title: 'Add participants to your project',
      description: 'Participants define who participates in revenue and settlement coordination.',
      href: participantsManagementHref(activation),
      ctaLabel: 'Add participants',
    };
  }

  if (!activation.participantsConfigured) {
    return {
      id: 'compensation',
      title: 'Configure participant earnings',
      description:
        'Define how each participant gets paid before tracking obligations and settlement readiness.',
      href: participantsManagementHref(activation),
      ctaLabel: 'Configure earnings',
      blockers: activation.activationBlockers,
    };
  }

  if (!activation.providerConnected) {
    return {
      id: 'provider',
      title: 'Connect your first payment provider',
      description: 'Connect Stripe or another provider to collect revenue into your workspace.',
      href: '/dashboard/settings/merchant?onboarding=continue#payment-rails',
      ctaLabel: 'Set up payment rails',
      blockers: activation.activationBlockers,
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

  if (!activation.obligationsCreated) {
    return {
      id: 'obligations',
      title: 'Add your first obligation',
      description:
        'Record what participants are owed now that earnings structures and collection are in place.',
      href: PAYOUTS_OBLIGATIONS_HREF,
      ctaLabel: 'Add obligation',
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

  return {
    id: 'review',
    title: 'Review settlement readiness',
    description: 'Check funding, compensation, and participant setup before your next release.',
    href: PAYOUTS_OBLIGATIONS_HREF,
    ctaLabel: 'Review obligations',
  };
}

/** Merchant settings: provider form is on-page — avoid duplicate CTA */
export function deriveMerchantSettingsNextAction(
  activation: WorkspaceActivationSnapshot
): NextRecommendedAction | null {
  const base = deriveNextRecommendedAction(activation);
  if (base.id === 'provider') {
    return {
      ...base,
      instructionalOnly: true,
      description:
        'Complete provider setup in the form below. Stripe, Wise, and Hedera connect here.',
    };
  }
  return base;
}
