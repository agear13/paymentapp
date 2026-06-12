import {
  attemptTruncatedJsonRepair,
  estimateTokenCount,
  isLikelyTruncatedJson,
  parseExtractionModelResponse,
  shouldRejectTruncatedExtraction,
} from '@/lib/ai-extractor/parse-extraction-response';
import { EXTRACTION_TRUNCATION_USER_MESSAGE } from '@/lib/ai-extractor/extraction-config';

describe('parse-extraction-response', () => {
  it('detects API max_tokens stop reason as truncated', () => {
    expect(isLikelyTruncatedJson('{"ok":true}', 'max_tokens')).toBe(true);
  });

  it('detects mid-string truncation from production evidence', () => {
    const truncated =
      '{"uncertainties":[{"field":"currency","issue":"No currency code explicitly stated in the conversation. Dollar sign ($) used throughout but jurisdiction is ambiguous (could be AUD,';
    expect(isLikelyTruncatedJson(truncated)).toBe(true);
  });

  it('parses valid JSON without repair', () => {
    const result = parseExtractionModelResponse('{"parties":[],"overallConfidence":"low"}');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.repaired).toBe(false);
      expect(result.parsed).toEqual({ parties: [], overallConfidence: 'low' });
    }
  });

  it('attempts repair for production-style mid-string cut-off', () => {
    const truncated =
      '{"uncertainties":[{"field":"currency","issue":"No currency code explicitly stated in the conversation. Dollar sign ($) used throughout but jurisdiction is ambiguous (could be AUD,';
    const result = parseExtractionModelResponse(truncated, { stopReason: 'max_tokens' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.repaired).toBe(true);
    }
  });

  it('rejects repaired JSON when API still reports max_tokens', () => {
    const truncated =
      '{"uncertainties":[{"field":"currency","issue":"No currency code explicitly stated in the conversation. Dollar sign ($) used throughout but jurisdiction is ambiguous (could be AUD,';
    const result = parseExtractionModelResponse(truncated, { stopReason: 'max_tokens' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(shouldRejectTruncatedExtraction('max_tokens', result)).toBe(true);
    }
  });

  it('repairs truncated JSON when trailing structures can be closed', () => {
    const truncated = '{"parties":[{"id":"ep-1","name":{"value":"Alex","confidence":"high"}';
    const repaired = attemptTruncatedJsonRepair(truncated);
    expect(repaired).not.toBeNull();
    expect(() => JSON.parse(repaired!)).not.toThrow();
  });

  it('estimates tokens from character length', () => {
    expect(estimateTokenCount('abcd')).toBe(1);
    expect(estimateTokenCount('a'.repeat(400))).toBe(100);
  });
});
