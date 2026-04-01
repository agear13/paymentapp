import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MerchantSettingsForm } from '@/components/dashboard/settings/merchant-settings-form';
import { getDashboardProductProfile } from '@/lib/auth/dashboard-product.server';

export default async function MerchantSettingsPage() {
  const profile = await getDashboardProductProfile();
  const isPilot = profile === 'rabbit_hole_pilot';
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Merchant Settings</h1>
        <p className="text-muted-foreground">
          {isPilot
            ? 'Configure payment settings for invoice collection in the Rabbit Hole pilot.'
            : 'Configure your payment processing and integration settings.'}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payment Configuration</CardTitle>
          <CardDescription>
            {isPilot
              ? 'Set up Stripe, Wise, and HashPack details used for pilot invoice workflows.'
              : 'Set up your payment accounts and default preferences.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MerchantSettingsForm variant={isPilot ? 'pilot' : 'full'} />
        </CardContent>
      </Card>
    </div>
  );
}













