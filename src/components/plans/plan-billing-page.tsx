'use client';

import * as React from 'react';
import { Check, CreditCard, ExternalLink, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useEntitlements } from '@/hooks/use-entitlements';
import {
  getPlanCatalogEntry,
  PLAN_CATALOG,
  planDisplayName,
  type PlanCatalogId,
} from '@/lib/plans/plan-catalog';
import { STARTER_MAX_AGREEMENTS, STARTER_MAX_AI_IMPORTS } from '@/lib/entitlements/plans';
import { resolvePlanRecommendation } from '@/lib/entitlements/plan-recommendations';
import { PlanComparisonDialog } from '@/components/plans/plan-comparison-dialog';
import { startSaasCheckout, type SaasCheckoutPlan } from '@/lib/billing/start-saas-checkout.client';
import { openBillingPortal } from '@/lib/billing/open-billing-portal.client';
import { invalidateEntitlementsCache } from '@/hooks/use-entitlements';
import type { EntitlementFeature } from '@/lib/entitlements/types';
import { StripeConnectReadinessSummary } from '@/components/commercial-os/stripe-connect-readiness-summary';

type BillingSummary = {
  planLabel: string;
  statusLabel: string;
  renewalLabel: string | null;
  hasActivePaidSubscription: boolean;
  stripeCustomerId: string | null;
  canManageInPortal: boolean;
};

const PROFESSIONAL_FEATURES: EntitlementFeature[] = [
  'payment_links',
  'referral_management',
  'xero_integration',
];

