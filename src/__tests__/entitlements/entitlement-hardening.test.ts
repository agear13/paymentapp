import {
  canCreateAgreement,
  canCreatePaymentLinks,
  canUseAdvancedReporting,
  canUseAiImport,
  canUseReferralManagement,
} from '@/lib/entitlements/workspace-entitlements';
import { entitlementForNavHref, NAV_HREF_ENTITLEMENT } from '@/lib/entitlements/nav-entitlements';
import type { EntitlementContext } from '@/lib/entitlements/types';

function ctx(overrides: Partial<EntitlementContext> = {}): EntitlementContext {
  return {
    organizationId: 'org-1',
    userId: 'user-1',
    productProfile: 'standard',
    plan: 'starter',
    status: 'active',
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

describe('Phase 9.1 entitlement hardening', () => {
  describe('FIX 1 — organization settings nav', () => {
    it('does not gate organization settings behind multi_organisation', () => {
      expect(NAV_HREF_ENTITLEMENT['/dashboard/settings/organization']).toBeUndefined();
      expect(entitlementForNavHref('/dashboard/settings/organization')).toBeNull();
    });
  });

  describe('FIX 2 — starter limit decisions', () => {
    it('blocks agreement creation at 3 active agreements on Starter', () => {
      const blocked = canCreateAgreement(
        ctx({ usage: { agreementCount: 3, aiImportCount: 0, teamMemberCount: 1, workspaceCount: 1 } })
      );
      expect(blocked.allowed).toBe(false);
      expect(blocked.reason).toBe('active_agreement_limit');
    });

    it('blocks AI import at 3 imports on Starter', () => {
      const blocked = canUseAiImport(
        ctx({ usage: { agreementCount: 0, aiImportCount: 3, teamMemberCount: 1, workspaceCount: 1 } })
      );
      expect(blocked.allowed).toBe(false);
      expect(blocked.reason).toBe('ai_import_limit');
    });
  });

  describe('FIX 3 — referral management', () => {
    it('denies referral management on Starter', () => {
      expect(canUseReferralManagement(ctx({ plan: 'starter' })).allowed).toBe(false);
    });

    it('allows referral management on Professional', () => {
      expect(canUseReferralManagement(ctx({ plan: 'professional' })).allowed).toBe(true);
    });
  });

  describe('FIX 4 — advanced reporting / export alignment', () => {
    it('denies advanced reporting on Starter', () => {
      expect(canUseAdvancedReporting(ctx({ plan: 'starter' })).allowed).toBe(false);
    });

    it('allows advanced reporting on Growth', () => {
      expect(canUseAdvancedReporting(ctx({ plan: 'growth' })).allowed).toBe(true);
    });
  });

  describe('payment links', () => {
    it('denies payment link creation on Starter', () => {
      expect(canCreatePaymentLinks(ctx({ plan: 'starter' })).allowed).toBe(false);
    });

    it('allows payment link creation on Professional', () => {
      expect(canCreatePaymentLinks(ctx({ plan: 'professional' })).allowed).toBe(true);
    });
  });

  describe('pilot bypass', () => {
    it('grants all gated features for Rabbit Hole pilot', () => {
      const pilot = ctx({
        productProfile: 'rabbit_hole_pilot',
        pilotBypass: true,
        plan: 'starter',
        usage: { agreementCount: 99, aiImportCount: 99, teamMemberCount: 1, workspaceCount: 1 },
      });
      expect(canCreatePaymentLinks(pilot).allowed).toBe(true);
      expect(canUseReferralManagement(pilot).allowed).toBe(true);
      expect(canUseAdvancedReporting(pilot).allowed).toBe(true);
      expect(canCreateAgreement(pilot).allowed).toBe(true);
      expect(canUseAiImport(pilot).allowed).toBe(true);
    });

    it('grants all gated features for Strait Experiences pilot', () => {
      const pilot = ctx({
        productProfile: 'strait_experiences_pilot',
        pilotBypass: true,
        plan: 'starter',
      });
      expect(canUseAdvancedReporting(pilot).allowed).toBe(true);
    });
  });
});
