'use client';

import * as React from 'react';
import { CreditCard, ExternalLink, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ONBOARDING_PRICING_PLANS } from '@/lib/onboarding/operator-onboarding-types';
import { startSaasCheckout, type SaasCheckoutPlan } from '@/lib/billing/start-saas-checkout.client';
import { openBillingPortal } from '@/lib/billing/open-billing-portal.client';
import { invalidateEntitlementsCache, useEntitlements } from '@/hooks/use-entitlements';

type BillingSummary = {
  organizationId: string;
  plan: string;
  effectivePlan: string;
  status: string;
  hasActivePaidSubscription: boolean;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  currentPeriodEnd: string | null;
  planLabel: string;
  statusLabel: string;
  renewalLabel: string | null;
  paymentMethod: {
    brand: string;
    last4: string;
    expMonth: number | null;
    expYear: number | null;
    label: string;
  } | null;
  canManageInPortal: boolean;
};

const UPGRADE_PLANS = ONBOARDING_PRICING_PLANS.filter(
  (plan) => plan.id === 'professional' || plan.id === 'growth'
);

function statusVariant(
  status: string
): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'active' || status === 'trialing') return 'default';
  if (status === 'past_due') return 'destructive';
  return 'secondary';
}

export function BillingSettingsPanel() {
  const { refresh } = useEntitlements();
  const [summary, setSummary] = React.useState<BillingSummary | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [portalLoading, setPortalLoading] = React.useState(false);
  const [checkoutPlan, setCheckoutPlan] = React.useState<SaasCheckoutPlan | null>(null);

  const loadSummary = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/billing/summary', { credentials: 'include' });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(json.error ?? 'Failed to load billing details');
      }
      const json = (await res.json()) as BillingSummary;
      setSummary(json);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load billing details');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  async function handleManageSubscription() {
    setPortalLoading(true);
    try {
      const result = await openBillingPortal();
      if ('error' in result) {
        toast.error(result.error);
        return;
      }
      window.location.href = result.url;
    } finally {
      setPortalLoading(false);
    }
  }

  async function handleUpgrade(plan: SaasCheckoutPlan) {
    setCheckoutPlan(plan);
    try {
      const result = await startSaasCheckout({ plan, context: 'upgrade' });
      if ('error' in result) {
        toast.error(result.error);
        return;
      }
      invalidateEntitlementsCache();
      await refresh();
      window.location.href = result.url;
    } finally {
      setCheckoutPlan(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading billing details…
      </div>
    );
  }

  if (!summary) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        Billing details are unavailable right now. Please try again later.
      </p>
    );
  }

  if (!summary.stripeCustomerId) {
    return (
      <div className="space-y-6">
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>Upgrade your workspace</CardTitle>
            <CardDescription>
              You are on the {summary.planLabel} plan. Subscribe to unlock payment links,
              referrals, advanced reporting, and more.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {UPGRADE_PLANS.map((plan) => (
              <div key={plan.id} className="rounded-xl border p-5 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{plan.name}</p>
                    <p className="text-lg font-semibold">{plan.price}</p>
                  </div>
                  {plan.recommended ? <Badge>Recommended</Badge> : null}
                </div>
                <p className="text-sm text-muted-foreground">{plan.tagline}</p>
                <Button
                  type="button"
                  className="w-full"
                  disabled={checkoutPlan !== null}
                  onClick={() => handleUpgrade(plan.id as SaasCheckoutPlan)}
                >
                  {checkoutPlan === plan.id ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Upgrade to {plan.name}
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Enterprise</CardTitle>
            <CardDescription>Custom workflows, settlement rules, and dedicated support.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button type="button" variant="outline" asChild>
              <a href="mailto:sales@provvypay.com?subject=Enterprise%20Plan%20Inquiry">
                Contact Sales
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Subscription</CardTitle>
          <CardDescription>Your workspace plan and renewal details from Stripe.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-muted-foreground">Current plan</dt>
              <dd className="text-lg font-semibold mt-1">{summary.planLabel}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Subscription status</dt>
              <dd className="mt-1">
                <Badge variant={statusVariant(summary.status)}>{summary.statusLabel}</Badge>
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Renewal date</dt>
              <dd className="text-base font-medium mt-1">
                {summary.renewalLabel ?? '—'}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Payment method</dt>
              <dd className="text-base font-medium mt-1 flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-muted-foreground shrink-0" />
                {summary.paymentMethod?.label ?? 'No card on file'}
                {summary.paymentMethod?.expMonth && summary.paymentMethod?.expYear ? (
                  <span className="text-sm text-muted-foreground font-normal">
                    (expires {summary.paymentMethod.expMonth}/{summary.paymentMethod.expYear})
                  </span>
                ) : null}
              </dd>
            </div>
          </dl>

          {summary.canManageInPortal ? (
            <Button
              type="button"
              onClick={handleManageSubscription}
              disabled={portalLoading}
            >
              {portalLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ExternalLink className="mr-2 h-4 w-4" />
              )}
              Manage Subscription
            </Button>
          ) : null}
        </CardContent>
      </Card>

      {!summary.hasActivePaidSubscription ? (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>Subscribe to a paid plan</CardTitle>
            <CardDescription>
              Your Stripe customer profile is ready. Choose a plan to activate paid features.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            {UPGRADE_PLANS.map((plan) => (
              <Button
                key={plan.id}
                type="button"
                variant={plan.recommended ? 'default' : 'outline'}
                disabled={checkoutPlan !== null}
                onClick={() => handleUpgrade(plan.id as SaasCheckoutPlan)}
              >
                {checkoutPlan === plan.id ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                {plan.name} — {plan.price}
              </Button>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
