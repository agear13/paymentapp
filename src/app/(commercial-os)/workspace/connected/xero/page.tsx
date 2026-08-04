import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getUserOrganization } from '@/lib/auth/get-org';
import { prisma } from '@/lib/server/prisma';
import config from '@/lib/config/env';
import {
  computePaymentLinkRailSetup,
  isMultiCheckoutRailConfigured,
} from '@/lib/payment-links/setup-status';
import { WorkspaceXeroManageScreen } from '@/components/journey/lovable/workspace-xero-manage-screen';

export default async function WorkspaceXeroManagePage() {
  const org = await getUserOrganization();
  if (!org) {
    redirect('/onboarding');
  }

  const merchantSettings = await prisma.merchant_settings.findFirst({
    where: { organization_id: org.id },
    select: {
      stripe_account_id: true,
      hedera_account_id: true,
      evm_wallet_enabled: true,
      evm_wallet_address: true,
      evm_supported_networks: true,
      evm_supported_tokens: true,
      wise_profile_id: true,
      wise_enabled: true,
    },
  });

  const railSetup = computePaymentLinkRailSetup(merchantSettings, {
    wisePayments: config.features.wisePayments,
    evmWalletPayments: config.features.evmWalletPayments,
  });

  const stablecoinSettlementsEnabled = isMultiCheckoutRailConfigured(railSetup, 'hedera');

  return (
    <Suspense fallback={null}>
      <WorkspaceXeroManageScreen
        organizationId={org.id}
        merchantRails={{
          stripeEnabled: isMultiCheckoutRailConfigured(railSetup, 'stripe'),
          wiseEnabled: isMultiCheckoutRailConfigured(railSetup, 'wise'),
          stablecoinSettlementsEnabled,
        }}
        guidedSetupAssistant={config.features.guidedSetup}
      />
    </Suspense>
  );
}
