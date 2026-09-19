import { format } from 'date-fns';
import {
  conversationOriginCommercialDealDraft,
  defaultCommercialDealDraft,
  type CommercialDealDraft,
} from '@/lib/commercial-os/commercial-deal-draft';
import type { ConversationInvoiceExtraction } from '@/lib/invoices/conversation-invoice-extraction';

export type GuestInvoiceDraft = CommercialDealDraft & {
  fromBusinessName: string;
  fromBusinessEmail: string;
  paymentTermsNote: string;
};

export function defaultGuestInvoiceDraft(currency = 'AUD'): GuestInvoiceDraft {
  return {
    ...defaultCommercialDealDraft(currency),
    paymentCollectionMode: 'invoice_only',
    paymentMethod: undefined,
    fromBusinessName: '',
    fromBusinessEmail: '',
    paymentTermsNote: '',
  };
}

export function conversationGuestInvoiceDraft(currency = 'AUD'): GuestInvoiceDraft {
  return {
    ...conversationOriginCommercialDealDraft(currency),
    paymentCollectionMode: 'invoice_only',
    paymentMethod: undefined,
    fromBusinessName: '',
    fromBusinessEmail: '',
    paymentTermsNote: '',
  };
}

export function withGuestInvoiceFields(
  draft: CommercialDealDraft,
  extras?: Partial<Pick<GuestInvoiceDraft, 'fromBusinessName' | 'fromBusinessEmail' | 'paymentTermsNote'>>
): GuestInvoiceDraft {
  return {
    ...draft,
    paymentCollectionMode: 'invoice_only',
    fromBusinessName: extras?.fromBusinessName ?? '',
    fromBusinessEmail: extras?.fromBusinessEmail ?? '',
    paymentTermsNote: extras?.paymentTermsNote ?? '',
  };
}

export function guestInvoiceHasPreviewContent(draft: GuestInvoiceDraft): boolean {
  return Boolean(
    draft.customerName.trim() ||
      draft.customerEmail.trim() ||
      draft.description.trim() ||
      (typeof draft.amount === 'number' && draft.amount > 0) ||
      draft.paymentTermsNote.trim()
  );
}

export function guestInvoiceCanDownload(draft: GuestInvoiceDraft): boolean {
  const hasCustomer = Boolean(draft.customerName.trim() || draft.customerEmail.trim());
  const hasDescription = Boolean(draft.description.trim());
  const hasAmount = typeof draft.amount === 'number' && Number.isFinite(draft.amount) && draft.amount > 0;
  return hasCustomer && hasDescription && hasAmount;
}

export function guestInvoiceNumber(draft: GuestInvoiceDraft): string {
  const custom = draft.invoiceReference.trim();
  if (custom) return custom;
  return `INV-${format(draft.invoiceDate || new Date(), 'yyyyMMdd')}`;
}

export function paymentTermsFromExtraction(
  extraction: ConversationInvoiceExtraction | null | undefined
): string {
  return extraction?.paymentTimingNote?.trim() ?? '';
}
