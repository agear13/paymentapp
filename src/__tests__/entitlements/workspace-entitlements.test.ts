import {
  canCreateAgreement,
  canUseAutomatedSettlementCoordination,
  canUseAiImport,
  canCreatePaymentLinks,
} from '@/lib/entitlements/workspace-entitlements';
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

function paidCtx(plan: 'professional' | 'growth'): EntitlementContext {
  return ctx({
    plan,
    status: 'active',
    stripeCustomerId: 'cus_test',
    stripeSubscriptionId: 'sub_test',
  });
}

describe('workspace entitlements', () => {
  it('bypasses all checks for Rabbit Hole pilot profile', () => {
    const pilot = ctx({
      productProfile: 'rabbit_hole_pilot',
      pilotBypass: true,
      usage: { agreementCount: 99, aiImportCount: 99, teamMemberCount: 1, workspaceCount: 1 },
    });
    expect(canCreateAgreement(pilot).allowed).toBe(true);
    expect(canCreatePaymentLinks(pilot).allowed).toBe(true);
    expect(canUseAutomatedSettlementCoordination(pilot).allowed).toBe(true);
  });

  it('limits starter to 3 active agreements', () => {
    expect(
      canCreateAgreement(
        ctx({ usage: { agreementCount: 2, aiImportCount: 0, teamMemberCount: 1, workspaceCount: 1 } })
      ).allowed
    ).toBe(true);
    const blocked = canCreateAgreement(
      ctx({ usage: { agreementCount: 3, aiImportCount: 0, teamMemberCount: 1, workspaceCount: 1 } })
    );
    expect(blocked.allowed).toBe(false);
    expect(blocked.requiredPlan).toBe('professional');
  });

  it('limits starter to 3 AI imports', () => {
    const blocked = canUseAiImport(
      ctx({ usage: { agreementCount: 0, aiImportCount: 3, teamMemberCount: 1, workspaceCount: 1 } })
    );
    expect(blocked.allowed).toBe(false);
  });

  it('requires growth for automated settlement coordination', () => {
    expect(canUseAutomatedSettlementCoordination(paidCtx('professional')).allowed).toBe(false);
    expect(canUseAutomatedSettlementCoordination(paidCtx('growth')).allowed).toBe(true);
  });

  it('allows professional payment links with active Stripe subscription', () => {
    expect(canCreatePaymentLinks(paidCtx('professional')).allowed).toBe(true);
    expect(canCreatePaymentLinks(ctx({ plan: 'starter' })).allowed).toBe(false);
  });
});
