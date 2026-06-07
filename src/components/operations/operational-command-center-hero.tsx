'use client';

import type { OperationalGuidanceBundle } from '@/lib/operations/explainability';
import type { AttentionItem } from '@/lib/operations/severity';
import { compressOperationalBlockers } from '@/lib/operations/explainability/deduplicate-operational-actions';
import { labelSafeToRelease, OPERATOR_LABELS } from '@/lib/operations/design-language';
import { OperationalStatePill } from '@/components/operations/operational-state-pill';
import { ProgressiveOperationalPanel } from '@/components/operations/progressive-operational-panel';
import { ReleaseConfidenceSummary } from '@/components/operations/release-confidence-summary';
import { SafeOperationalLink } from '@/components/operations/safe-operational-link';
import {
  opTypeLabel,
  opTypeMeta,
  opTypePageTitle,
} from '@/lib/design/operational-typography';
import { opSpace } from '@/lib/design/operational-spacing';
import { opDivider, opSurface } from '@/lib/design/operational-surfaces';
import { useWorkspaceActivation } from '@/hooks/use-workspace-activation';
import { Button } from '@/components/ui/button';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export type OperationalCommandCenterHeroProps = {
  guidance: OperationalGuidanceBundle;
  attentionItems: AttentionItem[];
  workspacePhase: string;
  loading?: boolean;
};

export function OperationalCommandCenterHero({
  guidance,
  attentionItems,
  workspacePhase,
  loading,
}: OperationalCommandCenterHeroProps) {
  const { activation } = useWorkspaceActivation();
  const action = guidance.actions[0];
  const conf = guidance.releaseConfidence.level;
  const blockers = compressOperationalBlockers(guidance.explanation.blockers, action?.action);
  const attentionCount = attentionItems.filter(
    (i) => i.severity === 'CRITICAL' || i.severity === 'ACTION_REQUIRED'
  ).length;

  if (loading) {
    return (
      <header className={cn(opSpace.heroY, 'animate-pulse')}>
        <div className="h-8 w-56 bg-muted rounded" />
        <div className="h-20 w-full bg-muted rounded" />
      </header>
    );
  }

  const missingBullets = blockers.slice(0, 3).map((b) => b.replace(/\.$/, ''));

  return (
    <header className={cn(opSpace.heroY, `pb-5 border-b ${opDivider}`)}>
      <div className="flex flex-wrap items-center gap-2">
        <h1 className={opTypePageTitle}>Agreement coordination</h1>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <OperationalStatePill phase={workspacePhase} scope="workspace" />
        {attentionCount > 0 ? (
          <span className={cn(opTypeMeta, 'text-amber-900 dark:text-amber-200')}>
            · {attentionCount} need attention
          </span>
        ) : null}
      </div>

      <div className={cn(opSurface('metric'), opSpace.surfacePad)}>
        <div className="surface-settlement p-4 rounded-lg">
          <ReleaseConfidenceSummary confidence={guidance.releaseConfidence} compact calmMode />
        </div>

        {conf === 'BLOCKED' || missingBullets.length > 0 ? (
          <div className="mt-4 surface-intelligence p-4 rounded-lg">
            <ProgressiveOperationalPanel
              title={OPERATOR_LABELS.releaseBlocked}
              summary={`${labelSafeToRelease(conf)} — complete setup to unlock settlement.`}
              missingItems={missingBullets.length > 0 ? missingBullets : undefined}
            >
              <p className="text-sm text-foreground/80">
                Align funding, participant earnings, and obligations before settlement proceeds.
              </p>
            </ProgressiveOperationalPanel>
          </div>
        ) : null}

        {action ? (
          <div
            className={cn(
              'flex flex-col sm:flex-row sm:items-center gap-3 pt-4 mt-4 border-t',
              opDivider
            )}
          >
            <div className="min-w-0 flex-1">
              <p className={opTypeLabel}>Next step</p>
              <p className="text-sm font-semibold text-foreground mt-0.5">{action.action}</p>
            </div>
            <Button asChild size="sm" className="w-fit shrink-0">
              <SafeOperationalLink
                intent={
                  /earnings|compensation/i.test(action.action)
                    ? 'configure_earnings'
                    : /obligation/i.test(action.action)
                      ? 'review_obligations'
                      : /provider/i.test(action.action)
                        ? 'connect_provider'
                        : 'resolve_issue'
                }
                projectId={activation?.primaryProjectId}
              >
                {action.ctaLabel ?? 'Continue'}
                <ChevronRight className="ml-1 h-3.5 w-3.5" />
              </SafeOperationalLink>
            </Button>
          </div>
        ) : null}
      </div>
    </header>
  );
}
