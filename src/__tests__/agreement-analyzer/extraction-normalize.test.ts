import { normalizeAgreementText } from '@/lib/agreement-analyzer/extraction/normalize-text.server';
import { buildAgreementReportJson } from '@/lib/agreement-analyzer/extraction/build-report-json.server';
import type { AgreementExtractionResult } from '@/lib/agreement-analyzer/extraction/extraction-types';

describe('agreement-analyzer extraction helpers', () => {
  it('normalizes whitespace and line endings', () => {
    expect(normalizeAgreementText('Line one\r\n\r\n\r\nLine two   \n')).toBe('Line one\n\nLine two');
  });

  it('builds report json with settlement readiness score', () => {
    const extraction: AgreementExtractionResult = {
      documentType: 'service agreement',
      parties: [{ name: 'Acme Pty Ltd' }],
      roles: [],
      revenueSplits: [],
      paymentConditions: [{ term: 'Net 30' }],
      obligations: [{ description: 'Monthly platform fee' }],
      risks: [],
      missingInformation: [],
      confidenceScore: 0.82,
    };

    const report = buildAgreementReportJson(extraction);
    expect(report.parties).toHaveLength(1);
    expect(report.settlementReadiness.score).toBeGreaterThan(0);
    expect(report.settlementReadiness.summary).toBeTruthy();
  });
});
