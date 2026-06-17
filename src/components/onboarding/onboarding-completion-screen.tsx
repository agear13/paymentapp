'use client';

import Link from 'next/link';
import { ArrowRight, Check, Info } from 'lucide-react';
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
  /** Pass false if the operator skipped payment provider setup during onboarding */
  paymentProviderConnected?: boolean;
};

type CapabilityItem = {
  label: string;
  completed: boolean;
  /** Shown beneath the label when not completed */
  pendingHint?: string;
};

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
  paymentProviderConnected = true,
}: OnboardingCompletionScreenProps) {
  const capabilities: CapabilityItem[] = [
    {
      label: 'Customer payments enabled',
      completed: paymentProviderConnected,
      pendingHint: 'Connect a payment provider to begin accepting customer payments.',
    },
    { label: 'Revenue sharing configured', completed: true },
    { label: 'Team approvals ready', completed: true },
    { label: 'Settlement automation enabled', completed: true },
  ];

  const allDone = capabilities.every((c) => c.completed);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-3 duration-700">
      <div className="text-center space-y-3 pt-2">
        <p className="text-3xl" aria-hidden>
          🎉
        </p>
        <h2 className="text-2xl font-semibold tracking-tight">
          {allDone ? 'Commercial relationship operational' : 'Almost there'}
        </h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          {allDone
            ? 'Your commercial agreement is ready to operate. Revenue can now flow.'
            : 'Your agreement is set up. Complete the remaining step to unlock all capabilities.'}
        </p>
      </div>

      <div className="rounded-xl border border-[rgba(124,92,255,0.12)] bg-white px-5 py-4 space-y-2">
        <p className="text-sm font-medium">Commercial capabilities</p>
        <ul className="space-y-3">
          {capabilities.map((item) =>
            item.completed ? (
              <li key={item.label} className="flex items-center gap-2.5 text-sm text-foreground">
                <Check className="h-4 w-4 text-emerald-600 shrink-0" aria-hidden />
                {item.label}
              </li>
            ) : (
              <li key={item.label} className="flex items-start gap-2.5">
                <Info className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" aria-hidden />
                <div>
                  <p className="text-sm text-muted-foreground">{item.label}</p>
                  {item.pendingHint ? (
                    <p className="text-xs text-amber-700/80 mt-0.5">{item.pendingHint}</p>
                  ) : null}
                </div>
              </li>
            )
          )}
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
