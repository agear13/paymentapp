'use client';

import * as React from 'react';
import type { EntitlementFeature } from '@/lib/entitlements/types';
import { EntitlementUpgradePanel } from '@/components/entitlements/entitlement-upgrade-panel';
import { EntitlementLoading } from '@/components/entitlements/entitlement-loading';
import {
  trackEntitlementAnalytics,
  useEntitlements,
} from '@/hooks/use-entitlements';
import { FEATURE_DISPLAY_NAMES } from '@/lib/entitlements/feature-labels';
import { PlanUpgradeDialog } from '@/components/entitlements/plan-upgrade-dialog';
import { upgradeBody, upgradeCta, upgradeHeadline } from '@/lib/entitlements/feature-labels';
import type { SubscriptionPlan } from '@/lib/entitlements/types';
import { Button } from '@/components/ui/button';

type FeatureGateProps = {
  feature: EntitlementFeature;
  children: React.ReactNode;
  /** Replace children entirely when gated (page-level). */
  mode?: 'inline' | 'block';
  fallback?: React.ReactNode;
  pageTitle?: string;
};

export function FeatureGate({
  feature,
  children,
  mode = 'inline',
  fallback,
  pageTitle,
}: FeatureGateProps) {
  const { entitlements, loading, isAllowed, getDecision, pilotBypass } = useEntitlements();
  const [dialogOpen, setDialogOpen] = React.useState(false);

  const allowed = pilotBypass || isAllowed(feature);
  const decision = getDecision(feature);

  React.useEffect(() => {
    if (loading || !entitlements || allowed) return;
    trackEntitlementAnalytics('feature_gate_viewed', {
      organizationId: entitlements.organizationId,
      currentPlan: entitlements.plan,
      requiredPlan: decision?.requiredPlan,
      featureName: FEATURE_DISPLAY_NAMES[feature],
      feature,
    });
  }, [loading, allowed, entitlements, decision, feature]);

  if (loading) {
    return <EntitlementLoading />;
  }

  if (allowed) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  if (mode === 'block') {
    return <EntitlementUpgradePanel feature={feature} pageTitle={pageTitle} />;
  }

  const requiredPlan = (decision?.requiredPlan ?? 'professional') as SubscriptionPlan;
  const atLimit =
    feature === 'create_agreement'
      ? decision?.reason === 'active_agreement_limit'
      : feature === 'ai_import'
        ? decision?.reason === 'ai_import_limit'
        : false;
  const subscriptionInactive = decision?.reason === 'subscription_inactive';
  const trialExpired = decision?.reason === 'trial_expired';

  return (
    <div className="relative">
      <div className="pointer-events-none opacity-40 select-none" aria-hidden>
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="pointer-events-auto max-w-md w-full rounded-xl border bg-card p-4 shadow-lg text-center space-y-3">
          <h3 className="font-semibold text-sm">
            {upgradeHeadline(feature, atLimit, subscriptionInactive, trialExpired)}
          </h3>
          <p className="text-sm text-muted-foreground">
            {upgradeBody(feature, requiredPlan, atLimit, subscriptionInactive, trialExpired)}
          </p>
          <Button type="button" size="sm" onClick={() => setDialogOpen(true)}>
            {upgradeCta(requiredPlan)}
          </Button>
          <PlanUpgradeDialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            requiredPlan={requiredPlan}
            featureName={FEATURE_DISPLAY_NAMES[feature]}
            currentPlan={entitlements?.plan}
            headline={upgradeHeadline(feature, atLimit, subscriptionInactive, trialExpired)}
            body={upgradeBody(feature, requiredPlan, atLimit, subscriptionInactive, trialExpired)}
            organizationId={entitlements?.organizationId}
          />
        </div>
      </div>
    </div>
  );
}

type GatedButtonProps = React.ComponentProps<typeof Button> & {
  feature: EntitlementFeature;
  organizationId?: string;
};

/** Disables a button and opens upgrade dialog when entitlement is missing. */
export function GatedButton({
  feature,
  organizationId,
  onClick,
  disabled,
  children,
  ...props
}: GatedButtonProps) {
  const { loading, isAllowed, getDecision, entitlements, plan, pilotBypass } = useEntitlements();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const allowed = pilotBypass || isAllowed(feature);
  const decision = getDecision(feature);
  const requiredPlan = (decision?.requiredPlan ?? 'professional') as SubscriptionPlan;
  const atLimit =
    feature === 'create_agreement'
      ? decision?.reason === 'active_agreement_limit'
      : feature === 'ai_import'
        ? decision?.reason === 'ai_import_limit'
        : false;
  const subscriptionInactive = decision?.reason === 'subscription_inactive';
  const trialExpired = decision?.reason === 'trial_expired';

  return (
    <>
      <Button
        {...props}
        disabled={disabled || loading || !allowed}
        onClick={(e) => {
          if (loading) return;
          if (!allowed) {
            setDialogOpen(true);
            return;
          }
          onClick?.(e);
        }}
      >
        {children}
      </Button>
      <PlanUpgradeDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        requiredPlan={requiredPlan}
        featureName={FEATURE_DISPLAY_NAMES[feature]}
        currentPlan={plan}
        headline={upgradeHeadline(feature, atLimit, subscriptionInactive, trialExpired)}
        body={upgradeBody(feature, requiredPlan, atLimit, subscriptionInactive, trialExpired)}
        organizationId={organizationId ?? entitlements?.organizationId}
      />
    </>
  );
}
