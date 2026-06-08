'use client';

import * as React from 'react';
import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { EntitlementFeature, SubscriptionPlan } from '@/lib/entitlements/types';
import {
  FEATURE_DISPLAY_NAMES,
  upgradeBody,
  upgradeCta,
  upgradeHeadline,
} from '@/lib/entitlements/feature-labels';
import { PlanUpgradeDialog } from '@/components/entitlements/plan-upgrade-dialog';
import {
  trackEntitlementAnalytics,
  useEntitlements,
} from '@/hooks/use-entitlements';

type FeatureGateProps = {
  feature: EntitlementFeature;
  children: React.ReactNode;
  /** Replace children entirely when gated (page-level). */
  mode?: 'inline' | 'block';
  fallback?: React.ReactNode;
};

export function FeatureGate({
  feature,
  children,
  mode = 'inline',
  fallback,
}: FeatureGateProps) {
  const { entitlements, loading, isAllowed, getDecision } = useEntitlements();
  const [dialogOpen, setDialogOpen] = React.useState(false);

  const allowed = loading || isAllowed(feature);
  const decision = getDecision(feature);

  React.useEffect(() => {
    if (loading || allowed || !entitlements) return;
    trackEntitlementAnalytics('feature_gate_viewed', {
      organizationId: entitlements.organizationId,
      currentPlan: entitlements.plan,
      requiredPlan: decision?.requiredPlan,
      featureName: FEATURE_DISPLAY_NAMES[feature],
      feature,
    });
  }, [loading, allowed, entitlements, decision, feature]);

  if (loading || allowed) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  const requiredPlan = (decision?.requiredPlan ?? 'professional') as SubscriptionPlan;
  const atLimit =
    feature === 'create_agreement'
      ? decision?.reason === 'active_agreement_limit'
      : feature === 'ai_import'
        ? decision?.reason === 'ai_import_limit'
        : false;

  const blocked = (
    <Card className="p-6 border-dashed">
      <div className="flex flex-col items-center text-center gap-3 max-w-md mx-auto">
        <div className="rounded-full bg-muted p-3">
          <Lock className="h-5 w-5 text-muted-foreground" />
        </div>
        <h3 className="font-semibold">
          {upgradeHeadline(feature, atLimit)}
        </h3>
        <p className="text-sm text-muted-foreground">
          {upgradeBody(feature, requiredPlan, atLimit)}
        </p>
        <Button type="button" onClick={() => setDialogOpen(true)}>
          {upgradeCta(requiredPlan)}
        </Button>
      </div>
      <PlanUpgradeDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        requiredPlan={requiredPlan}
        featureName={FEATURE_DISPLAY_NAMES[feature]}
        currentPlan={entitlements?.plan ?? 'starter'}
        headline={upgradeHeadline(feature, atLimit)}
        body={upgradeBody(feature, requiredPlan, atLimit)}
        organizationId={entitlements?.organizationId}
      />
    </Card>
  );

  if (mode === 'block') {
    return blocked;
  }

  return (
    <div className="relative">
      <div className="pointer-events-none opacity-40 select-none" aria-hidden>
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="pointer-events-auto">{blocked}</div>
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
  const { loading, isAllowed, getDecision, entitlements, plan } = useEntitlements();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const allowed = loading || isAllowed(feature);
  const decision = getDecision(feature);
  const requiredPlan = (decision?.requiredPlan ?? 'professional') as SubscriptionPlan;
  const atLimit =
    feature === 'create_agreement'
      ? decision?.reason === 'active_agreement_limit'
      : feature === 'ai_import'
        ? decision?.reason === 'ai_import_limit'
        : false;

  return (
    <>
      <Button
        {...props}
        disabled={disabled || (!loading && !allowed)}
        onClick={(e) => {
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
        headline={upgradeHeadline(feature, atLimit)}
        body={upgradeBody(feature, requiredPlan, atLimit)}
        organizationId={organizationId ?? entitlements?.organizationId}
      />
    </>
  );
}
