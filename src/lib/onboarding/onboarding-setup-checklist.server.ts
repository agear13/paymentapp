import 'server-only';

import { prisma } from '@/lib/server/prisma';
import { loadPaymentLinksOrgContext } from '@/lib/payment-links/org-context.server';
import { getOperatorOnboardingState } from '@/lib/onboarding/operator-onboarding.server';

export type OnboardingSetupChecklistItem = {
  id: string;
  label: string;
  complete: boolean;
};

export async function getOnboardingSetupChecklist(
  organizationId: string
): Promise<OnboardingSetupChecklistItem[]> {
  const [merchant, onboardingState, { railSetup, paymentLinkCount }] = await Promise.all([
    prisma.merchant_settings.findFirst({
      where: { organization_id: organizationId },
      select: { default_currency: true },
    }),
    getOperatorOnboardingState(organizationId),
    loadPaymentLinksOrgContext(organizationId),
  ]);

  const stripeConnected = railSetup.stripeConfigured;
  const defaultCurrencyConfigured = Boolean(merchant?.default_currency?.trim());
  const revenueCollectionReady =
    railSetup.anyRailConfigured ||
    paymentLinkCount > 0 ||
    (onboardingState?.collection_preference != null &&
      onboardingState.collection_preference !== 'decide_later');
  const workspaceActivated = onboardingState?.completed === true;

  return [
    { id: 'stripe', label: 'Stripe connected', complete: stripeConnected },
    {
      id: 'currency',
      label: 'Default currency configured',
      complete: defaultCurrencyConfigured,
    },
    {
      id: 'revenue',
      label: 'Revenue collection ready',
      complete: revenueCollectionReady,
    },
    {
      id: 'workspace',
      label: 'Workspace activated',
      complete: workspaceActivated,
    },
  ];
}
