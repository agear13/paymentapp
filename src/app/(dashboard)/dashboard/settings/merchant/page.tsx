import { MerchantSettingsShell } from '@/app/(dashboard)/dashboard/settings/merchant/merchant-settings-shell';
import { getDashboardProductProfile } from '@/lib/auth/dashboard-product.server';

export default async function MerchantSettingsPage() {
  const profile = await getDashboardProductProfile();
  const isPilot = profile === 'rabbit_hole_pilot' || profile === 'strait_experiences_pilot';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Collection & settlement setup</h1>
        <p className="text-muted-foreground">
          {isPilot
            ? 'Configure how your pilot workspace collects revenue and coordinates settlement.'
            : 'Configure how your workspace collects revenue, coordinates payouts, and settles obligations.'}
        </p>
      </div>

      <MerchantSettingsShell variant={isPilot ? 'pilot' : 'full'} />
    </div>
  );
}
