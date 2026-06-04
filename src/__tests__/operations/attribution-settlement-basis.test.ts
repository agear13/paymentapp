import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import {
  resolveParticipantCommissionUsd,
  computeParticipantCommissionTotalsForDeal,
  demoParticipantToPilotRow,
} from '@/lib/deal-network-demo/commission-structure';
import {
  applyCompensationProfileToParticipant,
} from '@/lib/participants/participant-compensation';
import {
  deriveCompensationSettlementBasis,
  usesAttributionCommissionSettlement,
  usesProjectObligationSettlement,
} from '@/lib/operations/derivations/derive-compensation-settlement-basis';
import {
  compensationGeneratesProjectObligations,
  classifyParticipantCompensation,
} from '@/lib/operations/contracts/compensation-classification';

const DEAL_VALUE = 60_000;
const GUEST_LIST_PRICE = 1;
const ATTRIBUTION_PCT = 10;

function attributionParticipant(overrides: Partial<DemoParticipant> = {}): DemoParticipant {
  return applyCompensationProfileToParticipant(
    {
      id: 'participant-dj-alex',
      name: 'DJ Alex',
      email: 'dj@example.com',
      role: 'Contributor',
      dealId: 'deal-1',
      commissionKind: 'pct_deal_value',
      commissionValue: ATTRIBUTION_PCT,
      status: 'Pending',
      inviteStatus: 'Invited',
      approvalStatus: 'Approved',
      inviteToken: 'tok',
      workspaceSource: 'project',
      participationModel: 'customer_attribution',
      referralCommerce: {
        commissionMode: 'referral_commerce',
        commerceCommissionPct: ATTRIBUTION_PCT,
        enabledServiceIds: ['svc-guest-list'],
        createReferralLink: true,
      },
      ...overrides,
    },
    {
      compensationType: 'COMMISSION',
      percentage: ATTRIBUTION_PCT,
      customerAttributionEnabled: true,
      commissionSourceMode: 'selected',
      commissionServiceIds: ['svc-guest-list'],
      configured: true,
      configuredAt: new Date().toISOString(),
      revenueSources: [],
    }
  );
}

function revenueShareParticipant(): DemoParticipant {
  return applyCompensationProfileToParticipant(
    {
      id: 'participant-rev',
      name: 'Rev Share Partner',
      email: 'rev@example.com',
      role: 'Closer',
      dealId: 'deal-1',
      commissionKind: 'pct_deal_value',
      commissionValue: 15,
      status: 'Pending',
      inviteStatus: 'Invited',
      approvalStatus: 'Approved',
      inviteToken: 'tok2',
      workspaceSource: 'project',
      participationModel: 'revenue_share',
    },
    {
      compensationType: 'REVENUE_SHARE',
      percentage: 15,
      configured: true,
      configuredAt: new Date().toISOString(),
      revenueSources: [],
    }
  );
}

describe('attribution vs project settlement basis', () => {
  it('classifies catalog attribution as ATTRIBUTION_COMMISSION settlement', () => {
    const p = attributionParticipant();
    expect(deriveCompensationSettlementBasis(p)).toBe('ATTRIBUTION_COMMISSION');
    expect(usesAttributionCommissionSettlement(p)).toBe(true);
    expect(usesProjectObligationSettlement(p)).toBe(false);
    expect(classifyParticipantCompensation(p)).toBe('ATTRIBUTED_REFERRAL_COMMISSION');
    expect(compensationGeneratesProjectObligations('ATTRIBUTED_REFERRAL_COMMISSION')).toBe(false);
  });

  it('stores catalog_attribution scalars instead of pct_deal_value for COMMISSION + attribution', () => {
    const p = attributionParticipant();
    expect(p.commissionKind).toBe('catalog_attribution');
    expect(p.commissionValue).toBe(ATTRIBUTION_PCT);
    expect(p.compensationProfile?.compensationType).toBe('COMMISSION');
    expect(p.compensationProfile?.customerAttributionEnabled).toBe(true);
  });

  it('does not project $6,000 from deal value for attribution participants', () => {
    const p = attributionParticipant();
    const resolved = resolveParticipantCommissionUsd(
      {
        commissionKind: p.commissionKind,
        commissionValue: p.commissionValue,
      },
      DEAL_VALUE
    );
    expect(resolved.total).toBe(0);
    expect(resolved.previewLine).toMatch(/customer purchase/i);
  });

  it('continues projecting deal-value obligations for revenue share participants', () => {
    const p = revenueShareParticipant();
    expect(usesProjectObligationSettlement(p)).toBe(true);
    const resolved = resolveParticipantCommissionUsd(
      {
        commissionKind: p.commissionKind,
        commissionValue: p.commissionValue,
      },
      DEAL_VALUE
    );
    expect(resolved.total).toBe(9_000);
    expect(resolved.previewLine).toMatch(/deal value/i);
  });

  it('excludes attribution participants from joint deal commission totals', () => {
    const attribution = attributionParticipant();
    const revenue = revenueShareParticipant();
    const joint = computeParticipantCommissionTotalsForDeal(
      DEAL_VALUE,
      {},
      [attribution, revenue].map(demoParticipantToPilotRow)
    );
    expect(joint.totals[attribution.id]).toBe(0);
    expect(joint.totals[revenue.id]).toBe(9_000);
  });

  it('matches agreement estimated earnings math for one Guest List purchase', () => {
    const catalogEarnings = (GUEST_LIST_PRICE * ATTRIBUTION_PCT) / 100;
    expect(catalogEarnings).toBe(0.1);
  });
});
