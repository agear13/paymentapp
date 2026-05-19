'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

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
  const label = projectName?.trim() || 'Your first project';

  return (
    <Card className="border-primary/25 bg-primary/[0.03]">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Badge variant="secondary" className="mb-2">
              Workspace ready
            </Badge>
            <CardTitle className="text-xl">Your operational coordination workspace</CardTitle>
            <CardDescription className="mt-1 max-w-2xl">
              {label} is set up. This is where finance and ops teams track revenue, obligations,
              payout readiness, and reconciliation across every party on the event.
            </CardDescription>
          </div>
          <Button asChild variant="outline" size="sm" className="shrink-0">
            <Link href="/dashboard/projects">Open project</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-4">
          {[
            { label: 'Revenue collected', value: '$0', note: 'Add invoices or payment links' },
            { label: 'Payout ready', value: '$0', note: 'Funded obligations' },
            { label: 'Partially funded', value: '$0', note: 'Awaiting balance' },
            { label: 'Blocked / held', value: '$0', note: 'Onboarding or approval' },
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
              Sample settlement view
            </span>
            <span className="text-muted-foreground">Updates as you add revenue and obligations</span>
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

        <div className="grid gap-2 sm:grid-cols-3 text-xs text-muted-foreground">
          <div className="rounded-lg border bg-background px-3 py-2">
            <span className="font-medium text-foreground">Next:</span> add participants and obligations
          </div>
          <div className="rounded-lg border bg-background px-3 py-2">
            <span className="font-medium text-foreground">Then:</span> collect revenue via invoice or link
          </div>
          <div className="rounded-lg border bg-background px-3 py-2">
            <span className="font-medium text-foreground">Reconcile:</span> Xero sync when you connect
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
