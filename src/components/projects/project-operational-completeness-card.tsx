'use client';

import { Check, AlertTriangle } from 'lucide-react';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import type { RecentDeal } from '@/lib/data/mock-deal-network';
import { deriveProjectCompletenessLines } from '@/lib/operational/project-operational-completeness';
import { cn } from '@/lib/utils';

type ProjectOperationalCompletenessCardProps = {
  project?: RecentDeal | null;
  participants: DemoParticipant[];
  title?: string;
  providerConnected?: boolean;
  revenueConfigured?: boolean;
  obligationCount?: number;
  className?: string;
};

export function ProjectOperationalCompletenessCard({
  project,
  participants,
  title = 'Project setup',
  providerConnected,
  revenueConfigured,
  obligationCount,
  className,
}: ProjectOperationalCompletenessCardProps) {
  const lines = deriveProjectCompletenessLines(project, participants, {
    providerConnected,
    revenueConfigured,
    obligationCount,
  });

  return (
    <div className={cn('rounded-lg border border-border/30 bg-muted/10 px-4 py-3 space-y-2', className)}>
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{title}</p>
      <ul className="space-y-1.5">
        {lines.map((line) => (
          <li key={line.id} className="flex items-start gap-2 text-sm">
            {line.complete ? (
              <Check className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : line.warning ? (
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            ) : (
              <span className="h-4 w-4 shrink-0 mt-0.5 rounded-full border border-muted-foreground/40" />
            )}
            <span
              className={cn(
                line.complete ? 'text-foreground' : line.warning ? 'text-amber-800/90 dark:text-amber-300/90' : 'text-muted-foreground'
              )}
            >
              {line.complete ? '✓ ' : line.warning ? '⚠ ' : '○ '}
              {line.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
