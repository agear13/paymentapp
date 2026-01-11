import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { XeroConnection } from '@/components/dashboard/settings/xero-connection';
import { XeroSyncQueue } from '@/components/dashboard/settings/xero-sync-queue';
import { XeroAccountMapping } from '@/components/dashboard/settings/xero-account-mapping';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/server/prisma';

export default async function IntegrationsPage() {
  // Get current organization
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return <div>Unauthorized</div>;
  }

  // Get user's organization (simplified - in production, use proper org selection)
  const org = await prisma.organizations.findFirst({
    where: {
      // This is a simplified query - adjust based on your auth setup
    },
  });

  const organizationId = org?.id || '';

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
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <Badge variant="secondary">Configured in Settings</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Configure Stripe in Merchant Settings
            </p>
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
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <Badge variant="secondary">Configured in Settings</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Configure Hedera in Merchant Settings
            </p>
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













