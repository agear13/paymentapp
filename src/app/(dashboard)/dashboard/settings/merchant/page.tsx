import { MerchantSettingsShell } from '@/app/(dashboard)/dashboard/settings/merchant/merchant-settings-shell';
import { getDashboardProductProfile } from '@/lib/auth/dashboard-product.server';

export default async function MerchantSettingsPage() {
  const profile = await getDashboardProductProfile();
  const isPilot = profile === 'rabbit_hole_pilot' || profile === 'strait_experiences_pilot';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Payments & Settlement</h1>
        <p className="text-muted-foreground">
          Connect your payment provider and configure how customer payments are collected and settled.
        </p>
      </div>

      <MerchantSettingsShell variant={isPilot ? 'pilot' : 'full'} />
    </div>
  );
}
