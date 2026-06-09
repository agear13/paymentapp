'use client';

import { Check } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  GROWTH_PLAN_SUMMARY,
  PROFESSIONAL_PLAN_SUMMARY,
  STARTER_PLAN_INCLUDES,
  STARTER_UPGRADE_COMPARISON,
} from '@/lib/entitlements/plan-onboarding-summaries';

type OnboardingPlanEntitlementSummaryProps = {
  planId: string;
  onSelectProfessional?: () => void;
  compact?: boolean;
  className?: string;
};

export function OnboardingPlanEntitlementSummary({
  planId,
  onSelectProfessional,
  compact = false,
  className,
}: OnboardingPlanEntitlementSummaryProps) {
  if (planId === 'starter') {
    return (
      <Card
        className={cn(
          'border border-[rgba(124,92,255,0.15)] bg-[rgba(124,92,255,0.04)]',
          compact ? 'p-3' : 'p-4 sm:p-5',
          className
        )}
      >
        <p className={cn('font-medium text-foreground', compact ? 'text-sm' : 'text-sm sm:text-base')}>
          Starter Plan Includes:
        </p>
        <ul className={cn('mt-2 space-y-1.5', compact ? 'text-xs' : 'text-sm')}>
          {STARTER_PLAN_INCLUDES.map((item) => (
            <li key={item} className="flex items-start gap-2 text-muted-foreground">
              <Check className="h-3.5 w-3.5 shrink-0 mt-0.5 text-[rgb(124,92,255)]" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
        {onSelectProfessional ? (
          <button
            type="button"
            onClick={onSelectProfessional}
            className={cn(
              'mt-3 text-left text-muted-foreground hover:text-[rgb(124,92,255)] transition-colors',
              compact ? 'text-xs leading-relaxed' : 'text-xs sm:text-sm leading-relaxed'
            )}
          >
            {STARTER_UPGRADE_COMPARISON}
          </button>
        ) : (
          <p
            className={cn(
              'mt-3 text-muted-foreground leading-relaxed',
              compact ? 'text-xs' : 'text-xs sm:text-sm'
            )}
          >
            {STARTER_UPGRADE_COMPARISON}
          </p>
        )}
      </Card>
    );
  }

  if (planId === 'professional') {
    return (
      <Card className={cn('p-4 surface-intelligence border-0', className)}>
        <p className={cn('text-muted-foreground leading-relaxed', compact ? 'text-xs' : 'text-sm')}>
          {PROFESSIONAL_PLAN_SUMMARY}
        </p>
      </Card>
    );
  }

  if (planId === 'growth') {
    return (
      <Card className={cn('p-4 surface-intelligence border-0', className)}>
        <p className={cn('text-muted-foreground leading-relaxed', compact ? 'text-xs' : 'text-sm')}>
          {GROWTH_PLAN_SUMMARY}
        </p>
      </Card>
    );
  }

  return null;
}
