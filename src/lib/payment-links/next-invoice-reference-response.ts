import type { XeroInvoiceNumberSuggestionResponse } from '@/lib/xero/xero-invoice-number-suggestion.server';
import {
  XERO_INVOICE_NUMBER_AMBIGUOUS_REASON,
  XERO_INVOICE_NUMBER_SUGGESTION_LABEL,
} from '@/lib/xero/xero-invoice-number-conflict';

export type NextInvoiceReferencePayload = {
  invoiceReference: string | null;
  source: 'xero' | 'provvy' | 'manual';
  suggestionLabel?: string;
  ambiguousReason?: string;
  prefixes?: string[];
  xeroConnected?: boolean;
  xeroSuggestionSkipped?: boolean;
};

export function buildNextInvoiceReferencePayload(
  xeroSuggestion: XeroInvoiceNumberSuggestionResponse,
  provvyReference: string
): NextInvoiceReferencePayload {
  if (xeroSuggestion.available) {
    return {
      invoiceReference: xeroSuggestion.suggestedNumber,
      source: 'xero',
      suggestionLabel: XERO_INVOICE_NUMBER_SUGGESTION_LABEL,
    };
  }

  if (xeroSuggestion.reason === 'ambiguous_prefixes') {
    return {
      invoiceReference: null,
      source: 'manual',
      xeroConnected: true,
      xeroSuggestionSkipped: true,
      ambiguousReason: XERO_INVOICE_NUMBER_AMBIGUOUS_REASON,
      prefixes: xeroSuggestion.prefixes,
    };
  }

  return {
    invoiceReference: provvyReference,
    source: 'provvy',
    xeroConnected: xeroSuggestion.reason !== 'not_connected',
  };
}
