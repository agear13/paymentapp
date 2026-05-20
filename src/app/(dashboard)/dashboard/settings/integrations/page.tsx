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
import {
  maskHederaAccountId,
  maskStripeAccountId,
  maskWiseProfileId,
} from '@/lib/settings/mask-credential';

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
      wise_profile_id: true,
      wise_enabled: true,
    },
  });

  const stripeConfigured = !!merchantSettings?.stripe_account_id;
  const hederaConfigured = !!merchantSettings?.hedera_account_id;
  const wiseConfigured = !!merchantSettings?.wise_enabled && !!merchantSettings?.wise_profile_id;
  const wiseEnabled = !!merchantSettings?.wise_enabled;

  const maskedStripe = merchantSettings?.stripe_account_id
    ? maskStripeAccountId(merchantSettings.stripe_account_id)
    : null;
  const maskedHedera = merchantSettings?.hedera_account_id
    ? maskHederaAccountId(merchantSettings.hedera_account_id)
    : null;
  const maskedWise = merchantSettings?.wise_profile_id
    ? maskWiseProfileId(merchantSettings.wise_profile_id)
    : null;

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
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="text-2xl" aria-hidden>
                    💳
                  </div>
                  <div>
                    <CardTitle className="text-base">Stripe</CardTitle>
                    <CardDescription className="mt-1">
                      Card and fiat payments.
                    </CardDescription>
                  </div>
                </div>
                {stripeConfigured ? (
                  <Badge variant="default" className="bg-green-600 shrink-0">
                    Connected
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="shrink-0">
                    Not configured
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {maskedStripe ? (
                <p className="text-xs font-mono text-muted-foreground">{maskedStripe}</p>
              ) : null}
              <Link href={setupHref} className="text-sm text-primary hover:underline">
                Configure in collection & settlement setup
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="text-2xl" aria-hidden>
                    ₿
                  </div>
                  <div>
                    <CardTitle className="text-base">Hedera</CardTitle>
                    <CardDescription className="mt-1">
                      Cryptocurrency payments on Hedera.
                    </CardDescription>
                  </div>
                </div>
                {hederaConfigured ? (
                  <Badge variant="default" className="bg-green-600 shrink-0">
                    Connected
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="shrink-0">
                    Not configured
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {maskedHedera ? (
                <p className="text-xs font-mono text-muted-foreground">{maskedHedera}</p>
              ) : null}
              <Link href={setupHref} className="text-sm text-primary hover:underline">
                Configure in collection & settlement setup
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="text-2xl" aria-hidden>
                    🏦
                  </div>
                  <div>
                    <CardTitle className="text-base">Wise</CardTitle>
                    <CardDescription className="mt-1">
                      Bank transfer via Wise.
                    </CardDescription>
                  </div>
                </div>
                {wiseConfigured ? (
                  <Badge variant="default" className="bg-emerald-600 shrink-0">
                    Connected
                  </Badge>
                ) : wiseEnabled ? (
                  <Badge
                    variant="outline"
                    className="border-amber-500/40 text-amber-800 shrink-0"
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
              {maskedWise ? (
                <p className="text-xs font-mono text-muted-foreground">Profile {maskedWise}</p>
              ) : null}
              <Link href={setupHref} className="text-sm text-primary hover:underline">
                Configure in collection & settlement setup
              </Link>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Accounting</h2>
          <p className="text-sm text-muted-foreground">
            Sync invoices and payments with your books.
          </p>
        </div>
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

        <XeroAccountMapping organizationId={organizationId} />
        <XeroSyncQueue organizationId={organizationId} />
      </section>
    </div>
  );
}
