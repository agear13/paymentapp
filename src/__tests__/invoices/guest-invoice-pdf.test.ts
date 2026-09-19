import { buildGuestInvoicePdfBytes, guestInvoicePdfFilename } from '@/lib/invoices/guest-invoice-pdf';
import { defaultGuestInvoiceDraft, guestInvoiceCanDownload } from '@/lib/invoices/guest-invoice-draft';

describe('guest invoice PDF', () => {
  it('builds a PDF from the current draft without requiring an account', () => {
    const draft = defaultGuestInvoiceDraft();
    draft.fromBusinessName = 'Northwind Studio';
    draft.customerName = 'Sarah Chen';
    draft.description = 'Campaign delivery';
    draft.amount = 12000;
    draft.currency = 'AUD';
    draft.paymentTermsNote = 'Due within 14 days of delivery';

    expect(guestInvoiceCanDownload(draft)).toBe(true);
    const bytes = buildGuestInvoicePdfBytes({ draft });
    const text = new TextDecoder('latin1').decode(bytes);
    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text).toContain('INVOICE');
    expect(text).toContain('Northwind Studio');
    expect(text).toContain('Sarah Chen');
    expect(text).toContain('Campaign delivery');
    expect(text).toContain('Due within 14 days of delivery');
    expect(guestInvoicePdfFilename(draft)).toMatch(/\.pdf$/);
  });

  it('does not allow download until customer, description and amount exist', () => {
    const draft = defaultGuestInvoiceDraft();
    expect(guestInvoiceCanDownload(draft)).toBe(false);
    draft.customerName = 'Sarah';
    expect(guestInvoiceCanDownload(draft)).toBe(false);
    draft.description = 'Campaign';
    expect(guestInvoiceCanDownload(draft)).toBe(false);
    draft.amount = 12000;
    expect(guestInvoiceCanDownload(draft)).toBe(true);
  });
});
