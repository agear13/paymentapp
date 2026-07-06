/**
 * Shared org-level Payment Links context (rails + invoice count).
 * Server-only — used by onboarding status and nav activation API.
 */

import 'server-only';

import { prisma } from '@/lib/server/prisma';
import config from '@/lib/config/env';
import {
  computePaymentLinkRailSetup,
  type PaymentLinkRailSetupStatus,
  type PaymentRailPlatformFeatures,
} from '@/lib/payment-links/setup-status';

function serverPaymentRailPlatformFeatures(): PaymentRailPlatformFeatures {
  return {
    wisePayments: config.features.wisePayments,
    evmWalletPayments: config.features.evmWalletPayments,
  };
}

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
        evm_wallet_enabled: true,
        evm_wallet_address: true,
        evm_supported_networks: true,
        evm_supported_tokens: true,
        wise_enabled: true,
        wise_profile_id: true,
      },
    }),
    prisma.payment_links.count({
      where: { organization_id: organizationId },
    }),
  ]);

  const railSetup = computePaymentLinkRailSetup(
    merchant,
    serverPaymentRailPlatformFeatures()
  );

  return { railSetup, paymentLinkCount };
}
