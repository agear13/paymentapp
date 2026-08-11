'use client';

import * as React from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { toast } from 'sonner';
import {
  invalidateEntitlementsCache,
  useEntitlements,
} from '@/hooks/use-entitlements';
import { clearOnboardingDraft } from '@/lib/onboarding/onboarding-draft-persistence';
import { notifyWorkspaceActivationRefresh } from '@/hooks/use-workspace-activation';
import { ONBOARDING_PRICING_PLANS } from '@/lib/onboarding/operator-onboarding-types';

const PLAN_LABELS = Object.fromEntries(
  ONBOARDING_PRICING_PLANS.map((plan) => [plan.id, plan.name])
) as Record<string, string>;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Handles Stripe Checkout success return on ?billing=success (dashboard or Commercial OS).
 */
export function BillingCheckoutSuccessHandler() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { refresh } = useEntitlements();
  const handledRef = React.useRef(false);

  React.useEffect(() => {
    if (searchParams?.get('billing') !== 'success') return;
    if (handledRef.current) return;
    handledRef.current = true;

    const basePath = pathname?.split('?')[0] ?? '/dashboard';

    (async () => {
      invalidateEntitlementsCache();

      let entitlements = await refresh();
      for (let attempt = 0; attempt < 6 && !entitlements?.hasActivePaidSubscription; attempt++) {
        await sleep(1500);
        invalidateEntitlementsCache();
        entitlements = await refresh();
      }

      if (!entitlements?.hasActivePaidSubscription) {
        toast.error(
          'Payment received, but your subscription is still syncing. Please refresh in a moment.'
        );
        router.replace(basePath);
        return;
      }

      const completeRes = await fetch('/api/onboarding/complete-after-billing', {
        method: 'POST',
        credentials: 'include',
      });

      if (!completeRes.ok) {
        const json = (await completeRes.json().catch(() => ({}))) as { error?: string };
        toast.error(json.error ?? 'Could not finalize onboarding after payment');
        router.replace(basePath);
        return;
      }

      const completeJson = (await completeRes.json()) as {
        effectivePlan?: string;
        plan?: string;
      };

      clearOnboardingDraft();
      notifyWorkspaceActivationRefresh();
      invalidateEntitlementsCache();
      await refresh();

      const planId = completeJson.effectivePlan ?? completeJson.plan ?? entitlements.effectivePlan;
      const planName = PLAN_LABELS[planId] ?? planId;
      toast.success(`Welcome to Provvypay ${planName}! Your subscription is active.`);

      router.replace(basePath);
      router.refresh();
    })();
  }, [refresh, router, searchParams, pathname]);

  return null;
}
