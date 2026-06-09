'use client';

import { IntelligenceBadge } from '@/components/provvypay/intelligence-badge';
import { OnboardingVisualProgress } from '@/components/provvypay/onboarding-visual-progress';
import { ProvvypayLogoMark } from '@/components/provvypay/provvypay-logo-mark';
import {
  onboardingStepSubtext,
  onboardingStepTitle,
  type OnboardingStep,
} from '@/lib/onboarding/operator-onboarding-types';
import { cn } from '@/lib/utils';

type OnboardingVisualHeaderProps = {
  step: OnboardingStep;
  centered?: boolean;
  compact?: boolean;
  showIntelligenceBadge?: boolean;
  showLogo?: boolean;
  className?: string;
};

export function OnboardingVisualHeader({
  step,
  centered = false,
  compact = false,
  showIntelligenceBadge = true,
  showLogo = true,
  className,
}: OnboardingVisualHeaderProps) {
  const title = onboardingStepTitle(step);
  const subtext = onboardingStepSubtext(step);
  const isIntelligenceStep = step === 'agreement_review';

  return (
    <div
      className={cn(
        'animate-in fade-in slide-in-from-bottom-2 duration-500',
        compact ? 'space-y-4' : 'space-y-6',
        className
      )}
    >
      {showLogo ? (
        <div className={cn(centered && 'flex justify-center')}>
          <ProvvypayLogoMark size="sm" />
        </div>
      ) : null}

      <OnboardingVisualProgress step={step} />

      <div className={cn('space-y-2', centered && 'text-center')}>
        {showIntelligenceBadge && isIntelligenceStep ? (
          <div className={cn(centered && 'flex justify-center')}>
            <IntelligenceBadge pulse />
          </div>
        ) : null}
        <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground">{title}</h2>
        {subtext ? (
          <p
            className={cn(
              'text-sm sm:text-base text-muted-foreground leading-relaxed',
              centered ? 'mx-auto max-w-md' : 'max-w-xl'
            )}
          >
            {subtext}
          </p>
        ) : null}
      </div>
    </div>
  );
}
