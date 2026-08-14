import {
  formatNextInvoiceNumber,
  inferNextXeroInvoiceNumber,
  isEligibleXeroInvoiceNumberCandidate,
  parseXeroStyleInvoiceNumber,
} from '@/lib/xero/xero-invoice-number-suggestion';
import { buildNextInvoiceReferencePayload } from '@/lib/payment-links/next-invoice-reference-response';
import {
  XERO_INVOICE_NUMBER_AMBIGUOUS_REASON,
  XERO_INVOICE_NUMBER_SUGGESTION_LABEL,
  XeroInvoiceNumberConflictError,
} from '@/lib/xero/xero-invoice-number-conflict';

describe('parseXeroStyleInvoiceNumber', () => {
  it('parses prefix and numeric suffix', () => {
    expect(parseXeroStyleInvoiceNumber('INV-00483')).toEqual({
      prefix: 'INV-',
      numeric: 483,
      numericRaw: '00483',
      full: 'INV-00483',
    });
  });

  it('rejects values without a numeric suffix', () => {
    expect(parseXeroStyleInvoiceNumber('DRAFT-ONLY')).toBeNull();
  });
});

describe('inferNextXeroInvoiceNumber', () => {
  it('suggests the next number for a single INV- prefix sequence', () => {
    const result = inferNextXeroInvoiceNumber(['INV-00481', 'INV-00482', 'INV-00483']);
    expect(result).toEqual({
      ok: true,
      suggestedNumber: 'INV-00484',
      prefix: 'INV-',
      nextSequence: 484,
      padWidth: 5,
    });
  });

  it('preserves zero-padding width from recent numbers', () => {
    const result = inferNextXeroInvoiceNumber(['INV-0042', 'INV-0043']);
    expect(result.ok && result.suggestedNumber).toBe('INV-0044');
  });

  it('returns ambiguous when multiple prefixes are present', () => {
    const result = inferNextXeroInvoiceNumber(['INV-0010', 'ORD-0020', 'INV-0011']);
    expect(result).toEqual({
      ok: false,
      reason: 'ambiguous_prefixes',
      prefixes: ['INV-', 'ORD-'],
    });
  });

  it('handles an empty list', () => {
    expect(inferNextXeroInvoiceNumber([])).toEqual({ ok: false, reason: 'no_numbers' });
  });
});

describe('formatNextInvoiceNumber', () => {
  it('expands width when sequence exceeds pad width', () => {
    expect(formatNextInvoiceNumber('INV-', 10000, 4)).toBe('INV-10000');
  });
});

describe('isEligibleXeroInvoiceNumberCandidate', () => {
  it('accepts parseable invoice numbers only', () => {
    expect(isEligibleXeroInvoiceNumberCandidate('INV-00484')).toBe(true);
    expect(isEligibleXeroInvoiceNumberCandidate('  ')).toBe(false);
    expect(isEligibleXeroInvoiceNumberCandidate('CUSTOM')).toBe(false);
  });
});

describe('buildNextInvoiceReferencePayload', () => {
  it('returns Xero suggestion when connected with a single sequence', () => {
    expect(
      buildNextInvoiceReferencePayload(
        { available: true, suggestedNumber: 'INV-00484', prefix: 'INV-' },
        'INV-0009'
      )
    ).toEqual({
      invoiceReference: 'INV-00484',
      source: 'xero',
      suggestionLabel: XERO_INVOICE_NUMBER_SUGGESTION_LABEL,
    });
  });

  it('falls back to Provvy local numbering when Xero is disconnected', () => {
    expect(
      buildNextInvoiceReferencePayload({ available: false, reason: 'not_connected' }, 'INV-0010')
    ).toEqual({
      invoiceReference: 'INV-0010',
      source: 'provvy',
      xeroConnected: false,
    });
  });

  it('skips prefill when multiple Xero prefixes are detected', () => {
    expect(
      buildNextInvoiceReferencePayload(
        {
          available: false,
          reason: 'ambiguous_prefixes',
          prefixes: ['INV-', 'ORD-'],
        },
        'INV-0010'
      )
    ).toEqual({
      invoiceReference: null,
      source: 'manual',
      xeroConnected: true,
      xeroSuggestionSkipped: true,
      ambiguousReason: XERO_INVOICE_NUMBER_AMBIGUOUS_REASON,
      prefixes: ['INV-', 'ORD-'],
    });
  });
});

describe('manual invoice number edit guard', () => {
  function shouldApplyInvoiceReferenceSuggestion(
    suggested: string | null | undefined,
    currentValue: string,
    userEdited: boolean
  ): boolean {
    if (userEdited || currentValue.trim()) return false;
    return Boolean(suggested?.trim());
  }

  it('does not overwrite after the merchant edits the field', () => {
    expect(shouldApplyInvoiceReferenceSuggestion('INV-00484', 'INV-00999', true)).toBe(false);
  });

  it('prefills only when empty and untouched', () => {
    expect(shouldApplyInvoiceReferenceSuggestion('INV-00484', '', false)).toBe(true);
    expect(shouldApplyInvoiceReferenceSuggestion('INV-00484', 'INV-0001', false)).toBe(false);
  });
});

describe('XeroInvoiceNumberConflictError', () => {
  it('includes actionable guidance for duplicate numbers at push', () => {
    const error = new XeroInvoiceNumberConflictError('INV-00484');
    expect(error.code).toBe('XERO_INVOICE_NUMBER_TAKEN');
    expect(error.message).toMatch(/already used in Xero/i);
    expect(error.message).toMatch(/Refresh the suggested number/i);
  });
});
