'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight, Loader2 } from 'lucide-react';
import { OnboardingNextActionCard } from '@/components/onboarding/onboarding-next-action-card';
import { useWorkspaceActivation } from '@/hooks/use-workspace-activation';
import { getProjectDisplayName, UNTITLED_PROJECT_LABEL } from '@/lib/projects/get-project-display-name';

const PREVIEW_ROWS = [
  {
    party: 'Promoter · Island Events',
    detail: '15% net revenue share',
    amount: '$7,425',
    funding: 'Funded',
    state: 'Payout ready',
    tone: 'green' as const,
  },
  {
    party: 'DJ · DJ Alex',
    detail: 'Fixed fee agreement',
    amount: '$5,000',
    funding: 'Partially funded',
    state: 'Partially paid',
    tone: 'blue' as const,
  },
  {
    party: 'Supplier · Elite Beverages',
    detail: 'INV-1045 attached',
    amount: '$6,800',
    funding: 'Unfunded',
    state: 'Pending approval',
    tone: 'amber' as const,
  },
  {
    party: 'Contractor · Stage & Production',
    detail: '10% net allocation',
    amount: '$4,950',
    funding: 'Unfunded',
    state: 'Payout blocked',
    tone: 'red' as const,
  },
  {
    party: 'Affiliate · Coastal Media',
    detail: 'Referral commission',
    amount: '$1,200',
    funding: 'Funded',
    state: 'Onboarding incomplete',
    tone: 'red' as const,
  },
];

const FUNDING_BADGE = {
  green: 'text-green-700 bg-green-50 border-green-200',
  blue: 'text-blue-700 bg-blue-50 border-blue-200',
  amber: 'text-amber-700 bg-amber-50 border-amber-200',
  red: 'text-red-700 bg-red-50 border-red-200',
};

type OnboardingWorkspacePreviewProps = {
  projectName?: string;
};

export function OnboardingWorkspacePreview({ projectName }: OnboardingWorkspacePreviewProps) {
  const { activation, nextAction, loading } = useWorkspaceActivation();
  const resolvedName = getProjectDisplayName({ dealName: projectName });
  const label = resolvedName !== UNTITLED_PROJECT_LABEL ? resolvedName : 'Your first project';
  const phaseLabel = activation?.phaseLabel ?? 'Workspace setup in progress';

  return (
    <Card className="border-primary/25 bg-primary/[0.03]">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Badge variant="secondary" className="mb-2">
              {loading ? 'Loading status…' : phaseLabel}
            </Badge>
            <CardTitle className="text-xl">
              Your operational coordination workspace is ready
            </CardTitle>
            <CardDescription className="mt-1 max-w-2xl">
              {label} is live. This workspace tracks revenue, obligations, payout readiness,
              approvals, and reconciliation across multiple parties. All collection methods feed
              into the same settlement view.
            </CardDescription>
          </div>
          <Button asChild variant="outline" size="sm" className="shrink-0">
            <Link href="/dashboard/projects">Open project</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-4">
          {[
            { label: 'Revenue collected', value: '$18,750', note: 'Ticket + table sales' },
            { label: 'Payout ready', value: '$7,425', note: 'Funded obligations' },
            { label: 'Partially funded', value: '$5,000', note: 'Awaiting balance' },
            { label: 'Blocked / held', value: '$6,150', note: 'Approval or onboarding' },
          ].map((item) => (
            <div key={item.label} className="rounded-lg border bg-background p-3">
              <div className="text-[11px] text-muted-foreground">{item.label}</div>
              <div className="font-semibold font-mono text-lg mt-0.5">{item.value}</div>
              <div className="text-[10px] text-muted-foreground mt-1">{item.note}</div>
            </div>
          ))}
        </div>

        <div className="rounded-xl border bg-background p-4 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-muted-foreground uppercase tracking-wide">
              Settlement overview · {label}
            </span>
            <span className="text-muted-foreground">Sample operational states</span>
          </div>
          {PREVIEW_ROWS.map((row) => (
            <div
              key={row.party}
              className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-xs"
            >
              <div className="min-w-0">
                <div className="font-medium truncate">{row.party}</div>
                <div className="text-muted-foreground truncate">{row.detail}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-mono font-semibold">{row.amount}</div>
                <div className="flex flex-col items-end gap-0.5 mt-0.5">
                  <span
                    className={`px-1.5 py-0 rounded text-[10px] font-medium border ${FUNDING_BADGE[row.tone]}`}
                  >
                    {row.funding}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{row.state}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div>
          <h3 className="text-sm font-semibold mb-3">Suggested next steps</h3>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading recommendations…
            </div>
          ) : nextAction ? (
            <Link
              href={nextAction.href}
              className="flex gap-3 rounded-lg border bg-background p-4 transition-colors hover:bg-accent/40"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{nextAction.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{nextAction.description}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 self-center" />
            </Link>
          ) : (
            <OnboardingNextActionCard />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
