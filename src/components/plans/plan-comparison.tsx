'use client';

import * as React from 'react';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  PLAN_CATALOG,
  PLAN_CATALOG_ORDER,
  type PlanCatalogId,
} from '@/lib/plans/plan-catalog';
import { startSaasCheckout, type SaasCheckoutPlan } from '@/lib/billing/start-saas-checkout.client';
import { cn } from '@/lib/utils';

type PlanComparisonProps = {
  highlightPlan?: PlanCatalogId;
  currentPlan?: PlanCatalogId;
  className?: string;
  onSelectPlan?: (planId: PlanCatalogId) => void;
};

export function PlanComparison({
  highlightPlan,
  currentPlan,
  className,
  onSelectPlan,
}: PlanComparisonProps) {
  const [loadingPlan, setLoadingPlan] = React.useState<PlanCatalogId | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSelect(planId: PlanCatalogId) {
    if (onSelectPlan) {
      onSelectPlan(planId);
      return;
    }

    const entry = PLAN_CATALOG[planId];
    if (!entry.selfServeCheckout) {
      if (planId === 'enterprise') {
        window.location.href = 'mailto:sales@provvypay.com?subject=Enterprise%20Plan%20Inquiry';
      }
      return;
    }

    setLoadingPlan(planId);
    setError(null);
    try {
      const result = await startSaasCheckout({
        plan: planId as SaasCheckoutPlan,
        context: 'upgrade',
        returnTo: typeof window !== 'undefined' ? window.location.pathname : undefined,
      });
      if ('error' in result) {
        setError(result.error);
        return;
      }
      window.location.href = result.url;
    } finally {
      setLoadingPlan(null);
    }
  }

  return (
    <div className={cn('space-y-4', className)}>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {PLAN_CATALOG_ORDER.map((planId) => {
          const plan = PLAN_CATALOG[planId];
          const isCurrent = currentPlan === planId;
          const isHighlight = highlightPlan === planId;

          return (
            <div
              key={planId}
              className={cn(
                'rounded-2xl border bg-card p-5 shadow-card flex flex-col',
                isHighlight && 'border-primary/40 ring-1 ring-primary/20',
                isCurrent && 'border-emerald-500/30'
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{plan.name}</p>
                  <p className="mt-1 text-lg font-semibold">{plan.price}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {isCurrent ? <Badge variant="secondary">Current</Badge> : null}
                  {isHighlight && !isCurrent ? <Badge>Recommended</Badge> : null}
                </div>
              </div>
              <p className="mt-3 text-[13px] text-ink-soft leading-relaxed">{plan.positioning}</p>
              <ul className="mt-4 flex-1 space-y-2">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-[13px]">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              {!isCurrent ? (
                <Button
                  type="button"
                  className="mt-5 w-full"
                  variant={isHighlight ? 'default' : 'outline'}
                  disabled={loadingPlan !== null}
                  onClick={() => void handleSelect(planId)}
                >
                  {loadingPlan === planId
                    ? 'Redirecting…'
                    : planId === 'enterprise'
                      ? 'Contact Sales'
                      : planId === 'starter'
                        ? 'Current default'
                        : `Choose ${plan.name}`}
                </Button>
              ) : null}
            </div>
          );
        })}
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
