'use client';

import Link from 'next/link';
import type { AttentionItem, OperationalSeverity } from '@/lib/operations/severity';
import { groupAttentionBySeverity } from '@/lib/operations/severity';
import { SEVERITY_TONE } from '@/lib/operations/design-language';
import { WhyBlockedExplanation } from '@/components/operations/why-blocked-explanation';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const SECTION_ORDER: OperationalSeverity[] = [
  'CRITICAL',
  'ACTION_REQUIRED',
  'WARNING',
  'INFORMATIONAL',
];

export function OperationalAttentionBoard({ items }: { items: AttentionItem[] }) {
  const grouped = groupAttentionBySeverity(items);

  return (
    <section className="space-y-8" aria-label="What requires attention">
      <h2 className="text-sm font-semibold">What requires your attention</h2>
      {SECTION_ORDER.map((severity) => {
        const sectionItems = grouped[severity];
        if (sectionItems.length === 0) return null;
        const tone = SEVERITY_TONE[severity];
        return (
          <div key={severity} className="space-y-3">
            <h3 className={cn('text-xs font-medium uppercase tracking-wide', tone.text)}>
              {tone.label}
            </h3>
            <ul className="divide-y divide-border/50 border-t border-border/50">
              {sectionItems.map((item) => (
                <li key={item.id} className="py-4 space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <p className="text-sm font-medium">{item.title}</p>
                      <p className="text-sm text-muted-foreground">{item.explanation}</p>
                      {item.projectName ? (
                        <p className="text-xs text-muted-foreground">Project: {item.projectName}</p>
                      ) : null}
                      {item.confidenceImpact ? (
                        <p className="text-xs text-muted-foreground">
                          Impact: {item.confidenceImpact}
                        </p>
                      ) : null}
                    </div>
                    {item.ctaHref && item.ctaLabel ? (
                      <Button asChild variant="outline" size="sm" className="shrink-0 w-fit">
                        <Link href={item.ctaHref}>{item.ctaLabel}</Link>
                      </Button>
                    ) : null}
                  </div>
                  {item.whyBlocked && item.whatUnlocks ? (
                    <WhyBlockedExplanation
                      whyBlocked={item.whyBlocked}
                      whatUnlocks={item.whatUnlocks}
                      recommendedStep={item.recommendedStep}
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
