import { SectionHubPage } from '@/components/dashboard/section-hub-page';
import { CircleDollarSign, FileCheck, History } from 'lucide-react';
import { PAYOUTS_OBLIGATIONS_HREF } from '@/lib/navigation/operator-nav';

export default function PayoutsPage() {
  return (
    <SectionHubPage
      title="Payouts"
      description="Coordinate obligations, commissions, and safe release of participant payouts."
      links={[
        {
          title: 'Obligations',
          description: 'Review who is owed what, funding gaps, and payout readiness by project.',
          href: PAYOUTS_OBLIGATIONS_HREF,
          icon: FileCheck,
        },
        {
          title: 'Commissions',
          description: 'Track earned commissions and allocation state.',
          href: '/dashboard/partners/commissions',
          icon: CircleDollarSign,
        },
        {
          title: 'Settlement history',
          description: 'Approve and monitor payout batches and settlement.',
          href: '/dashboard/partners/payouts',
          icon: History,
        },
      ]}
    />
  );
}
