/**
 * Commercial Timing architecture tests.
 */

import {
  resolveCommercialTiming,
  resolveInvoiceCommercialTiming,
  inheritCommercialTimingForInvoice,
  applyCommercialTimingExtraction,
  deriveSettlementTiming,
  deriveReportingDimensions,
  deriveRevenueRecognition,
  buildAccountingExportTimingContext,
  getAccountingTimingMappingHints,
  commercialTimingFromDeal,
  serializeAgreementCommercialTiming,
} from '@/lib/commercial-timing';
import type { RecentDeal } from '@/lib/data/mock-deal-network';

describe('commercial timing resolution', () => {
  const agreementDefaults = {
    servicePeriodStart: '2026-01-01T00:00:00.000Z',
    servicePeriodEnd: '2026-01-31T23:59:59.000Z',
    recognitionPeriod: { year: 2026, month: 1 },
    expectedPaymentDate: '2026-02-15T00:00:00.000Z',
    expectedSettlementDate: '2026-02-28T00:00:00.000Z',
  };

  it('inherits all fields from agreement when document has no overrides', () => {
    const resolved = resolveCommercialTiming({ agreementDefaults, source: 'invoice' });
    expect(resolved.servicePeriodStart).toBe(agreementDefaults.servicePeriodStart);
    expect(resolved.recognitionPeriod).toEqual({ year: 2026, month: 1 });
    expect(resolved.inheritedFields).toHaveLength(5);
    expect(resolved.overriddenFields).toHaveLength(0);
    expect(resolved.hasTiming).toBe(true);
  });

  it('applies document overrides without fabricating missing fields', () => {
    const resolved = resolveInvoiceCommercialTiming(agreementDefaults, {
      overrides: { expectedPaymentDate: '2026-03-01T00:00:00.000Z' },
    });
    expect(resolved.expectedPaymentDate).toBe('2026-03-01T00:00:00.000Z');
    expect(resolved.expectedSettlementDate).toBe(agreementDefaults.expectedSettlementDate);
    expect(resolved.overriddenFields).toContain('expectedPaymentDate');
  });

  it('returns empty timing when nothing is set', () => {
    const resolved = resolveCommercialTiming({});
    expect(resolved.hasTiming).toBe(false);
    expect(resolved.inheritedFields).toHaveLength(0);
  });
});

describe('commercial timing inheritance', () => {
  it('creates document timing shell for invoice generation', () => {
    const inherited = inheritCommercialTimingForInvoice({
      servicePeriodStart: '2026-06-01T00:00:00.000Z',
    });
    expect(inherited).not.toBeNull();
    expect(inherited?.overrides).toBeUndefined();
  });

  it('returns null when agreement and overrides are both empty', () => {
    expect(inheritCommercialTimingForInvoice({})).toBeNull();
  });
});

describe('agreement intelligence extraction', () => {
  it('never fabricates values when hints are absent', () => {
    const result = applyCommercialTimingExtraction(null);
    expect(result.timing).toEqual({});
    expect(result.extractedFields).toHaveLength(0);
    expect(result.missingFields).toHaveLength(5);
  });

  it('extracts only valid hinted fields', () => {
    const result = applyCommercialTimingExtraction({
      expectedPaymentDate: '2026-04-01T00:00:00.000Z',
      extractionSources: { expectedPaymentDate: 'payment_due' },
    });
    expect(result.extractedFields).toEqual(['expectedPaymentDate']);
    expect(result.timing.expectedPaymentDate).toBe('2026-04-01T00:00:00.000Z');
  });
});

describe('settlement timing', () => {
  it('compares expected vs actual settlement dates', () => {
    const resolved = resolveCommercialTiming({
      agreementDefaults: { expectedSettlementDate: '2026-02-28T00:00:00.000Z' },
    });
    const view = deriveSettlementTiming({
      resolvedTiming: resolved,
      actualSettlementDate: '2026-02-20T00:00:00.000Z',
    });
    expect(view.onSchedule).toBe(true);
    expect(view.actualSettlementDate).toBe('2026-02-20T00:00:00.000Z');
  });
});

describe('reporting and accounting extension points', () => {
  it('derives reporting dimensions from resolved timing', () => {
    const resolved = resolveCommercialTiming({
      agreementDefaults: {
        recognitionPeriod: { year: 2026, month: 3 },
        servicePeriodStart: '2026-03-01T00:00:00.000Z',
      },
    });
    const dims = deriveReportingDimensions(resolved);
    expect(dims.recognitionPeriod).toEqual({ year: 2026, month: 3 });
  });

  it('returns placeholder revenue recognition', () => {
    const resolved = resolveCommercialTiming({
      agreementDefaults: { recognitionPeriod: { year: 2026, month: 1 } },
    });
    const rev = deriveRevenueRecognition(resolved, 1000, 'AUD');
    expect(rev.status).toBe('not_implemented');
  });

  it('exposes accounting export timing context without side effects', () => {
    const resolved = resolveCommercialTiming({
      agreementDefaults: {
        recognitionPeriod: { year: 2026, month: 1 },
        servicePeriodStart: '2026-01-01T00:00:00.000Z',
        servicePeriodEnd: '2026-01-31T00:00:00.000Z',
      },
    });
    const ctx = buildAccountingExportTimingContext(resolved);
    expect(ctx.recognitionPeriodLabel).toBe('2026-01');
    expect(ctx.hasTiming).toBe(true);
  });

  it('documents provider mapping hints as inactive', () => {
    const hints = getAccountingTimingMappingHints('xero');
    expect(hints.active).toBe(true);
    expect(hints.mappings.length).toBeGreaterThan(0);
  });
});

describe('deal payload integration', () => {
  it('reads and writes commercial timing on RecentDeal', () => {
    const deal: RecentDeal = {
      id: 'p1',
      dealName: 'Test',
      partner: 'P',
      value: 1000,
      introducer: 'A',
      closer: 'B',
      status: 'Pending',
      lastUpdated: new Date().toISOString(),
      paymentStatus: 'Not Paid',
      commercialTiming: serializeAgreementCommercialTiming({
        recognitionPeriod: { year: 2026, month: 5 },
      }),
    };
    const timing = commercialTimingFromDeal(deal);
    expect(timing.recognitionPeriod).toEqual({ year: 2026, month: 5 });
  });
});
