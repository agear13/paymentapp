import Link from 'next/link';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight, CircleDollarSign, FileCheck, History } from 'lucide-react';
import {
  PayoutHowItWorksCard,
  PayoutLifecycleFlow,
} from '@/components/payouts/payout-lifecycle-explainer';
import {
  PAYOUTS_COMMISSIONS_HREF,
  PAYOUTS_OBLIGATIONS_HREF,
  PAYOUTS_SETTLEMENTS_HREF,
} from '@/lib/navigation/operator-nav';

const HUB_LINKS = [
  {
    title: 'Obligations',
    description: 'See what is owed, what is funded, and what is ready for payout by project.',
    href: PAYOUTS_OBLIGATIONS_HREF,
    icon: FileCheck,
  },
  {
    title: 'Commissions',
    description: 'Track participant earnings and payout readiness.',
    href: PAYOUTS_COMMISSIONS_HREF,
    icon: CircleDollarSign,
  },
  {
    title: 'Settlement history',
    description: 'Review release batches and completed participant payouts.',
    href: PAYOUTS_SETTLEMENTS_HREF,
    icon: History,
  },
] as const;

export function PayoutsHubPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Payouts</h1>
        <p className="text-muted-foreground mt-1 max-w-2xl">
          Coordinate obligations, commissions, and safe release of participant payouts — with
          audit-ready visibility at every step.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {HUB_LINKS.map((link) => (
          <Link key={link.href} href={link.href}>
            <Card className="h-full transition-colors hover:bg-accent/50">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <link.icon className="h-4 w-4 text-muted-foreground" />
                    {link.title}
                  </CardTitle>
                  <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </div>
                <CardDescription>{link.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>

      <PayoutHowItWorksCard />

      <PayoutLifecycleFlow />
    </div>
  );
}
