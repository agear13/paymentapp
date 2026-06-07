'use client';

import * as React from 'react';
import { Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { ONBOARDING_PRICING_PLANS } from '@/lib/onboarding/operator-onboarding-types';

type OnboardingPricingPanelProps = {
  selectedPlanId: string;
  onSelectPlan: (planId: string) => void;
  className?: string;
};

export function OnboardingPricingPanel({
  selectedPlanId,
  onSelectPlan,
  className,
}: OnboardingPricingPanelProps) {
  return (
    <div className={cn('space-y-4', className)}>
      <div>
        <p className="text-sm font-semibold mb-1">Choose How You&apos;d Like To Continue</p>
        <p className="text-sm text-muted-foreground">
          Continue on Starter without friction, or choose a plan that matches your coordination
          needs.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {ONBOARDING_PRICING_PLANS.map((plan) => {
          const isSelected = selectedPlanId === plan.id;
          const isRecommended = plan.recommended;

          return (
            <button
              key={plan.id}
              type="button"
              onClick={() => onSelectPlan(plan.id)}
              className={cn(
                'relative rounded-xl border p-5 text-left transition-all duration-200 hover:border-[rgba(124,92,255,0.25)] hover:shadow-sm',
                isSelected &&
                  'border-[rgb(124,92,255)] bg-[rgba(124,92,255,0.06)] ring-2 ring-[rgba(124,92,255,0.12)] shadow-sm',
                isRecommended && !isSelected && 'border-[rgba(124,92,255,0.3)]'
              )}
            >
              {isRecommended && !isSelected ? (
                <Badge className="absolute top-3 right-3" variant="default">
                  Recommended
                </Badge>
              ) : null}
              {isSelected ? (
                <span className="absolute top-3 right-3 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="h-3 w-3" />
                </span>
              ) : null}
              <p className="font-medium pr-16">{plan.name}</p>
              <p className="text-lg font-semibold mt-1">{plan.price}</p>
              <p className="text-sm text-muted-foreground mt-2">{plan.tagline}</p>
              <ul className="mt-3 space-y-1">
                {plan.features.map((feature) => (
                  <li key={feature} className="text-xs text-muted-foreground flex items-start gap-1.5">
                    <Check className="h-3 w-3 text-emerald-600 shrink-0 mt-0.5" />
                    {feature}
                  </li>
                ))}
              </ul>
            </button>
          );
        })}
      </div>

      {selectedPlanId === 'starter' ? (
        <Card className="p-4 surface-intelligence border-0">
          <p className="text-sm text-muted-foreground">
            Starter is free and ideal for exploring Agreement Intelligence. Upgrade anytime from
            Settings.
          </p>
        </Card>
      ) : selectedPlanId === 'enterprise' ? (
        <Button type="button" variant="outline" className="w-full" asChild>
          <a href="mailto:sales@provvypay.com">Contact Sales</a>
        </Button>
      ) : null}
    </div>
  );
}
