'use client';

import * as React from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import type { DashboardProductProfile } from '@/lib/auth/admin-shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { GetDealIssuesResult, DealIssueItem } from '@/lib/copilot/tools/get-deal-issues';

type ParticipantSnapshot = {
  id: string;
  name: string;
  role: string;
  approvalStatus?: string;
  payoutSettlementStatus?: string;
};

type DealSnapshot = {
  id: string;
  dealName: string;
  status: string;
  paymentStatus?: string;
  archived?: boolean;
};

function severityVariant(
  s: DealIssueItem['severity']
): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (s === 'critical') return 'destructive';
  if (s === 'warning') return 'secondary';
  return 'outline';
}

export function DealNetworkCopilotPanel({
  profile,
  activeDeal,
  participants,
}: {
  profile: DashboardProductProfile | null;
  activeDeal: DealSnapshot | null;
  participants: ParticipantSnapshot[];
}) {
  const [result, setResult] = React.useState<GetDealIssuesResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const allowed = profile === 'admin' || profile === 'rabbit_hole_pilot';

  const runDiagnostic = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/copilot/tools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool: 'getDealIssues',
          input: {
            deal: activeDeal,
            participants: participants.map((p) => ({
              id: p.id,
              name: p.name,
              role: p.role,
              approvalStatus: p.approvalStatus,
              payoutSettlementStatus: p.payoutSettlementStatus,
            })),
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Request failed');
      }
      setResult(data.result as GetDealIssuesResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load diagnostics');
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [activeDeal, participants]);

  if (!allowed || profile === null) {
    return null;
  }

  return (
    <aside
      className="w-full shrink-0 lg:sticky lg:top-20 lg:w-[380px] lg:self-start"
      aria-label="Deal Network Copilot"
    >
      <Card className="border-primary/25 bg-gradient-to-b from-primary/5 to-background shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <span className="bg-primary/15 flex size-9 items-center justify-center rounded-lg">
              <Sparkles className="text-primary size-4" aria-hidden />
            </span>
            <div>
              <CardTitle className="text-base">Deal Network Copilot</CardTitle>
              <CardDescription className="text-xs">
                Operator diagnostics for this deal — scoped to Deal Network only.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          <Button
            type="button"
            className="w-full"
            disabled={loading}
            onClick={() => void runDiagnostic()}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                Analyzing…
              </>
            ) : (
              "What's blocking this deal?"
            )}
          </Button>

          {error ? (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          {result ? (
            <div className="space-y-2">
              <p className="text-muted-foreground text-xs leading-relaxed">{result.summary}</p>
              <ul className="space-y-2">
                {result.items.map((item) => (
                  <li
                    key={item.id}
                    className="rounded-lg border bg-background/80 px-3 py-2 text-sm shadow-sm"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={severityVariant(item.severity)} className="text-[10px] uppercase">
                        {item.severity}
                      </Badge>
                      <span className="font-medium leading-snug">{item.label}</span>
                    </div>
                    {item.detail ? (
                      <p className="text-muted-foreground mt-1 text-xs leading-relaxed">{item.detail}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-muted-foreground text-xs leading-relaxed">
              Run the check to see settlement, approval, and payout-line signals for the active deal.
            </p>
          )}
        </CardContent>
      </Card>
    </aside>
  );
}
