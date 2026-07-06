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

  const defaultCurrencyConfigured = Boolean(merchant?.default_currency?.trim());
  const revenueCollectionReady =
    railSetup.anyRailConfigured ||
    paymentLinkCount > 0 ||
    (onboardingState?.collection_preference != null &&
      onboardingState.collection_preference !== 'decide_later');
  const workspaceActivated = onboardingState?.completed === true;

  return [
    {
      id: 'payment_rail',
      label: 'Payment rail configured',
      complete: railSetup.anyRailConfigured,
    },
    {
      id: 'currency',
      label: 'Default currency configured',
      complete: defaultCurrencyConfigured,
    },
    {
      id: 'revenue',
      label: 'Agreement ready for settlement',
      complete: revenueCollectionReady,
    },
    {
      id: 'workspace',
      label: 'Workspace activated',
      complete: workspaceActivated,
    },
  ];
}
