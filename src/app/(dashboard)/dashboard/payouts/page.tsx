import { SectionHubPage } from '@/components/dashboard/section-hub-page';
import { CircleDollarSign, FileCheck, History } from 'lucide-react';

export default function PayoutsPage() {
  return (
    <SectionHubPage
      title="Payouts"
      description="Coordinate obligations, commissions, and safe release of participant payouts."
      links={[
        {
          title: 'Obligations',
          description: 'Review funding gaps and payout readiness by project.',
          href: '/dashboard/partners/deal-network/obligations',
          icon: FileCheck,
        },
        {
          title: 'Commissions',
          description: 'Track earned commissions and allocation state.',
          href: '/dashboard/partners/commissions',
          icon: CircleDollarSign,
        },
        {
          title: 'Payout history',
          description: 'Approve and monitor payout batches and settlement.',
          href: '/dashboard/partners/payouts',
          icon: History,
        },
      ]}
    />
  );
}
