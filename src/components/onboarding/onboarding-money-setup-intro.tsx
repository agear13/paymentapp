'use client';

import { ArrowRight, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { OnboardingSuccessMoment } from '@/components/onboarding/onboarding-success-moment';
import { continueButtonLabel } from '@/lib/onboarding/onboarding-assistant-copy';

type OnboardingMoneySetupIntroProps = {
  onContinue: () => void;
  isLoading?: boolean;
  disabled?: boolean;
};

/** Bridge between agreement review and payment setup. */
export function OnboardingMoneySetupIntro({
  onContinue,
  isLoading = false,
  disabled = false,
}: OnboardingMoneySetupIntroProps) {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-500">
      <OnboardingSuccessMoment message="Agreement reviewed" />

      <div className="rounded-xl border border-[rgba(124,92,255,0.12)] bg-white px-5 py-6 space-y-3">
        <p className="text-sm text-foreground leading-relaxed">
          We&apos;ve identified your participants, payment terms and obligations.
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Let&apos;s finish getting you ready to accept money and pay participants.
        </p>
      </div>

      <ul className="space-y-2 text-sm text-muted-foreground">
        {['How you collect revenue', 'How participants get paid'].map((item) => (
          <li key={item} className="flex items-center gap-2">
            <Check className="h-3.5 w-3.5 text-[rgb(124,92,255)] shrink-0" aria-hidden />
            {item}
          </li>
        ))}
      </ul>

      <div className="flex justify-end pt-2">
        <Button type="button" disabled={disabled || isLoading} onClick={onContinue}>
          {isLoading ? 'Loading…' : continueButtonLabel('Set up payments')}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
