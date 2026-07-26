/**
 * @jest-environment jsdom
 */

import {
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
