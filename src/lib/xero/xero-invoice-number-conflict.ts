/** Raised when a merchant-chosen invoice number already exists in Xero at export time. */
export class XeroInvoiceNumberConflictError extends Error {
  readonly code = 'XERO_INVOICE_NUMBER_TAKEN' as const;
  readonly invoiceNumber: string;

  constructor(invoiceNumber: string) {
    super(
      `Invoice number "${invoiceNumber}" is already used in Xero. Refresh the suggested number on your invoice or choose a different one, then push again.`
    );
    this.name = 'XeroInvoiceNumberConflictError';
    this.invoiceNumber = invoiceNumber;
  }
}

export const XERO_INVOICE_NUMBER_AMBIGUOUS_REASON =
  'Xero uses more than one invoice-number prefix. Enter the invoice number manually to match your Xero sequence.';

export const XERO_INVOICE_NUMBER_SUGGESTION_LABEL =
  'Next invoice number from Xero · suggestion only';
