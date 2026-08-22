import {
  canCreateAgreement,
  canCreatePaymentLinks,
  canUseAiImport,
  canUseAutomatedSettlementCoordination,
  canUseReferralManagement,
  canUseXeroIntegration,
} from '@/lib/entitlements/workspace-entitlements';
import {
  getEffectivePlan,
  hasActiveFirstPartyTrial,
  hasActivePaidSubscription,
  hasEntitledPlanAccess,
  isExpiredFirstPartyTrial,
} from '@/lib/entitlements/subscription-state';
import {
  PROFESSIONAL_TRIAL_DAYS,
  computeProfessionalTrialEndsAt,
  journeyWorkspaceSubscriptionCreate,
} from '@/lib/entitlements/professional-trial';
import type { EntitlementContext } from '@/lib/entitlements/types';

function ctx(overrides: Partial<EntitlementContext> = {}): EntitlementContext {
  return {
    organizationId: 'org-1',
    userId: 'user-1',
    productProfile: 'standard',
    plan: 'starter',
    status: 'inactive',
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

function activeTrial(overrides: Partial<EntitlementContext> = {}): EntitlementContext {
  return ctx({
    plan: 'professional',
    status: 'trialing',
    trialEndsAt: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
    ...overrides,
  });
}

function expiredTrial(overrides: Partial<EntitlementContext> = {}): EntitlementContext {
  return ctx({
    plan: 'professional',
    status: 'trialing',
    trialEndsAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    ...overrides,
  });
}

function paidProfessional(overrides: Partial<EntitlementContext> = {}): EntitlementContext {
  return ctx({
    plan: 'professional',
    status: 'active',
    stripeCustomerId: 'cus_paid',
    stripeSubscriptionId: 'sub_paid',
    currentPeriodEnd: new Date('2026-09-22T12:00:00.000Z'),
    ...overrides,
  });
}

describe('journey workspace trial payload', () => {
  it('creates Professional + trialing + 30-day trial_ends_at without Stripe', () => {
    const from = new Date('2026-08-22T12:00:00.000Z');
    const created = journeyWorkspaceSubscriptionCreate(from);
    expect(created.subscription_plan).toBe('professional');
    expect(created.subscription_status).toBe('trialing');
    expect(created.trial_ends_at.toISOString()).toBe(
      computeProfessionalTrialEndsAt(from).toISOString()
    );
    expect(PROFESSIONAL_TRIAL_DAYS).toBe(30);
    const elapsedDays =
      (created.trial_ends_at.getTime() - from.getTime()) / (24 * 60 * 60 * 1000);
    expect(elapsedDays).toBe(30);
  });
});

describe('first-party Professional Trial entitlements', () => {
  it('does not require a Stripe subscription id for an active trial', () => {
    const trial = activeTrial();
    expect(trial.stripeSubscriptionId).toBeNull();
    expect(hasActivePaidSubscription(trial)).toBe(false);
    expect(hasActiveFirstPartyTrial(trial)).toBe(true);
    expect(hasEntitledPlanAccess(trial)).toBe(true);
    expect(getEffectivePlan(trial)).toBe('professional');
  });

  it('grants Professional entitlements during an active trial', () => {
    const trial = activeTrial({
      usage: { agreementCount: 5, aiImportCount: 5, teamMemberCount: 1, workspaceCount: 1 },
    });
    expect(canCreateAgreement(trial).allowed).toBe(true);
    expect(canUseAiImport(trial).allowed).toBe(true);
    expect(canCreatePaymentLinks(trial).allowed).toBe(true);
    expect(canUseReferralManagement(trial).allowed).toBe(true);
    expect(canUseXeroIntegration(trial).allowed).toBe(true);
    expect(canUseAutomatedSettlementCoordination(trial).allowed).toBe(false);
  });

  it('denies Professional entitlements after the trial expires', () => {
    const trial = expiredTrial({
      usage: { agreementCount: 1, aiImportCount: 1, teamMemberCount: 1, workspaceCount: 1 },
    });
    expect(isExpiredFirstPartyTrial(trial)).toBe(true);
    expect(hasActiveFirstPartyTrial(trial)).toBe(false);
    expect(canCreatePaymentLinks(trial).allowed).toBe(false);
    expect(canCreatePaymentLinks(trial).reason).toBe('trial_expired');
    expect(canUseXeroIntegration(trial).reason).toBe('trial_expired');
    expect(canUseReferralManagement(trial).reason).toBe('trial_expired');
    expect(canCreateAgreement(trial).allowed).toBe(false);
    expect(canCreateAgreement(trial).reason).toBe('trial_expired');
    expect(canUseAiImport(trial).reason).toBe('trial_expired');
  });

  it('does not grant Starter free limits after an expired journey trial', () => {
    const trial = expiredTrial({
      usage: { agreementCount: 0, aiImportCount: 0, teamMemberCount: 1, workspaceCount: 1 },
    });
    expect(getEffectivePlan(trial)).toBe('professional');
    expect(canCreateAgreement(trial).allowed).toBe(false);
    expect(canUseAiImport(trial).allowed).toBe(false);
    expect(canCreateAgreement(trial).reason).not.toBe('active_agreement_limit');
  });

  it('leaves paid Professional and Growth Stripe behaviour unchanged', () => {
    const pro = paidProfessional();
    expect(hasActivePaidSubscription(pro)).toBe(true);
    expect(hasActiveFirstPartyTrial(pro)).toBe(false);
    expect(canCreatePaymentLinks(pro).allowed).toBe(true);
    expect(canUseXeroIntegration(pro).allowed).toBe(true);

    const growth = paidProfessional({
      plan: 'growth',
      stripeSubscriptionId: 'sub_growth',
    });
    expect(canUseAutomatedSettlementCoordination(growth).allowed).toBe(true);
    expect(canCreatePaymentLinks(growth).allowed).toBe(true);
  });

  it('leaves legacy Starter organisations unchanged', () => {
    const starter = ctx({
      usage: { agreementCount: 2, aiImportCount: 1, teamMemberCount: 1, workspaceCount: 1 },
    });
    expect(getEffectivePlan(starter)).toBe('starter');
    expect(canCreateAgreement(starter).allowed).toBe(true);
    expect(canCreatePaymentLinks(starter).allowed).toBe(false);
    expect(canUseXeroIntegration(starter).allowed).toBe(false);

    const atLimit = ctx({
      usage: { agreementCount: 3, aiImportCount: 3, teamMemberCount: 1, workspaceCount: 1 },
    });
    expect(canCreateAgreement(atLimit).reason).toBe('active_agreement_limit');
  });
});
