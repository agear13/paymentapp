import { SectionHubPage } from '@/components/dashboard/section-hub-page';
import { CreditCard, Link as LinkIcon, Repeat } from 'lucide-react';

export default function PaymentsPage() {
  return (
    <SectionHubPage
      title="Funding"
      description="Coordinate revenue collection that funds agreement obligations — invoices, recurring schedules, and funding activity."
      links={[
        {
          title: 'Invoices',
          description: 'Create and manage invoices for your customers.',
          href: '/dashboard/payment-links',
          icon: LinkIcon,
        },
        {
          title: 'Recurring',
          description: 'Templates for repeat customer billing.',
          href: '/dashboard/recurring-templates',
          icon: Repeat,
        },
        {
          title: 'Funding activity',
          description: 'Review funding events and collection status across your agreements.',
          href: '/dashboard/transactions',
          icon: CreditCard,
        },
      ]}
    />
  );
}
