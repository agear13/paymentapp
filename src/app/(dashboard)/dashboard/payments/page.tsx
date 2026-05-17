import { SectionHubPage } from '@/components/dashboard/section-hub-page';
import { CreditCard, Link as LinkIcon, Repeat } from 'lucide-react';

export default function PaymentsPage() {
  return (
    <SectionHubPage
      title="Payments"
      description="Collect customer funds through invoices, recurring billing, and payment activity."
      links={[
        {
          title: 'Invoices',
          description: 'Create and manage payment links and invoices.',
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
          title: 'Transactions',
          description: 'Review customer payment activity and status.',
          href: '/dashboard/transactions',
          icon: CreditCard,
        },
      ]}
    />
  );
}
