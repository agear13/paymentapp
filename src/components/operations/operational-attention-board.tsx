'use client';

import type { AttentionItem, OperationalSeverity } from '@/lib/operations/severity';
import { groupAttentionBySeverity } from '@/lib/operations/severity';
import { SEVERITY_TONE } from '@/lib/operations/design-language';
import { WhyBlockedExplanation } from '@/components/operations/why-blocked-explanation';
import { SafeOperationalLink } from '@/components/operations/safe-operational-link';
import { opTypeAction, opTypeBodySnug, opTypeMeta, opTypeSection } from '@/lib/design/operational-typography';
import { opSpace } from '@/lib/design/operational-spacing';
import { opDividerSubtle, opInteractiveRow, opSurface } from '@/lib/design/operational-surfaces';
import { useWorkspaceActivation } from '@/hooks/use-workspace-activation';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const SECTION_ORDER: OperationalSeverity[] = [
  'CRITICAL',
  'ACTION_REQUIRED',
  'WARNING',
  'INFORMATIONAL',
];

function ctaIntent(item: AttentionItem): Parameters<typeof SafeOperationalLink>[0]['intent'] {
  const label = `${item.ctaLabel ?? ''} ${item.title} ${item.explanation}`;
  if (/refresh|orchestration|convergence|initialization|resume/i.test(label)) {
    return 'review_obligations';
  }
  if (/earnings|compensation|payout details|confirm/i.test(label)) return 'configure_earnings';
  if (/obligation|funding/i.test(label)) return 'review_obligations';
  if (/release|settlement/i.test(label)) return 'review_release';
  if (/provider|connect/i.test(label)) return 'connect_provider';
  return 'resolve_issue';
}

function severitySurface(severity: OperationalSeverity) {
  if (severity === 'CRITICAL') return opSurface('critical', 'p-0 overflow-hidden');
  if (severity === 'ACTION_REQUIRED') return opSurface('action', 'p-0 overflow-hidden');
  if (severity === 'WARNING') return opSurface('warning', 'p-0 overflow-hidden');
  return opSurface('base', 'p-0 overflow-hidden bg-muted/10');
}

export function OperationalAttentionBoard({
  items,
  calmMode,
}: {
  items: AttentionItem[];
  calmMode?: boolean;
}) {
  const { activation } = useWorkspaceActivation();
  const grouped = groupAttentionBySeverity(items);
  const hasItems = items.length > 0 && !(items.length === 1 && items[0]?.id === 'healthy');

  if (!hasItems) return null;

  return (
    <section className={opSpace.attentionGroupY} aria-label="What requires attention">
      <h2 className={opTypeSection}>Attention</h2>
      {SECTION_ORDER.map((severity) => {
        const sectionItems = grouped[severity];
        if (sectionItems.length === 0) return null;
        const tone = SEVERITY_TONE[severity];
        const isSoft = severity === 'WARNING' || severity === 'INFORMATIONAL';

        return (
          <div key={severity} className="space-y-2">
            <h3 className={cn('text-xs font-semibold uppercase tracking-wide', tone.text)}>
              {tone.label}
            </h3>
            <ul className={cn(calmMode && severitySurface(severity), `divide-y ${opDividerSubtle}`)}>
              {sectionItems.map((item) => (
                <li
                  key={item.id}
                  className={cn(
                    opSpace.listItemY,
                    calmMode && 'px-4',
                    opInteractiveRow,
                    isSoft && 'opacity-95'
                  )}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                    <div className={cn('min-w-0', opSpace.metaY)}>
                      <p
                        className={cn(
                          isSoft ? 'text-sm font-medium text-foreground/90' : opTypeAction
                        )}
                      >
                        {item.title}
                      </p>
                      <p className={opTypeBodySnug}>{item.explanation}</p>
                      {item.confidenceImpact && severity !== 'INFORMATIONAL' && !isSoft ? (
                        <p className={opTypeMeta}>Impact: {item.confidenceImpact}</p>
                      ) : null}
                    </div>
                    {item.ctaHref && item.ctaLabel ? (
                      <Button
                        asChild
                        variant={severity === 'CRITICAL' ? 'default' : 'outline'}
                        size="sm"
                        className="shrink-0 w-fit h-8"
                      >
                        <SafeOperationalLink
                          intent={ctaIntent(item)}
                          projectId={activation?.primaryProjectId}
                          href={item.ctaHref}
                        >
                          {item.ctaLabel}
                        </SafeOperationalLink>
                      </Button>
                    ) : null}
                  </div>
                  {item.whyBlocked && item.whatUnlocks && !isSoft ? (
                    <WhyBlockedExplanation
                      whyBlocked={item.whyBlocked}
                      whatUnlocks={item.whatUnlocks}
                      defaultOpen={false}
                    />
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </section>
  );
}
