import { buildProjectParticipant } from '@/lib/projects/participant-entitlement';
import { deriveCommissionScope } from '@/lib/operations/derivations/commission-scope';
import { hasPersistedCompensationTerms } from '@/lib/operations/primitives/participant-earnings-primitives';
import { isParticipantEarningsConfigured } from '@/lib/operations/selectors/participant-earnings-selectors';
import { formatCompensationPercent } from '@/lib/projects/participant-compensation-copy';
import type { RecentDeal } from '@/lib/data/mock-deal-network';

function baseDeal(): RecentDeal {
  return {
    id: 'deal-1',
    dealName: 'Test',
    partner: 'Test',
    value: 1000,
    introducer: '—',
    closer: '—',
    status: 'Pending',
    lastUpdated: new Date().toISOString(),
    paymentStatus: 'Not Paid',
    setupStatus: 'configuring',
  } as RecentDeal;
}

describe('attribution invite compensation seeding', () => {
  it('seeds compensation profile from customer attribution invite', () => {
    const p = buildProjectParticipant({
      name: 'DJ Alex',
      role: 'Contributor',
      project: baseDeal(),
      participationModel: 'customer_attribution',
      commissionKind: 'pct_deal_value',
      commissionValue: 0,
      enableCustomerAttribution: true,
      referralCommerce: {
        createReferralLink: true,
        commissionMode: 'referral_commerce',
        commerceCommissionPct: 10,
        enabledServiceIds: ['svc-1'],
      },
    });

    expect(p.compensationProfile?.configured).toBe(true);
    expect(p.compensationProfile?.percentage).toBe(10);
    expect(p.commissionValue).toBe(10);
    expect(hasPersistedCompensationTerms(p)).toBe(true);
    expect(isParticipantEarningsConfigured(p)).toBe(true);
  });

  it('agreement scope uses commerce commission instead of zero deal share', () => {
    const p = buildProjectParticipant({
      name: 'DJ Alex',
      role: 'Contributor',
      project: baseDeal(),
      participationModel: 'customer_attribution',
      commissionKind: 'pct_deal_value',
      commissionValue: 0,
      enableCustomerAttribution: true,
      referralCommerce: {
        createReferralLink: true,
        commissionMode: 'referral_commerce',
        commerceCommissionPct: 10,
        enabledServiceIds: [],
      },
    });

    const scope = deriveCommissionScope(p);
    expect(scope.settlementBasis).toBe('qualifying_catalog_purchases');
    expect(scope.percentage).toBe(10);
    expect(formatCompensationPercent(scope.percentage)).toBe('10%');
    expect(scope.earningsPrimary).toContain('10%');
  });

  it('recognizes legacy invite rows with referral commerce only', () => {
    const legacy = {
      id: 'legacy',
      name: 'DJ Alex',
      email: '',
      role: 'Contributor',
      commissionKind: 'pct_deal_value' as const,
      commissionValue: 0,
      status: 'Pending',
      approvalStatus: 'Pending approval' as const,
      inviteToken: 't',
      participationModel: 'customer_attribution' as const,
      referralCommerce: {
        createReferralLink: true,
        commissionMode: 'referral_commerce' as const,
        commerceCommissionPct: 10,
        enabledServiceIds: [],
      },
    };

    expect(hasPersistedCompensationTerms(legacy)).toBe(true);
    const scope = deriveCommissionScope(legacy);
    expect(scope.percentage).toBe(10);
  });
});
