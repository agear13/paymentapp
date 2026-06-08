'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ONBOARDING_PRICING_PLANS } from '@/lib/onboarding/operator-onboarding-types';
import type { SubscriptionPlan } from '@/lib/entitlements/types';
import { upgradeCta } from '@/lib/entitlements/feature-labels';
import { requiredPlanLabel } from '@/lib/entitlements/plans';
import {
  trackEntitlementAnalytics,
  useEntitlements,
  invalidateEntitlementsCache,
} from '@/hooks/use-entitlements';
import { startSaasCheckout } from '@/lib/billing/start-saas-checkout.client';

export type PlanUpgradeDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requiredPlan: SubscriptionPlan;
  featureName: string;
  currentPlan: SubscriptionPlan;
  headline?: string;
  body?: string;
  organizationId?: string;
};

export function PlanUpgradeDialog({
  open,
  onOpenChange,
  requiredPlan,
  featureName,
  currentPlan,
  headline,
  body,
  organizationId,
}: PlanUpgradeDialogProps) {
  const { refresh } = useEntitlements();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const targetPlan = ONBOARDING_PRICING_PLANS.find((p) => p.id === requiredPlan);

  React.useEffect(() => {
    if (!open) return;
    setError(null);
    trackEntitlementAnalytics('upgrade_prompt_opened', {
      organizationId,
      currentPlan,
      requiredPlan,
      featureName,
    });
  }, [open, organizationId, currentPlan, requiredPlan, featureName]);

  async function handleUpgradeClick() {
    trackEntitlementAnalytics('upgrade_clicked', {
      organizationId,
      currentPlan,
      requiredPlan,
      featureName,
    });

    if (requiredPlan === 'enterprise') {
      window.location.href = 'mailto:sales@provvypay.com?subject=Enterprise%20Plan';
      return;
    }

    if (requiredPlan !== 'professional' && requiredPlan !== 'growth') {
      onOpenChange(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await startSaasCheckout({
        plan: requiredPlan,
        context: 'upgrade',
      });
      if ('error' in result) {
        throw new Error(result.error);
      }
      invalidateEntitlementsCache();
      await refresh();
      window.location.href = result.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Checkout failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{headline ?? `Upgrade to unlock ${featureName}`}</DialogTitle>
          <DialogDescription>
            {body ?? `${featureName} is available on ${requiredPlanLabel(requiredPlan)} and above.`}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border p-4 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Current plan</span>
            <Badge variant="secondary">{requiredPlanLabel(currentPlan)}</Badge>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Required plan</span>
            <Badge>{requiredPlanLabel(requiredPlan)}</Badge>
          </div>
          {targetPlan ? (
            <ul className="text-xs text-muted-foreground space-y-1 pt-1">
              {targetPlan.features.slice(0, 5).map((f) => (
                <li key={f}>• {f}</li>
              ))}
            </ul>
          ) : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Not now
          </Button>
          <Button type="button" onClick={handleUpgradeClick} disabled={loading}>
            {loading ? 'Redirecting…' : upgradeCta(requiredPlan)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
