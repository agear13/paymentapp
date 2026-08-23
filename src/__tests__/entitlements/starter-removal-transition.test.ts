import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  canCreateAgreement,
  canCreatePaymentLinks,
  canUseXeroIntegration,
} from '@/lib/entitlements/workspace-entitlements';
import {
  getEffectivePlan,
  hasEntitledPlanAccess,
} from '@/lib/entitlements/subscription-state';
import {
  additionalWorkspaceSubscriptionCreate,
  journeyWorkspaceSubscriptionCreate,
} from '@/lib/entitlements/professional-trial';
import { normalizeSubscriptionPlan } from '@/lib/entitlements/plans';
import { PLAN_CATALOG_ORDER, getPlanCatalogEntry } from '@/lib/plans/plan-catalog';
import { upgradeBody, upgradeHeadline } from '@/lib/entitlements/feature-labels';
import type { EntitlementContext } from '@/lib/entitlements/types';

function ctx(overrides: Partial<EntitlementContext> = {}): EntitlementContext {
  return {
    organizationId: 'org-1',
    userId: 'user-1',
    productProfile: 'standard',
    plan: 'professional',
    status: 'canceled',
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    currentPeriodEnd: null,
    trialEndsAt: null,
    usage: {
      agreementCount: 0,
      aiImportCount: 0,
      teamMemberCount: 1,
      workspaceCount: 1,
    },
    pilotBypass: false,
    ...overrides,
  };
}

function source(relativePath: string) {
  return readFileSync(join(process.cwd(), relativePath), 'utf8');
}

describe('Starter removal — new self-serve users cannot land on Starter', () => {
  it('creates first-party trial payloads for new self-serve workspaces', () => {
    const payload = journeyWorkspaceSubscriptionCreate(new Date('2026-08-23T00:00:00.000Z'));
    expect(payload.subscription_plan).toBe('professional');
    expect(payload.subscription_status).toBe('trialing');
    expect(payload.trial_ends_at).toBeInstanceOf(Date);
  });

  it('copies an Enterprise primary instead of starting a second trial', () => {
    const payload = additionalWorkspaceSubscriptionCreate({
      subscription_plan: 'enterprise',
      subscription_status: 'active',
    });
    expect(payload).toEqual({
      subscription_plan: 'enterprise',
      subscription_status: 'active',
    });
    expect(payload).not.toHaveProperty('trial_ends_at');
  });

  it('wires every organisation create route to an explicit payload', () => {
    expect(source('app/api/onboarding/bootstrap-workspace/route.ts')).toContain(
      'journeyWorkspaceSubscriptionCreate'
    );
    expect(source('app/api/onboarding/bootstrap-project/route.ts')).toContain(
      'journeyWorkspaceSubscriptionCreate'
    );
    expect(source('app/api/organizations/route.ts')).toContain('journeyWorkspaceSubscriptionCreate');
    expect(source('app/api/organizations/route.ts')).toContain(
      'additionalWorkspaceSubscriptionCreate'
    );
    expect(source('app/api/test/refund-atomicity/route.ts')).toContain(
      "subscription_plan: 'professional'"
    );
    expect(source('prisma/schema.prisma')).toContain('@default("starter")');
  });

  it('keeps cancelled paid Professional stored as Professional without Starter limits', () => {
    const canceled = ctx();
    expect(getEffectivePlan(canceled)).toBe('professional');
    expect(hasEntitledPlanAccess(canceled)).toBe(false);
    expect(canCreatePaymentLinks(canceled).allowed).toBe(false);
    expect(canUseXeroIntegration(canceled).allowed).toBe(false);
    expect(canCreateAgreement(canceled).allowed).toBe(false);
    expect(canCreateAgreement(canceled).reason).not.toBe('active_agreement_limit');
  });

  it('does not invent Starter for unknown stored plans or unknown catalog ids', () => {
    expect(normalizeSubscriptionPlan('not-a-plan')).toBe('professional');
    expect(normalizeSubscriptionPlan('starter')).toBe('starter');
    expect(getPlanCatalogEntry(undefined).id).toBe('professional');
    expect(PLAN_CATALOG_ORDER).not.toContain('starter');
  });

  it('does not default loading entitlements or feature-gate copy to Starter', () => {
    expect(source('hooks/use-entitlements.ts')).not.toContain("?? 'starter'");
    expect(source('components/entitlements/feature-gate.tsx')).not.toContain(
      "entitlements?.plan ?? 'starter'"
    );
    expect(source('lib/entitlements/entitlement-api-errors.ts')).not.toContain(
      "payload.currentPlan ?? 'starter'"
    );
    expect(source('lib/billing/stripe-subscription.server.ts')).not.toContain(
      "subscription_plan: 'starter'"
    );
    expect(source('lib/billing/stripe-subscription.server.ts')).not.toContain(
      "subscription_plan: isEntitled ? plan : 'starter'"
    );
  });

  it('tells expired-trial users the Professional trial ended, not that they are on Starter', () => {
    expect(upgradeHeadline('xero_integration', false, false, true)).toMatch(/trial has ended/i);
    expect(upgradeBody('xero_integration', 'professional', false, false, true)).toMatch(
      /Professional trial has ended/
    );
    expect(upgradeBody('payment_links', 'professional')).not.toMatch(/on Starter/);
  });
});
