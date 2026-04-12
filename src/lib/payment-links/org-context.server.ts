/**
 * Shared org-level Payment Links context (rails + invoice count).
 * Server-only — used by onboarding status and nav activation API.
 */

import 'server-only';

import { prisma } from '@/lib/server/prisma';
import {
  computePaymentLinkRailSetup,
  type PaymentLinkRailSetupStatus,
} from '@/lib/payment-links/setup-status';

export type PaymentLinksOrgContext = {
  railSetup: PaymentLinkRailSetupStatus;
  paymentLinkCount: number;
};

export async function loadPaymentLinksOrgContext(
  organizationId: string
): Promise<PaymentLinksOrgContext> {
  const [merchant, paymentLinkCount] = await Promise.all([
    prisma.merchant_settings.findFirst({
      where: { organization_id: organizationId },
      select: {
        stripe_account_id: true,
        hedera_account_id: true,
        wise_enabled: true,
        wise_profile_id: true,
      },
    }),
    prisma.payment_links.count({
      where: { organization_id: organizationId },
    }),
  ]);

  const railSetup = computePaymentLinkRailSetup(merchant);

  return { railSetup, paymentLinkCount };
}
