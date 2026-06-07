'use client';

import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import type { AgreementSettlementBlocker } from '@/lib/agreements/intelligence/agreement-intelligence.types';
import { BriefingSectionShell } from '@/components/agreements/briefing/briefing-section-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type BriefingSettlementBlockersPanelProps = {
  blockers: AgreementSettlementBlocker[];
};

export function BriefingSettlementBlockersPanel({ blockers }: BriefingSettlementBlockersPanelProps) {
  return (
    <BriefingSectionShell
      id="briefing-blockers"
      title="Settlement Blockers"
      description="Issues preventing settlement under this agreement — ranked by operational impact."
      variant="settlement"
    >
      {blockers.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2">No settlement blockers detected.</p>
      ) : (
        <ul className="space-y-3">
          {blockers.map((blocker) => (
            <li
              key={blocker.id}
              className={cn(
                'rounded-xl border px-4 py-4 bg-white/70 dark:bg-background/30',
                blocker.severity === 'blocking'
                  ? 'border-amber-500/30'
                  : 'border-[rgba(29,111,66,0.15)]'
              )}
            >
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {blocker.severity === 'blocking' ? (
                      <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                    ) : null}
                    <p className="font-semibold text-sm">{blocker.label}</p>
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-[10px]',
                        blocker.severity === 'blocking'
                          ? 'border-amber-500/35 text-amber-800'
                          : 'border-muted-foreground/30'
                      )}
                    >
                      {blocker.severity === 'blocking' ? 'Blocking' : 'Warning'}
                    </Badge>
                  </div>
                  <dl className="grid gap-2 sm:grid-cols-2 text-sm">
                    <div>
                      <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Owner
                      </dt>
                      <dd className="mt-0.5">{blocker.owner}</dd>
                    </div>
                    <div className="sm:col-span-1">
                      <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Recommended resolution
                      </dt>
                      <dd className="mt-0.5 leading-relaxed">{blocker.resolution}</dd>
                    </div>
                  </dl>
                </div>
                {blocker.ctaHref && blocker.ctaLabel ? (
                  <Button asChild variant="outline" size="sm" className="shrink-0">
                    <Link href={blocker.ctaHref}>{blocker.ctaLabel}</Link>
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </BriefingSectionShell>
  );
}
