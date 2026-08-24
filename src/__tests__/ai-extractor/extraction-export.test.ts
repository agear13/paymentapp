import { field, testParty } from '@/lib/ai-extractor/test-helpers/party-fixture';
import type { ExtractionResult } from '@/lib/ai-extractor/extraction-types';
import {
  buildExtractionExportDocument,
  extractionContactEmails,
  extractionExportFilename,
  serializeExtractionExport,
} from '@/lib/ai-extractor/extraction-export';

function sampleResult(): ExtractionResult {
  return {
    projectName: field('Festival Revenue Share'),
    projectDescription: field(null, 'absent'),
    projectValue: field(null, 'absent'),
    currency: field('AUD'),
    counterparty: field('Apex Promotions'),
    parties: [
      testParty({
        id: 'apex',
        name: field('Apex Promotions'),
        email: field('apex@example.com'),
        role: field('Promoter'),
        participationModel: field('revenue_share'),
        revenueSharePct: field(20),
      }),
    ],
    paymentTerms: [],
    uncertainties: [],
    overallConfidence: 'high',
    sourceHint: 'agreement',
    extractedAt: '2026-08-24T00:00:00.000Z',
  };
}

describe('extraction export document', () => {
  it('exports the stored structured extraction rather than a cosmetic summary file', () => {
    const result = sampleResult();
    const document = buildExtractionExportDocument({
      result,
      title: 'Festival Revenue Share',
      exportedAt: '2026-08-24T12:00:00.000Z',
    });
    const serialized = serializeExtractionExport(document);

    expect(document.source).toBe('agreement-intelligence');
    expect(document.extraction.parties[0].email.value).toBe('apex@example.com');
    expect(document.extraction.parties[0].revenueSharePct.value).toBe(20);
    expect(document.summary.participantCount).toBe(1);
    expect(serialized).toContain('"Apex Promotions"');
    expect(serialized).toContain('"revenue_share"');
    expect(extractionExportFilename(document.title, new Date('2026-08-24T12:00:00.000Z'))).toBe(
      'provvy-extraction-festival-revenue-share-2026-08-24.json'
    );
    expect(extractionContactEmails(result)).toEqual(['apex@example.com']);
  });
});
