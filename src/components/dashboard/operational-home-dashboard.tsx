import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, ArrowRight, FileCheck, FolderKanban, Wallet } from 'lucide-react';
import { PAYOUTS_OBLIGATIONS_HREF } from '@/lib/navigation/operator-nav';

type ActionCard = {
  title: string;
  description: string;
  href: string;
  count?: number;
  variant?: 'default' | 'attention';
};

type OperationalHomeDashboardProps = {
  actionCards: ActionCard[];
};

export function OperationalHomeDashboard({ actionCards }: OperationalHomeDashboardProps) {
  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Home</h1>
          <p className="text-muted-foreground mt-1">
            What needs your attention to keep projects, funding, and payouts moving safely.
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/projects">Create project</Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {actionCards.map((card) => (
          <Card
            key={card.href}
            className={card.variant === 'attention' ? 'border-amber-500/40' : undefined}
          >
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base">{card.title}</CardTitle>
                {card.count != null && card.count > 0 ? (
                  <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">
                    {card.count}
                  </span>
                ) : null}
              </div>
              <CardDescription>{card.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" size="sm">
                <Link href={card.href}>
                  Review
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Operational workflow</CardTitle>
          <CardDescription>
            Progress a project from funding through obligations to safe payout coordination.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="grid gap-3 sm:grid-cols-3">
            {[
              {
                label: 'Projects',
                href: '/dashboard/projects',
                icon: FolderKanban,
                description: 'Create and manage coordination workspaces',
              },
              {
                label: 'Payments',
                href: '/dashboard/payments',
                icon: Wallet,
                description: 'Invoices and customer payment activity',
              },
              {
                label: 'Payouts',
                href: PAYOUTS_OBLIGATIONS_HREF,
                icon: FileCheck,
                description: 'Obligations and settlement coordination',
              },
            ].map((step) => (
              <li key={step.label}>
                <Link
                  href={step.href}
                  className="flex flex-col gap-2 rounded-lg border p-3 transition-colors hover:bg-accent h-full"
                >
                  <div className="flex items-center gap-2">
                    <step.icon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm font-medium">{step.label}</span>
                    <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground" />
                  </div>
                  <span className="text-xs text-muted-foreground pl-6">{step.description}</span>
                </Link>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <AlertCircle className="h-3.5 w-3.5" />
        <span>Operational alerts and live counts update as your projects progress.</span>
      </div>
    </div>
  );
}
