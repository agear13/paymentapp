import { conversationOriginCommercialDealDraft, defaultCommercialDealDraft } from '@/lib/commercial-os/commercial-deal-draft';
import {
  applyConversationInvoiceExtractionToDraft,
  conversationInvoiceReviewMessages,
  emptyConversationInvoiceExtraction,
  sanitizeConversationInvoiceExtraction,
} from '@/lib/invoices/conversation-invoice-extraction';

const GOLDEN = {
  customerName: 'Apex Promotions',
  customerEmail: 'accounts@apex.test',
  description: 'Event production services',
  amount: 5000,
  currency: 'AUD',
  invoiceDate: '2026-08-20',
  dueDate: '2026-09-15',
  paymentTimingNote: null,
  timingUnresolved: false,
  amountAmbiguous: false,
  customerAmbiguous: false,
  currencyAmbiguous: false,
};

describe('sanitizeConversationInvoiceExtraction', () => {
  it('keeps a single unambiguous invoice total, customer, AUD, description, and calendar due date', () => {
    const extraction = sanitizeConversationInvoiceExtraction(GOLDEN);
    expect(extraction.customerName).toBe('Apex Promotions');
    expect(extraction.amount).toBe(5000);
    expect(extraction.currency).toBe('AUD');
    expect(extraction.currencyFromConversation).toBe(true);
    expect(extraction.description).toBe('Event production services');
    expect(extraction.dueDate).toBe('2026-09-15');
    expect(extraction.timingUnresolved).toBe(false);
  });

  it('leaves amount blank when a deposit and total are both mentioned', () => {
    const extraction = sanitizeConversationInvoiceExtraction({
      amount: 2000,
      amountAmbiguous: true,
      amountCandidates: [
        { kind: 'amount', label: '$2,000 deposit', amount: 2000 },
        { kind: 'amount', label: '$5,000 total', amount: 5000 },
      ],
    });
    expect(extraction.amount).toBeUndefined();
    expect(extraction.ambiguousFields).toContain('amount');
    expect(extraction.candidates.filter((c) => c.kind === 'amount')).toHaveLength(2);
    expect(conversationInvoiceReviewMessages(extraction).join(' ')).toMatch(/Multiple amounts|invoice total/i);
  });

  it('does not apply a partial/deposit as the invoice total', () => {
    const extraction = sanitizeConversationInvoiceExtraction({
      amount: 2500,
      amountAmbiguous: true,
      amountCandidates: [
        { kind: 'amount', label: '50% now', amount: 2500 },
        { kind: 'amount', label: 'total $5,000', amount: 5000 },
      ],
    });
    expect(extraction.amount).toBeUndefined();
  });

  it('leaves amount blank for a percentage without a calculable base', () => {
    const extraction = sanitizeConversationInvoiceExtraction({
      amount: 15,
      amountAmbiguous: true,
      uncertainties: [{ field: 'amount', message: 'Percentage mentioned without a base' }],
    });
    expect(extraction.amount).toBeUndefined();
  });

  it('leaves customer blank when multiple payers are plausible', () => {
    const extraction = sanitizeConversationInvoiceExtraction({
      customerName: 'Alex',
      customerAmbiguous: true,
      customerCandidates: [
        { kind: 'customer', label: 'Alex' },
        { kind: 'customer', label: 'Apex Promotions' },
      ],
    });
    expect(extraction.customerName).toBeUndefined();
    expect(extraction.customerEmail).toBeUndefined();
    expect(conversationInvoiceReviewMessages(extraction).join(' ')).toMatch(/Customer wasn't clearly identified/);
  });

  it('does not convert narrative timing into a calendar due date', () => {
    const extraction = sanitizeConversationInvoiceExtraction({
      dueDate: 'within 7 days after the event',
      paymentTimingNote: 'within 7 days after the event',
      timingUnresolved: true,
    });
    expect(extraction.dueDate).toBeUndefined();
    expect(extraction.timingUnresolved).toBe(true);
    expect(extraction.paymentTimingNote).toMatch(/within 7 days/i);
    expect(conversationInvoiceReviewMessages(extraction).join(' ')).toMatch(/Payment timing|calendar due date/i);
  });

  it('does not apply a guessed calendar date when timing is unresolved', () => {
    const extraction = sanitizeConversationInvoiceExtraction({
      dueDate: '2026-09-15',
      timingUnresolved: true,
      paymentTimingNote: 'within 7 days after the event',
    });
    expect(extraction.dueDate).toBeUndefined();
    expect(extraction.timingUnresolved).toBe(true);
  });

  it('does not apply after approval or when the client pays as a due date', () => {
    for (const note of ['after approval', 'when the client pays', 'on completion']) {
      const extraction = sanitizeConversationInvoiceExtraction({
        dueDate: note,
        paymentTimingNote: note,
      });
      expect(extraction.dueDate).toBeUndefined();
      expect(extraction.timingUnresolved).toBe(true);
    }
  });

  it('populates an explicit calendar due date', () => {
    const extraction = sanitizeConversationInvoiceExtraction({ dueDate: '2026-10-01' });
    expect(extraction.dueDate).toBe('2026-10-01');
    expect(extraction.timingUnresolved).toBe(false);
  });

  it('does not apply a speculative currency', () => {
    const extraction = sanitizeConversationInvoiceExtraction({
      currency: 'AUD',
      currencyAmbiguous: true,
    });
    expect(extraction.currency).toBeUndefined();
    expect(extraction.currencyFromConversation).toBe(false);
  });

  it('rejects non-ISO currency codes', () => {
    const extraction = sanitizeConversationInvoiceExtraction({ currency: 'Australian dollars' });
    expect(extraction.currency).toBeUndefined();
    expect(extraction.currencyFromConversation).toBe(false);
  });

  it('keeps description concise and never copies the raw conversation', () => {
    const conversation = `Client: Can you invoice us $5,000 for the event production work?\nYou: Yes I will send it this week.\nClient: Thanks, Apex Promotions.`;
    const extraction = sanitizeConversationInvoiceExtraction(
      { description: conversation },
      { conversationText: conversation }
    );
    expect(extraction.description).toBeUndefined();

    const short = sanitizeConversationInvoiceExtraction({
      description: `${'Event production and lighting setup for Saturday Beach. '.repeat(10)}`,
    });
    expect(short.description?.length).toBeLessThanOrEqual(200);
    expect(short.description).not.toContain('\n');
  });

  it('ignores extra client fields such as origin and injected amounts once filtered', () => {
    const extraction = sanitizeConversationInvoiceExtraction({
      ...GOLDEN,
      invoiceOrigin: 'participant_portal',
      organizationId: 'org-spoof',
      conversationText: 'should not become description',
      amountAmbiguous: true,
      amount: 99999,
    });
    expect(extraction.amount).toBeUndefined();
    expect(extraction.description).toBe('Event production services');
  });

  it('does not fold tax language into the amount', () => {
    const extraction = sanitizeConversationInvoiceExtraction({
      amount: 5000,
      taxNote: 'Plus GST',
    });
    expect(extraction.amount).toBe(5000);
    expect(extraction.taxNote).toBe('Plus GST');
  });
});

describe('applyConversationInvoiceExtractionToDraft', () => {
  it('applies the golden case onto a conversation-origin draft', () => {
    const extraction = sanitizeConversationInvoiceExtraction(GOLDEN);
    const draft = applyConversationInvoiceExtractionToDraft(
      extraction,
      conversationOriginCommercialDealDraft('AUD')
    );
    expect(draft.customerName).toBe('Apex Promotions');
    expect(draft.amount).toBe(5000);
    expect(draft.currency).toBe('AUD');
    expect(draft.description).toBe('Event production services');
    expect(draft.dueDate).toBeDefined();
    const due = draft.dueDate!;
    expect(
      `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, '0')}-${String(due.getDate()).padStart(2, '0')}`
    ).toBe('2026-09-15');
  });

  it('clears an invented +14 due date when conversation timing is unresolved', () => {
    const manual = defaultCommercialDealDraft('AUD');
    expect(manual.dueDate).toBeDefined();
    const extraction = sanitizeConversationInvoiceExtraction({
      paymentTimingNote: 'after the event',
      timingUnresolved: true,
    });
    const draft = applyConversationInvoiceExtractionToDraft(extraction, manual);
    expect(draft.dueDate).toBeUndefined();
    expect(extraction.timingUnresolved).toBe(true);
  });

  it('does not copy a workspace default currency as an AI fact', () => {
    const extraction = emptyConversationInvoiceExtraction();
    const draft = applyConversationInvoiceExtractionToDraft(
      extraction,
      conversationOriginCommercialDealDraft('NZD')
    );
    expect(extraction.currencyFromConversation).toBe(false);
    expect(draft.currency).toBe('NZD');
    expect(draft.amount).toBeUndefined();
    expect(draft.customerName).toBe('');
  });
});

describe('conversation vs manual draft factories', () => {
  it('keeps Door A +14 days on the blank manual draft', () => {
    const draft = defaultCommercialDealDraft('AUD');
    const days = Math.round(
      ((draft.dueDate!.getTime() - draft.invoiceDate.getTime()) / (1000 * 60 * 60 * 24))
    );
    expect(days).toBe(14);
  });

  it('conversation-origin draft does not invent a due date', () => {
    expect(conversationOriginCommercialDealDraft('AUD').dueDate).toBeUndefined();
  });
});
