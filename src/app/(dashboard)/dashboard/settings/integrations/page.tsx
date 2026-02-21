import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { XeroConnection } from '@/components/dashboard/settings/xero-connection';
import { XeroSyncQueue } from '@/components/dashboard/settings/xero-sync-queue';
import { XeroAccountMapping } from '@/components/dashboard/settings/xero-account-mapping';
import { getCurrentUser } from '@/lib/auth/session';
import { getUserOrganization } from '@/lib/auth/get-org';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/server/prisma';
import Link from 'next/link';

export default async function IntegrationsPage() {
  // Get current user's organization with proper data isolation
  const user = await getCurrentUser();
  
  if (!user) {
    redirect('/auth/login');
  }

  const org = await getUserOrganization();

  if (!org) {
    redirect('/onboarding');
  }

  const organizationId = org.id;

  // Fetch merchant settings to check Wise configuration
  const merchantSettings = await prisma.merchant_settings.findFirst({
    where: { organization_id: organizationId },
    select: {
      stripe_account_id: true,
      hedera_account_id: true,
      wise_profile_id: true,
      wise_enabled: true,
    },
  });

  const stripeConfigured = !!merchantSettings?.stripe_account_id;
  const hederaConfigured = !!merchantSettings?.hedera_account_id;
  const wiseConfigured = !!merchantSettings?.wise_enabled && !!merchantSettings?.wise_profile_id;
  const wiseEnabled = !!merchantSettings?.wise_enabled;

  // Mask profile ID for display
  const maskedWiseProfileId = merchantSettings?.wise_profile_id 
    ? `${merchantSettings.wise_profile_id.slice(0, 4)}****`
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Integrations</h1>
        <p className="text-muted-foreground">
          Connect third-party services to extend functionality.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Stripe Integration */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="text-3xl">💳</div>
                <div>
                  <CardTitle>Stripe</CardTitle>
                  <CardDescription className="mt-1">
                    Accept fiat payments via credit card, debit card, and more.
                  </CardDescription>
                </div>
              </div>
              {stripeConfigured ? (
                <Badge variant="default" className="bg-green-600">Connected</Badge>
              ) : (
                <Badge variant="secondary">Not Configured</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <Link href="/dashboard/settings/merchant" className="text-sm text-primary hover:underline">
              Configure in Merchant Settings →
            </Link>
          </CardContent>
        </Card>

        {/* Hedera Integration */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="text-3xl">₿</div>
                <div>
                  <CardTitle>Hedera</CardTitle>
                  <CardDescription className="mt-1">
                    Accept cryptocurrency payments via the Hedera network.
                  </CardDescription>
                </div>
              </div>
              {hederaConfigured ? (
                <Badge variant="default" className="bg-green-600">Connected</Badge>
              ) : (
                <Badge variant="secondary">Not Configured</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <Link href="/dashboard/settings/merchant" className="text-sm text-primary hover:underline">
              Configure in Merchant Settings →
            </Link>
          </CardContent>
        </Card>

        {/* Wise Integration */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="text-3xl">🏦</div>
                <div>
                  <CardTitle>Wise (Bank Transfer)</CardTitle>
                  <CardDescription className="mt-1">
                    Accept bank transfer payments via Wise multi-currency accounts.
                  </CardDescription>
                </div>
              </div>
              {wiseConfigured ? (
                <Badge variant="default" className="bg-emerald-600">Connected</Badge>
              ) : wiseEnabled ? (
                <Badge variant="outline" className="border-amber-500 text-amber-600">Enabled (Missing Profile ID)</Badge>
              ) : (
                <Badge variant="secondary">Not Configured</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {wiseConfigured && maskedWiseProfileId && (
              <p className="text-xs text-muted-foreground mb-2">
                Profile ID: {maskedWiseProfileId}
              </p>
            )}
            <Link href="/dashboard/settings/merchant" className="text-sm text-primary hover:underline">
              Configure in Merchant Settings →
            </Link>
          </CardContent>
        </Card>

        {/* Xero Integration */}
        <Card className="md:col-span-2">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="text-3xl">📊</div>
                <div>
                  <CardTitle>Xero</CardTitle>
                  <CardDescription className="mt-1">
                    Sync payments and invoices with your Xero accounting software.
                  </CardDescription>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <XeroConnection organizationId={organizationId} />
          </CardContent>
        </Card>
      </div>

      {/* Xero Account Mapping */}
      <XeroAccountMapping organizationId={organizationId} />

      {/* Xero Sync Queue */}
      <XeroSyncQueue organizationId={organizationId} />
    </div>
  );
}













