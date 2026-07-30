/**
 * @jest-environment jsdom
 */

import {
  deriveWorkflowHeaderDisplay,
  formatWorkflowAgreementMoney,
  resolveHackathonWorkflowCommercial,
  resolveWorkflowAgreementAmount,
  resolveWorkflowAgreementCurrency,
  toWorkflowProjectValueCurrency,
} from '@/lib/journey/workflow-agreement-currency.client';

describe('resolveWorkflowAgreementCurrency', () => {
  it('uses extracted agreement currency when present', () => {
    expect(
      resolveWorkflowAgreementCurrency({
        currency: { value: 'AUD', confidence: 'high' },
      }),
    ).toBe('AUD');
  });
});

describe('formatWorkflowAgreementMoney', () => {
  it('formats AUD and USD consistently', () => {
    expect(formatWorkflowAgreementMoney(3000, 'AUD')).toBe('A$3,000');
    expect(formatWorkflowAgreementMoney(3000, 'USD')).toBe('US$3,000');
  });
});

describe('deriveWorkflowHeaderDisplay', () => {
  const staticFallback = {
    name: 'Autonomous Reconciliation',
    objective: 'Collect, allocate and reconcile A$48,600 across three parties',
    participants: [
      { name: 'Northside Venue', role: 'Venue' },
      { name: 'Loop Promotions', role: 'Promoter' },
    ],
    currency: 'A$',
    amount: 48600,
  };

  it('uses static demo values before import', () => {
    const header = deriveWorkflowHeaderDisplay(null, staticFallback);
    expect(header.name).toBe('Autonomous Reconciliation');
    expect(header.commercialValueLabel).toBe('A$48,600');
    expect(header.hasLiveAgreement).toBe(false);
  });

  it('reflects extracted agreement name, value, and participants after import', () => {
    const header = deriveWorkflowHeaderDisplay(
      {
        dealName: 'Summer Launch Party',
        result: {
          projectName: { value: 'Summer Launch Party', confidence: 'high' },
          projectValue: { value: 3300, confidence: 'high' },
          currency: { value: 'AUD', confidence: 'high' },
          parties: [
            {
              name: { value: 'Sarah', confidence: 'high' },
              role: { value: 'Promoter', confidence: 'high' },
              participationModel: { value: 'revenue_share', confidence: 'high' },
              revenueSharePct: { value: 15, confidence: 'high' },
            },
            {
              name: { value: 'Bright Events Co', confidence: 'high' },
              role: { value: 'Supplier', confidence: 'high' },
              participationModel: { value: 'fixed_payout', confidence: 'high' },
              revenueSharePct: { value: null, confidence: 'absent' },
            },
          ],
        } as never,
      },
      staticFallback,
    );

    expect(header.name).toBe('Summer Launch Party');
    expect(header.commercialValueLabel).toBe('A$3,300');
    expect(header.objective).toContain('Collect, allocate and reconcile A$3,300');
    expect(header.objective).toContain('commercial participants');
    expect(header.participants).toHaveLength(2);
    expect(header.participants[0]?.name).toBe('Sarah');
    expect(header.hasLiveAgreement).toBe(true);
  });
});

describe('resolveHackathonWorkflowCommercial', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, NEXT_PUBLIC_HACKATHON_JOURNEY_ENABLED: 'true' };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns agreement commercial terms when hackathon flag is on', () => {
    expect(
      resolveHackathonWorkflowCommercial(
        {
          currency: { value: 'AUD', confidence: 'high' },
          projectValue: { value: 3000, confidence: 'high' },
        } as never,
        { currency: 'USD', amount: 48600 },
      ),
    ).toEqual({ currency: 'AUD', amount: 3000 });
  });
});

describe('resolveWorkflowAgreementAmount', () => {
  it('falls back when project value is missing', () => {
    expect(resolveWorkflowAgreementAmount(null, 48600)).toBe(48600);
  });
});

describe('toWorkflowProjectValueCurrency', () => {
  it('normalizes to supported project currencies', () => {
    expect(toWorkflowProjectValueCurrency('usd')).toBe('USD');
    expect(toWorkflowProjectValueCurrency('aud')).toBe('AUD');
    expect(toWorkflowProjectValueCurrency('SGD')).toBe('AUD');
  });
});
