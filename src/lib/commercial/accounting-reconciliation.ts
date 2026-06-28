import type { PersistedDraftInvoice } from '@/lib/commercial/payment-setup-types';

export type AccountingReconciliationVarianceClass =
  | 'none'
  | 'partial_settlement'
  | 'adjustment'
  | 'bonus'
  | 'clawback'
  | 'non_invoiceable_obligation'
  | 'unknown_variance';

export type AccountingReconciliationStatus = 'passed' | 'warning' | 'blocked';

export type InvoiceBackedObligationLine = {
  id: string;
  amount: number;
  currency: string;
  label?: string | null;
  invoiceBacked?: boolean;
  varianceClass?: Exclude<AccountingReconciliationVarianceClass, 'none' | 'unknown_variance'>;
};

export type AccountingReconciliationInput = {
  invoice: Pick<
    PersistedDraftInvoice,
    'subtotal' | 'gstAmount' | 'total' | 'gstStatus' | 'currency' | 'gstIncluded' | 'lineItems'
  >;
  obligationLines: InvoiceBackedObligationLine[];
  tolerance?: number;
};

export type AccountingReconciliationResult = {
  status: AccountingReconciliationStatus;
  varianceClass: AccountingReconciliationVarianceClass;
  releaseAllowed: boolean;
  reason: string;
  commercialObligationsTotal: number;
  invoiceBackedObligationsTotal: number;
  nonInvoiceableObligationsTotal: number;
  supplierInvoiceSubtotal: number;
  supplierInvoiceGstAmount: number;
  supplierInvoiceTotal: number;
  varianceAmount: number;
  gstStatus: PersistedDraftInvoice['gstStatus'];
  xeroTaxCode: string | null;
  currency: string;
};

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function moneyEqual(a: number, b: number, tolerance: number): boolean {
  return Math.abs(a - b) <= tolerance;
}

function classifyVariance(
  lines: InvoiceBackedObligationLine[],
  varianceAmount: number,
  tolerance: number
): AccountingReconciliationVarianceClass {
  if (moneyEqual(varianceAmount, 0, tolerance)) {
    const hasNonInvoiceable = lines.some((line) => line.invoiceBacked === false);
    return hasNonInvoiceable ? 'non_invoiceable_obligation' : 'none';
  }

  const explicit = lines.find((line) => line.varianceClass && line.varianceClass !== 'non_invoiceable_obligation')
    ?.varianceClass;
  if (explicit) return explicit;

  if (lines.some((line) => line.varianceClass === 'non_invoiceable_obligation' || line.invoiceBacked === false)) {
    return 'non_invoiceable_obligation';
  }

  return 'unknown_variance';
}

function reasonFor(result: {
  varianceClass: AccountingReconciliationVarianceClass;
  varianceAmount: number;
  tolerance: number;
}): string {
  const absVariance = Math.abs(result.varianceAmount).toFixed(2);
  switch (result.varianceClass) {
    case 'none':
      return 'Supplier invoice projection matches invoice-backed commercial obligations.';
    case 'partial_settlement':
      return `Variance of ${absVariance} is explained by a partial settlement.`;
    case 'adjustment':
      return `Variance of ${absVariance} is explained by a commercial adjustment.`;
    case 'bonus':
      return `Variance of ${absVariance} is explained by an additional bonus obligation.`;
    case 'clawback':
      return `Variance of ${absVariance} is explained by a clawback or negative adjustment.`;
    case 'non_invoiceable_obligation':
      return 'Variance is explained by obligations that are not represented on the supplier invoice.';
    case 'unknown_variance':
    default:
      return `Unexplained variance of ${absVariance} between supplier invoice projection and invoice-backed obligations.`;
  }
}

export function reconcileSupplierInvoiceToObligations(
  input: AccountingReconciliationInput
): AccountingReconciliationResult {
  const tolerance = input.tolerance ?? 0.01;
  const commercialObligationsTotal = roundMoney(
    input.obligationLines.reduce((sum, line) => sum + line.amount, 0)
  );
  const invoiceBackedObligationsTotal = roundMoney(
    input.obligationLines
      .filter((line) => line.invoiceBacked !== false)
      .reduce((sum, line) => sum + line.amount, 0)
  );
  const nonInvoiceableObligationsTotal = roundMoney(commercialObligationsTotal - invoiceBackedObligationsTotal);
  const supplierInvoiceSubtotal = roundMoney(input.invoice.subtotal);
  const supplierInvoiceGstAmount = roundMoney(input.invoice.gstAmount ?? 0);
  const supplierInvoiceTotal = roundMoney(input.invoice.total);
  const varianceAmount = roundMoney(supplierInvoiceTotal - invoiceBackedObligationsTotal);
  const varianceClass = classifyVariance(input.obligationLines, varianceAmount, tolerance);
  const supportedVariance = varianceClass !== 'unknown_variance';
  const passed = varianceClass === 'none';

  return {
    status: passed ? 'passed' : supportedVariance ? 'warning' : 'blocked',
    varianceClass,
    releaseAllowed: passed || supportedVariance,
    reason: reasonFor({ varianceClass, varianceAmount, tolerance }),
    commercialObligationsTotal,
    invoiceBackedObligationsTotal,
    nonInvoiceableObligationsTotal,
    supplierInvoiceSubtotal,
    supplierInvoiceGstAmount,
    supplierInvoiceTotal,
    varianceAmount,
    gstStatus: input.invoice.gstStatus,
    xeroTaxCode: input.invoice.lineItems[0]?.taxType ?? null,
    currency: input.invoice.currency,
  };
}
