'use client';

import Link from 'next/link';
import { ArrowRight, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { OnboardingPricingPanel } from '@/components/onboarding/onboarding-pricing-panel';

type OnboardingCompletionScreenProps = {
  projectId: string | null;
  selectedPlanId: string;
  onSelectPlan: (planId: string) => void;
  onGoToDashboard: () => void;
  onCreateAnother: () => void;
  checkoutLoading?: boolean;
  csrfReady?: boolean;
  isLoading?: boolean;
  onCheckout?: () => void;
};

const CAPABILITY_ITEMS = [
  'Collect payments',
  'Share revenue automatically',
  'Coordinate participants',
  'Track payment obligations',
] as const;

export function OnboardingCompletionScreen({
  projectId,
  selectedPlanId,
  onSelectPlan,
  onGoToDashboard,
  onCreateAnother,
  checkoutLoading = false,
  csrfReady = true,
  isLoading = false,
  onCheckout,
}: OnboardingCompletionScreenProps) {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-3 duration-700">
      <div className="text-center space-y-3 pt-2">
        <p className="text-3xl" aria-hidden>
          🎉
        </p>
        <h2 className="text-2xl font-semibold tracking-tight">Everything&apos;s ready</h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          You&apos;re ready to operate. Provvypay has organised your agreement — now you can run
          your business.
        </p>
      </div>

      <div className="rounded-xl border border-[rgba(124,92,255,0.12)] bg-white px-5 py-4 space-y-2">
        <p className="text-sm font-medium">Your business can now</p>
        <ul className="space-y-2">
          {CAPABILITY_ITEMS.map((item) => (
            <li key={item} className="flex items-center gap-2.5 text-sm text-foreground">
              <Check className="h-4 w-4 text-emerald-600 shrink-0" aria-hidden />
              {item}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Button
          type="button"
          className="flex-1"
          disabled={!csrfReady || isLoading}
          onClick={onGoToDashboard}
        >
          {isLoading && <span className="mr-2">…</span>}
          Go to Dashboard
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
        <Button type="button" variant="outline" className="flex-1" onClick={onCreateAnother}>
          Create another agreement
        </Button>
      </div>

      {projectId ? (
        <p className="text-center">
          <Link
            href={`/dashboard/projects/${encodeURIComponent(projectId)}`}
            className="text-sm text-[rgb(124,92,255)] hover:underline"
          >
            View your agreement
          </Link>
        </p>
      ) : null}

      <Collapsible>
        <CollapsibleTrigger asChild>
          <Button type="button" variant="ghost" className="w-full text-muted-foreground">
            Choose a plan (optional)
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-4 space-y-4">
          <OnboardingPricingPanel
            selectedPlanId={selectedPlanId}
            onSelectPlan={onSelectPlan}
            checkoutLoading={checkoutLoading || !csrfReady}
          />
          {selectedPlanId === 'professional' || selectedPlanId === 'growth' ? (
            <Button
              type="button"
              className="w-full"
              disabled={!csrfReady || checkoutLoading}
              onClick={onCheckout}
            >
              Continue to Checkout
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : null}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
