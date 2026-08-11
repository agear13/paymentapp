'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { EntitlementFeature, SubscriptionPlan } from '@/lib/entitlements/types';
import { FEATURE_DISPLAY_NAMES } from '@/lib/entitlements/feature-labels';
import { getPlanCatalogEntry, planDisplayName } from '@/lib/plans/plan-catalog';
import { PlanComparisonDialog } from '@/components/plans/plan-comparison-dialog';
import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';
import {
  trackEntitlementAnalytics,
  useEntitlements,
} from '@/hooks/use-entitlements';
import { startSaasCheckout, type SaasCheckoutPlan } from '@/lib/billing/start-saas-checkout.client';
import { invalidateEntitlementsCache } from '@/hooks/use-entitlements';

export type EntitlementUpgradePanelProps = {
  feature: EntitlementFeature;
  /** Optional page title above the panel */
  pageTitle?: string;
  /** Extra context shown below the body */
  contextNote?: React.ReactNode;
  /** Slot rendered below upgrade actions (e.g. Stripe readiness) */
  footer?: React.ReactNode;
  className?: string;
};

function resolveRequiredPlan(
  feature: EntitlementFeature,
  decisionRequired?: SubscriptionPlan
): SubscriptionPlan {
  if (decisionRequired) return decisionRequired;
  if (
    feature === 'team_members' ||
    feature === 'advanced_reporting' ||
    feature === 'automated_settlement_coordination'
  ) {
    return 'growth';
  }
  if (
    feature === 'multi_organisation' ||
    feature === 'api_access' ||
    feature === 'custom_workflows' ||
    feature === 'custom_settlement_rules'
  ) {
    return 'enterprise';
  }
  return 'professional';
}

export function EntitlementUpgradePanel({
  feature,
  pageTitle,
  contextNote,
  footer,
  className,
}: EntitlementUpgradePanelProps) {
  const router = useRouter();
  const { entitlements, plan, getDecision } = useEntitlements();
  const [compareOpen, setCompareOpen] = React.useState(false);
  const [checkoutLoading, setCheckoutLoading] = React.useState(false);
  const [checkoutError, setCheckoutError] = React.useState<string | null>(null);

  const decision = getDecision(feature);
  const requiredPlan = resolveRequiredPlan(feature, decision?.requiredPlan);
  const targetPlan = getPlanCatalogEntry(requiredPlan);
  const currentPlanName = planDisplayName(plan);
  const subscriptionInactive = decision?.reason === 'subscription_inactive';

  const headline =
    feature === 'payment_links'
      ? 'Payment Links are available on Professional'
      : `${FEATURE_DISPLAY_NAMES[feature]} requires ${targetPlan.name}`;

  const body =
    subscriptionInactive
      ? `Complete checkout to activate your ${targetPlan.name} subscription and unlock ${FEATURE_DISPLAY_NAMES[feature]}.`
      : feature === 'payment_links'
        ? `You're currently on ${currentPlanName}. ${targetPlan.positioning}`
        : `${FEATURE_DISPLAY_NAMES[feature]} is available on ${targetPlan.name} and above.`;

  React.useEffect(() => {
    if (!entitlements) return;
    trackEntitlementAnalytics('feature_gate_viewed', {
      organizationId: entitlements.organizationId,
      currentPlan: entitlements.plan,
      requiredPlan,
      featureName: FEATURE_DISPLAY_NAMES[feature],
      feature,
    });
  }, [entitlements, feature, requiredPlan]);

  async function handleUpgrade() {
    if (requiredPlan === 'enterprise') {
      window.location.href = 'mailto:sales@provvypay.com?subject=Enterprise%20Plan%20Inquiry';
      return;
    }
    if (requiredPlan !== 'professional' && requiredPlan !== 'growth') return;

    setCheckoutLoading(true);
    setCheckoutError(null);
    trackEntitlementAnalytics('upgrade_clicked', {
      organizationId: entitlements?.organizationId,
      currentPlan: plan,
      requiredPlan,
      featureName: FEATURE_DISPLAY_NAMES[feature],
    });

    try {
      const result = await startSaasCheckout({
        plan: requiredPlan as SaasCheckoutPlan,
        context: 'upgrade',
        returnTo: typeof window !== 'undefined' ? window.location.pathname : undefined,
      });
      if ('error' in result) {
        setCheckoutError(result.error);
        return;
      }
      invalidateEntitlementsCache();
      window.location.href = result.url;
    } finally {
      setCheckoutLoading(false);
    }
  }

  return (
    <div className={`animate-fade-up space-y-6 pb-16 ${className ?? ''}`}>
      {pageTitle ? (
        <header>
          <h1 className="text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">{pageTitle}</h1>
        </header>
      ) : null}

      <div className="rounded-2xl border border-border bg-card p-6 shadow-card sm:p-8">
        <h2 className="text-xl font-semibold tracking-[-0.02em]">{headline}</h2>
        <p className="mt-2 text-[15px] text-ink-soft">{body}</p>
        {contextNote ? <div className="mt-3 text-[14px] text-ink-soft">{contextNote}</div> : null}

        <div className="mt-6 rounded-xl border border-primary/15 bg-accent/40 p-5">
          <div className="text-[13px] font-semibold uppercase tracking-wider text-ink-soft">
            {targetPlan.name}
          </div>
          <div className="mt-1 text-2xl font-semibold">{targetPlan.price}</div>
          <p className="mt-2 text-[14px] text-ink-soft">{targetPlan.positioning}</p>
          <ul className="mt-4 space-y-2">
            {targetPlan.features.map((item) => (
              <li key={item} className="flex items-start gap-2 text-[14px]">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Button type="button" onClick={handleUpgrade} disabled={checkoutLoading}>
            {checkoutLoading
              ? 'Redirecting…'
              : requiredPlan === 'enterprise'
                ? 'Contact Sales'
                : `Upgrade to ${targetPlan.name}`}
          </Button>
          <Button type="button" variant="outline" onClick={() => setCompareOpen(true)}>
            Compare plans
          </Button>
          <Button type="button" variant="ghost" onClick={() => router.push(COMMERCIAL_OS_ROUTES.planBilling)}>
            View plan details
          </Button>
        </div>
        {checkoutError ? (
          <p className="mt-3 text-sm text-destructive">{checkoutError}</p>
        ) : null}
      </div>

      {footer}

      <PlanComparisonDialog open={compareOpen} onOpenChange={setCompareOpen} highlightPlan={requiredPlan} />
    </div>
  );
}
