import {
  buildProjectTreasurySummary,
  computeOperationalReadiness,
} from '@/lib/projects/funding-sources/treasury-summary';
import type { ProjectFundingSourceDto } from '@/lib/projects/funding-sources/types';

function source(
  partial: Partial<ProjectFundingSourceDto> & Pick<ProjectFundingSourceDto, 'amount' | 'status'>
): ProjectFundingSourceDto {
  return {
    id: '1',
    projectId: 'p1',
    organizationId: null,
    name: 'Test',
    description: null,
    sourceType: 'manual_forecast',
    currency: 'USD',
    confidenceLevel: 'medium',
    expectedSettlementDate: null,
    actualSettlementDate: null,
    linkedInvoiceId: null,
    linkedPaymentId: null,
    notes: null,
    createdAt: '',
    updatedAt: '',
    ...partial,
  };
}

describe('computeOperationalReadiness', () => {
  it('returns ready when confirmed covers obligations', () => {
    expect(computeOperationalReadiness(15000, 0, 0, 14000)).toBe('ready');
  });

  it('returns obligations_pending when compensated participants exist but no obligations', () => {
    expect(computeOperationalReadiness(16500, 0, 0, 0, 2)).toBe('obligations_pending');
  });

  it('returns ready when no obligations and no eligible participants', () => {
    expect(computeOperationalReadiness(16500, 0, 0, 0, 0)).toBe('ready');
  });

  it('returns partially_funded when some confirmed funding exists', () => {
    expect(computeOperationalReadiness(5000, 0, 0, 14000)).toBe('partially_funded');
  });

  it('returns forecast_only when only forecast inflows exist', () => {
    expect(computeOperationalReadiness(0, 0, 8000, 14000)).toBe('forecast_only');
  });
});

describe('buildProjectTreasurySummary', () => {
  it('flags obligations_pending when eligible participants exist without obligation rows', () => {
    const summary = buildProjectTreasurySummary({
      fundingSources: [],
      obligationsTotal: 0,
      legacyConfirmedFunding: 16500,
      projectObligationEligibleParticipantCount: 2,
    });
    expect(summary.operationalReadiness).toBe('obligations_pending');
    expect(summary.operationalReadiness).not.toBe('ready');
  });
  it('keeps obligations when no funding is connected', () => {
    const summary = buildProjectTreasurySummary({
      fundingSources: [],
      obligationsTotal: 8300,
    });
    expect(summary.obligationsAwaitingFunding).toBe(8300);
    expect(summary.operationalReadiness).toBe('blocked');
    expect(summary.fundingLabel).toBe('No funding sources connected yet');
  });

  it('rolls up confirmed and forecast buckets', () => {
    const summary = buildProjectTreasurySummary({
      fundingSources: [
        source({ name: 'Tickets', amount: 22000, status: 'confirmed' }),
        source({ name: 'Sponsor', amount: 10000, status: 'pending' }),
        source({ name: 'Cash', amount: 4000, status: 'forecast' }),
      ],
      obligationsTotal: 14500,
    });
    expect(summary.confirmedFunding).toBe(22000);
    expect(summary.pendingFunding).toBe(10000);
    expect(summary.forecastFunding).toBe(4000);
    expect(summary.totalExpectedInflows).toBe(36000);
    expect(summary.operationalReadiness).toBe('ready');
  });
});
