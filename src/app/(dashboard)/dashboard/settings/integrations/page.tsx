import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { XeroConnection } from '@/components/dashboard/settings/xero-connection';
import { XeroSyncQueue } from '@/components/dashboard/settings/xero-sync-queue';
import { XeroAccountMapping } from '@/components/dashboard/settings/xero-account-mapping';
import { XeroAccountingHealth } from '@/components/dashboard/settings/xero-accounting-health';
import { XeroIntegrationsGate } from '@/components/entitlements/xero-integrations-gate';
import { getCurrentUser } from '@/lib/auth/session';
import { getUserOrganization } from '@/lib/auth/get-org';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/server/prisma';
import Link from 'next/link';
import config from '@/lib/config/env';
import {
  maskHederaAccountId,
  maskStripeAccountId,
  maskWiseProfileId,
  maskEvmWalletAddress,
} from '@/lib/settings/mask-credential';
import {
  computePaymentLinkRailSetup,
  isMultiCheckoutRailConfigured,
  isMultiCheckoutRailIncomplete,
} from '@/lib/payment-links/setup-status';
import {
  evmNetworkDisplayName,
  getMultiCheckoutRails,
} from '@/lib/payments/payment-rail-registry';

export default async function IntegrationsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/auth/login');
  }

  const org = await getUserOrganization();

  if (!org) {
    redirect('/onboarding');
  }

  const organizationId = org.id;

  const merchantSettings = await prisma.merchant_settings.findFirst({
    where: { organization_id: organizationId },
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

  const paymentRails = getMultiCheckoutRails();

  const maskedStripe = merchantSettings?.stripe_account_id
    ? maskStripeAccountId(merchantSettings.stripe_account_id)
    : null;
  const maskedHedera = merchantSettings?.hedera_account_id
    ? maskHederaAccountId(merchantSettings.hedera_account_id)
    : null;
  const maskedWise = merchantSettings?.wise_profile_id
    ? maskWiseProfileId(merchantSettings.wise_profile_id)
    : null;
  const maskedEvm = merchantSettings?.evm_wallet_address
    ? maskEvmWalletAddress(merchantSettings.evm_wallet_address)
    : null;

  const evmNetworks =
    merchantSettings?.evm_supported_networks?.map(evmNetworkDisplayName).join(', ') || null;
  const evmTokens = merchantSettings?.evm_supported_tokens?.join(', ') || null;

  const setupHref = '/dashboard/settings/merchant';

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Integrations</h1>
        <p className="text-muted-foreground">
          Connect payment rails and accounting systems for your organization.
        </p>
      </div>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Payment rails</h2>
          <p className="text-sm text-muted-foreground">
            Collection accounts configured in collection & settlement setup.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {paymentRails.map((rail) => {
            const configured = isMultiCheckoutRailConfigured(railSetup, rail.id);
            const incomplete = isMultiCheckoutRailIncomplete(railSetup, rail.id);
            const maskedCredential =
              rail.id === 'stripe'
                ? maskedStripe
                : rail.id === 'hedera'
                  ? maskedHedera
                  : rail.id === 'wise'
                    ? maskedWise
                      ? `Profile ${maskedWise}`
                      : null
                    : rail.id === 'evm_wallet'
                      ? maskedEvm
                      : null;

            return (
              <Card key={rail.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="text-2xl" aria-hidden>
                        {rail.integrationsIcon}
                      </div>
                      <div>
                        <CardTitle className="text-base">{rail.merchantSettingsLabel}</CardTitle>
                        <CardDescription className="mt-1">
                          {rail.integrationsDescription}
                        </CardDescription>
                      </div>
                    </div>
                    {configured ? (
                      <Badge variant="default" className="shrink-0 bg-green-600">
                        Connected
                      </Badge>
                    ) : incomplete ? (
                      <Badge
                        variant="outline"
                        className="shrink-0 border-amber-500/40 text-amber-800"
                      >
                        Incomplete
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="shrink-0">
                        Not configured
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {maskedCredential ? (
                    <p className="text-xs font-mono text-muted-foreground">
                      {rail.id === 'evm_wallet'
                        ? `Receive wallet ${maskedCredential}`
                        : maskedCredential}
                    </p>
                  ) : null}
                  {rail.id === 'evm_wallet' && evmNetworks ? (
                    <p className="text-xs text-muted-foreground">Networks: {evmNetworks}</p>
                  ) : null}
                  {rail.id === 'evm_wallet' && evmTokens ? (
                    <p className="text-xs text-muted-foreground">Tokens: {evmTokens}</p>
                  ) : null}
                  <Link href={setupHref} className="text-sm text-primary hover:underline">
                    Configure in collection & settlement setup
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Accounting</h2>
          <p className="text-sm text-muted-foreground">
            Sync invoices and payments with your books.
          </p>
        </div>
        <XeroIntegrationsGate>
          <Card className="border-primary/20">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="text-2xl" aria-hidden>
                  📊
                </div>
                <div>
                  <CardTitle>Xero</CardTitle>
                  <CardDescription className="mt-1">
                    Accounting sync for invoices and settled payments.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <XeroConnection organizationId={organizationId} />
            </CardContent>
          </Card>

          <XeroAccountingHealth organizationId={organizationId} />

          <details id="advanced-accounting-settings" className="rounded-lg border bg-card">
            <summary className="cursor-pointer px-6 py-4 text-sm font-medium">
              Advanced Accounting Settings
            </summary>
            <div className="border-t p-6">
              <XeroAccountMapping
                organizationId={organizationId}
                stablecoinSettlementsEnabled={isMultiCheckoutRailConfigured(railSetup, 'hedera')}
              />
            </div>
          </details>
          <XeroSyncQueue organizationId={organizationId} />
        </XeroIntegrationsGate>
      </section>
    </div>
  );
}
