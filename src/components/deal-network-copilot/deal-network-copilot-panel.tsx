'use client';

import * as React from 'react';
import { Loader2, Minus, Sparkles, X } from 'lucide-react';
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

type CopilotUiState = 'open' | 'minimized' | 'dismissed';
const COPILOT_STORAGE_KEY = 'provvypay.dealNetwork.copilotState';

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
  const [uiState, setUiState] = React.useState<CopilotUiState>('open');

  const allowed = profile === 'admin' || profile === 'rabbit_hole_pilot';

  React.useEffect(() => {
    if (!allowed) return;
    try {
      const stored = window.localStorage.getItem(COPILOT_STORAGE_KEY);
      if (stored === 'open' || stored === 'minimized' || stored === 'dismissed') {
        setUiState(stored);
      }
    } catch {
      // Ignore localStorage access failures; default to open.
    }
  }, [allowed]);

  const persistUiState = React.useCallback((next: CopilotUiState) => {
    setUiState(next);
    try {
      window.localStorage.setItem(COPILOT_STORAGE_KEY, next);
    } catch {
      // Ignore localStorage failures.
    }
  }, []);

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

  if (uiState !== 'open') {
    return (
      <div className="fixed bottom-5 right-5 z-40" aria-label="Deal Network Copilot launcher">
        <Button
          type="button"
          size="sm"
          variant={uiState === 'dismissed' ? 'outline' : 'default'}
          className="shadow-md"
          onClick={() => persistUiState('open')}
        >
          <Sparkles className="mr-1.5 size-4" aria-hidden />
          Ask Provvypay
        </Button>
      </div>
    );
  }

  return (
    <aside className="fixed bottom-5 right-5 z-40 w-[min(420px,calc(100vw-2rem))]" aria-label="Deal Network Copilot">
      <Card className="border-primary/25 bg-gradient-to-b from-primary/5 to-background shadow-xl">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
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
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={() => persistUiState('minimized')}
                aria-label="Minimize copilot"
                title="Minimize"
              >
                <Minus className="size-4" aria-hidden />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={() => persistUiState('dismissed')}
                aria-label="Hide copilot for now"
                title="Hide for now"
              >
                <X className="size-4" aria-hidden />
              </Button>
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
          <div className="flex items-center justify-between border-t pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => persistUiState('dismissed')}
            >
              I don&apos;t want help right now
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => persistUiState('minimized')}
            >
              Minimize
            </Button>
          </div>
        </CardContent>
      </Card>
    </aside>
  );
}
