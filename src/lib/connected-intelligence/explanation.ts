import type { TotalCostResult } from '@/lib/route-intelligence/types';

export type ConnectedWiseInterpretationInput = {
  wiseRate: number | null;
  referenceRate: number | null;
  feeAmount: number | null;
  feeCurrency: string | null;
  totalCost: TotalCostResult;
  comparableProvidersUnknown: boolean;
};

export type ConnectedWiseInterpretation = {
  statements: string[];
  unknowns: string[];
};

function formatFee(amount: number, currency: string): string {
  if (currency === 'AUD') return `A$${amount.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `${amount} ${currency}`;
}

/**
 * Phase 13 presentation only. Does not import Phase 11 explanation modules.
 * Claims are limited to structured evidence on this request.
 */
export function interpretConnectedWiseEconomics(
  input: ConnectedWiseInterpretationInput
): ConnectedWiseInterpretation {
  const statements: string[] = [];
  const unknowns: string[] = [];

  if (input.feeAmount !== null && input.feeCurrency) {
    statements.push(`The quote includes an explicit provider fee of ${formatFee(input.feeAmount, input.feeCurrency)}.`);
  }

  if (input.wiseRate !== null && input.referenceRate !== null) {
    if (input.wiseRate < input.referenceRate) {
      statements.push('Wise quoted FX is below the RBA official AUD→IDR reference rate.');
    } else if (input.wiseRate > input.referenceRate) {
      statements.push('Wise quoted FX is above the RBA official AUD→IDR reference rate.');
    } else {
      statements.push('Wise quoted FX matches the RBA official AUD→IDR reference rate.');
    }
  } else if (input.wiseRate !== null && input.referenceRate === null) {
    unknowns.push('Official RBA AUD→IDR reference FX is currently unavailable.');
  }

  if (input.totalCost.state === 'known') {
    statements.push('Provvy has enough evidence to calculate the connected Wise economics.');
  } else {
    unknowns.push('Connected Wise total cost is unknown because required fee or FX evidence is incomplete.');
  }

  if (input.comparableProvidersUnknown) {
    statements.push(
      'Provvy does not currently have comparable customer-specific economics for the other routes.'
    );
    unknowns.push('OFX and bank customer-specific fees and FX are unknown.');
  }

  return { statements, unknowns };
}
