import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, ArrowRight, FileCheck, FolderKanban, Wallet } from 'lucide-react';
import { PAYOUTS_OBLIGATIONS_HREF } from '@/lib/navigation/operator-nav';

type ActionCard = {
  title: string;
  description: string;
  href: string;
  ctaLabel: string;
  count?: number;
  variant?: 'default' | 'attention' | 'muted';
};

type OperationalHomeDashboardProps = {
  actionCards: ActionCard[];
  hasActiveCoordination?: boolean;
};

const WORKFLOW_STEPS = [
  {
    label: 'Projects',
    href: '/dashboard/projects',
    icon: FolderKanban,
    description: 'Operational workspaces',
  },
  {
    label: 'Payments',
    href: '/dashboard/payments',
    icon: Wallet,
    description: 'Invoices & collection',
  },
  {
    label: 'Payouts',
    href: PAYOUTS_OBLIGATIONS_HREF,
    icon: FileCheck,
    description: 'Obligations & readiness',
  },
] as const;

export function OperationalHomeDashboard({
  actionCards,
  hasActiveCoordination = true,
}: OperationalHomeDashboardProps) {
  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Operational command center</h1>
          <p className="text-muted-foreground mt-1">
            Track payout readiness, obligations, approvals, reconciliation, and funding activity
            across projects.
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/projects">Create project</Link>
        </Button>
      </div>

      <section aria-label="Settlement coordination flow">
        <Card className="border-muted/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Settlement coordination flow</CardTitle>
            <CardDescription>
              Coordinate revenue, obligations, approvals, and payout readiness across projects.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="grid gap-2 sm:grid-cols-3">
              {WORKFLOW_STEPS.map((step, index) => (
                <li key={step.label}>
                  <Link
                    href={step.href}
                    className="flex items-center gap-3 rounded-lg border bg-muted/20 px-3 py-2.5 transition-colors hover:bg-accent/60"
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-background text-xs font-semibold text-muted-foreground border">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <step.icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="text-sm font-medium">{step.label}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{step.description}</span>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </Link>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </section>

      {!hasActiveCoordination ? (
        <Card className="border-dashed bg-muted/10">
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            No active payout coordination yet. Create a project to begin coordinating participants,
            funding, and settlement readiness.
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        {actionCards.map((card) => (
          <Card
            key={card.href}
            className={
              card.variant === 'attention'
                ? 'border-amber-500/40'
                : card.variant === 'muted'
                  ? 'border-muted/60 bg-muted/10'
                  : undefined
            }
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
                  {card.ctaLabel}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <AlertCircle className="h-3.5 w-3.5" />
        <span>Operational alerts and live counts update as your projects progress.</span>
      </div>
    </div>
  );
}
