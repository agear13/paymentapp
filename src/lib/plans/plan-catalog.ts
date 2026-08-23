/**
 * Customer-facing plan catalogue — App_Pricing positioning (source of truth for UX copy).
 * Prices must stay aligned with ONBOARDING_PRICING_PLANS / Stripe billing.
 */

import type { SubscriptionPlan } from '@/lib/entitlements/types';

export type PlanCatalogId = SubscriptionPlan;

export type PlanCatalogEntry = {
  id: PlanCatalogId;
  name: string;
  price: string;
  positioning: string;
  features: readonly string[];
  /** Self-serve SaaS checkout (Professional / Growth only). */
  selfServeCheckout: boolean;
};

export const PLAN_CATALOG: Record<PlanCatalogId, PlanCatalogEntry> = {
  starter: {
    id: 'starter',
    name: 'Starter',
    price: '$0',
    positioning: 'Learn how AI Agreement Intelligence works.',
    features: [
      '3 agreements',
      'AI imports',
      'Manual settlement tracking',
    ],
    selfServeCheckout: false,
  },
  professional: {
    id: 'professional',
    name: 'Professional',
    price: '$49/month',
    positioning:
      'For businesses coordinating people across suppliers, contractors and partners.',
    features: [
      'Unlimited agreements',
      'Payment Links',
      'Referral Management',
      'Xero',
      'Automated settlement tracking',
    ],
    selfServeCheckout: true,
  },
  growth: {
    id: 'growth',
    name: 'Growth',
    price: '$149/month',
    positioning: 'For teams running multiple projects simultaneously.',
    features: [
      'Multi-user workspaces',
      'Approval workflows',
      'Advanced reporting',
      'White-label documents',
      'Priority support',
    ],
    selfServeCheckout: true,
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    price: 'Contact Sales',
    positioning:
      'For hospitality groups, franchises and complex commercial ecosystems.',
    features: [
      'Multiple organisations',
      'API',
      'Custom settlement workflows',
      'Dedicated onboarding',
      'Custom implementation',
      'Enterprise support',
    ],
    selfServeCheckout: false,
  },
};

export const PLAN_CATALOG_ORDER: readonly PlanCatalogId[] = [
  'professional',
  'growth',
  'enterprise',
];

export function getPlanCatalogEntry(plan: string | null | undefined): PlanCatalogEntry {
  if (plan && plan in PLAN_CATALOG) {
    return PLAN_CATALOG[plan as PlanCatalogId];
  }
  return PLAN_CATALOG.professional;
}

export function planDisplayName(plan: string | null | undefined): string {
  if (!plan) return 'Unknown';
  if (plan in PLAN_CATALOG) {
    return PLAN_CATALOG[plan as PlanCatalogId].name;
  }
  return 'Unknown';
}
