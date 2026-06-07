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
  showIntelligenceBadge?: boolean;
  className?: string;
};

export function OnboardingVisualHeader({
  step,
  centered = false,
  showIntelligenceBadge = true,
  className,
}: OnboardingVisualHeaderProps) {
  const title = onboardingStepTitle(step);
  const subtext = onboardingStepSubtext(step);
  const isIntelligenceStep = step === 'agreement_review';

  return (
    <div className={cn('space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500', className)}>
      {!centered ? (
        <ProvvypayLogoMark size="sm" />
      ) : null}

      <OnboardingVisualProgress step={step} />

      <div className={cn('space-y-3', centered && 'text-center')}>
        {showIntelligenceBadge && isIntelligenceStep ? (
          <div className={cn(centered && 'flex justify-center')}>
            <IntelligenceBadge pulse />
          </div>
        ) : null}
        <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">{title}</h2>
        {subtext ? (
          <p className="text-base text-muted-foreground leading-relaxed max-w-xl">{subtext}</p>
        ) : null}
      </div>
    </div>
  );
}
