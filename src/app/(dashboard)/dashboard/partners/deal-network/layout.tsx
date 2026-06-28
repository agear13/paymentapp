/**
 * Rabbit Hole Deal Network pilot shell.
 *
 * This route is a frozen production pilot for Alex. Treat it as a compatibility
 * layer: changes require explicit Rabbit Hole pilot approval and must not be
 * made as a side effect of Provvypay Agreements work.
 */
import { getDashboardProductProfile } from '@/lib/auth/dashboard-product.server';
import { dealNetworkExperienceFromProductProfile } from '@/lib/deal-network-demo/deal-network-experience';
import { DealNetworkExperienceProvider } from '@/components/deal-network-demo/deal-network-experience-provider';

export default async function DealNetworkLayout({ children }: { children: React.ReactNode }) {
  const profile = await getDashboardProductProfile();
  const dealNetworkExperienceMode = dealNetworkExperienceFromProductProfile(profile);
  return (
    <DealNetworkExperienceProvider profile={profile} dealNetworkExperienceMode={dealNetworkExperienceMode}>
      {children}
    </DealNetworkExperienceProvider>
  );
}