export function PlanBillingPage() {
  const {
    loading: entitlementsLoading,
    plan,
    effectivePlan,
    usage,
    entitlements,
    refresh,
    getDecision,
    pilotBypass,
  } = useEntitlements();

  const [summary, setSummary] = React.useState<BillingSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = React.useState(true);
  const [compareOpen, setCompareOpen] = React.useState(false);
  const [checkoutPlan, setCheckoutPlan] = React.useState<SaasCheckoutPlan | null>(null);
  const [portalLoading, setPortalLoading] = React.useState(false);
  const [stripeConnected, setStripeConnected] = React.useState(false);

  const currentEntry = getPlanCatalogEntry(effectivePlan);

  React.useEffect(() => {
    void (async () => {
      setSummaryLoading(true);
      try {
        const res = await fetch('/api/billing/summary', { credentials: 'include' });
        if (res.ok) {
          setSummary((await res.json()) as BillingSummary);
        }
      } catch {
        /* optional */
      } finally {
        setSummaryLoading(false);
      }
    })();
  }, []);

  React.useEffect(() => {
    if (!entitlements?.organizationId) return;
    void fetch(
      `/api/merchant-settings?organizationId=${encodeURIComponent(entitlements.organizationId)}`,
      { cache: 'no-store' }
    )
      .then((res) => (res.ok ? res.json() : []))
      .then((rows: Array<{ stripe_account_id?: string | null }>) => {
        setStripeConnected(Boolean(rows[0]?.stripe_account_id?.trim()));
      })
      .catch(() => setStripeConnected(false));
  }, [entitlements?.organizationId]);

  const deniedFeatures = React.useMemo(() => {
    if (!entitlements || pilotBypass) return {};
    const out: Partial<Record<EntitlementFeature, boolean>> = {};
    for (const feature of PROFESSIONAL_FEATURES) {
      out[feature] = !entitlements.features[feature]?.allowed;
    }
    return out;
  }, [entitlements, pilotBypass]);

  const recommendation = resolvePlanRecommendation({
    currentPlan: plan,
    effectivePlan,
    usage,
    deniedFeatures,
    stripeConnectConfigured: stripeConnected,
  });

  const missingProfessional = PROFESSIONAL_FEATURES.filter(
    (f) => getDecision(f)?.allowed === false
  );

  async function handleUpgrade(target: PlanCatalogId) {
    if (target === 'enterprise') {
      window.location.href = 'mailto:sales@provvypay.com?subject=Enterprise%20Plan%20Inquiry';
      return;
    }
    if (target !== 'professional' && target !== 'growth') return;

    setCheckoutPlan(target);
    try {
      const result = await startSaasCheckout({
        plan: target,
        context: 'upgrade',
        returnTo: '/workspace/settings/plan',
      });
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

  async function handlePortal() {
    setPortalLoading(true);
    try {
      const result = await openBillingPortal({ returnTo: '/workspace/settings/plan' });
      if ('error' in result) {
        toast.error(result.error);
        return;
      }
      window.location.href = result.url;
    } finally {
      setPortalLoading(false);
    }
  }

  if (entitlementsLoading) {
    return (
      <div className="flex items-center gap-2 py-16 text-[15px] text-ink-soft">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading plan details…
      </div>
    );
  }

  if (!entitlements || !effectivePlan) {
    return (
      <div className="py-16 text-[15px] text-ink-soft">
        Plan details are unavailable. Refresh to try again.
      </div>
    );
  }

  return (
    <div className="animate-fade-up space-y-8 pb-16">
      <header>
        <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-soft">
          Plan &amp; Billing
        </div>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
          Your current plan
        </h1>
      </header>

      <section className="rounded-2xl border border-border bg-card p-6 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-2xl font-semibold">{currentEntry.name}</div>
            <Badge variant="secondary" className="mt-2">
              Current plan
            </Badge>
            {entitlements.trialExpired ? (
              <p className="mt-2 text-[13px] text-ink-soft">
                Your Professional trial has ended. Choose a paid Professional, Growth, or
                Enterprise plan to restore entitled features.
              </p>
            ) : null}
            {pilotBypass ? (
              <p className="mt-2 text-[13px] text-ink-soft">Pilot access — full feature bypass active.</p>
            ) : null}
          </div>
          <div className="text-right text-[14px] text-ink-soft">
            {summaryLoading ? (
              'Loading subscription status…'
            ) : summary ? (
              <>
                <div>Status: {summary.statusLabel}</div>
                {summary.renewalLabel ? <div>Renews: {summary.renewalLabel}</div> : null}
              </>
            ) : (
              <div>Subscription status unavailable</div>
            )}
          </div>
        </div>

        {usage ? (
          <dl className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl bg-secondary/50 p-4">
              <dt className="text-[12px] uppercase tracking-wider text-ink-soft">Agreements</dt>
              <dd className="mt-1 text-lg font-semibold">
                {effectivePlan === 'starter'
                  ? `${usage.agreementCount} / ${STARTER_MAX_AGREEMENTS}`
                  : usage.agreementCount}
              </dd>
            </div>
            <div className="rounded-xl bg-secondary/50 p-4">
              <dt className="text-[12px] uppercase tracking-wider text-ink-soft">AI imports</dt>
              <dd className="mt-1 text-lg font-semibold">
                {effectivePlan === 'starter'
                  ? `${usage.aiImportCount} / ${STARTER_MAX_AI_IMPORTS}`
                  : usage.aiImportCount}
              </dd>
            </div>
            <div className="rounded-xl bg-secondary/50 p-4">
              <dt className="text-[12px] uppercase tracking-wider text-ink-soft">Team members</dt>
              <dd className="mt-1 text-lg font-semibold">{usage.teamMemberCount}</dd>
            </div>
            <div className="rounded-xl bg-secondary/50 p-4">
              <dt className="text-[12px] uppercase tracking-wider text-ink-soft">Workspaces</dt>
              <dd className="mt-1 text-lg font-semibold">{usage.workspaceCount}</dd>
            </div>
          </dl>
        ) : null}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">What you get</h2>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <p className="text-[14px] text-ink-soft">{currentEntry.positioning}</p>
          <ul className="mt-4 space-y-2">
            {currentEntry.features.map((item) => (
              <li key={item} className="flex items-start gap-2 text-[14px]">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {!pilotBypass && missingProfessional.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">What you&apos;re missing</h2>
          <div className="rounded-2xl border border-dashed border-primary/25 bg-accent/30 p-5">
            <p className="text-[14px] text-ink-soft">
              Upgrade to Professional to unlock:
            </p>
            <ul className="mt-3 space-y-2">
              {PLAN_CATALOG.professional.features
                .filter((f) =>
                  f === 'Payment Links' ||
                  f === 'Referral Management' ||
                  f === 'Xero'
                )
                .map((item) => (
                  <li key={item} className="flex items-start gap-2 text-[14px]">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    {item}
                  </li>
                ))}
            </ul>
          </div>
        </section>
      ) : null}

      {recommendation && !pilotBypass ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Recommended for you</h2>
          <div className="rounded-2xl border border-primary/20 bg-accent/40 p-6 shadow-card">
            <div className="text-xl font-semibold">{recommendation.headline}</div>
            <p className="mt-2 text-[15px] text-ink-soft">{recommendation.body}</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button
                type="button"
                onClick={() =>
                  void handleUpgrade(
                    recommendation.contactSales ? 'enterprise' : recommendation.recommendedPlan
                  )
                }
                disabled={checkoutPlan !== null}
              >
                {checkoutPlan ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                {recommendation.cta}
              </Button>
              <Button type="button" variant="outline" onClick={() => setCompareOpen(true)}>
                Compare all plans
              </Button>
            </div>
          </div>
        </section>
      ) : null}

      <StripeConnectReadinessSummary />

      {summary?.canManageInPortal ? (
        <Button type="button" variant="outline" disabled={portalLoading} onClick={() => void handlePortal()}>
          {portalLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <ExternalLink className="mr-2 h-4 w-4" />
          )}
          Manage subscription in Stripe
        </Button>
      ) : null}

      <PlanComparisonDialog
        open={compareOpen}
        onOpenChange={setCompareOpen}
        highlightPlan={recommendation?.recommendedPlan}
      />
    </div>
  );
}
