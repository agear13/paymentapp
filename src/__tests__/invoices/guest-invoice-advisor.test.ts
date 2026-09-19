import {
  applyGuestAdvisorAction,
  buildGuestInvoiceAdvisorView,
  delayedDaysFromGuestInvoice,
} from '@/lib/invoices/guest-invoice-advisor';
import { defaultGuestInvoiceDraft } from '@/lib/invoices/guest-invoice-draft';
import { emptyConversationInvoiceExtraction } from '@/lib/invoices/conversation-invoice-extraction';
import { EARLY_PAYMENT_INCENTIVE_POLICY } from '@/lib/commercial-incentive/policy';

describe('guest invoice advisor', () => {
  it('stays hidden until invoice details exist', () => {
    const view = buildGuestInvoiceAdvisorView({
      draft: defaultGuestInvoiceDraft(),
      extraction: null,
    });
    expect(view.visible).toBe(false);
  });

  it('recommends an early-payment incentive from 30-day terms without claiming it will work', () => {
    const draft = defaultGuestInvoiceDraft();
    draft.customerName = 'Sarah';
    draft.description = 'Campaign';
    draft.amount = 12000;
    draft.paymentTermsNote = 'Within 30 days of invoice date';

    const view = buildGuestInvoiceAdvisorView({ draft, extraction: null });
    expect(view.visible).toBe(true);
    expect(view.insights[0].observation).toMatch(/30 days/);
    expect(view.insights[0].recommendation).toContain(
      `${EARLY_PAYMENT_INCENTIVE_POLICY.incentivePercent}% off if paid within ${EARLY_PAYMENT_INCENTIVE_POLICY.acceleratedDays} days`
    );
    expect(view.insights[0].recommendation).toMatch(/could consider|may help|not a guarantee/i);
    expect(view.insights[0].applyAction).toBe('early-payment-note');
  });

  it('does not invent historical customer data', () => {
    const draft = {
      ...defaultGuestInvoiceDraft(),
      customerName: 'Sarah',
      description: 'Campaign',
      amount: 12000,
    };
    const view = buildGuestInvoiceAdvisorView({ draft, extraction: null });
    const joined = [
      view.unlockCopy,
      ...view.insights.map((insight) => `${insight.observation} ${insight.recommendation}`),
    ].join(' ');
    expect(joined).not.toMatch(/usually pay|payment history|last invoice/i);
    expect(view.unlockCopy).toMatch(/until you connect|unlock more context/i);
  });

  it('surfaces a deposit option from extraction candidates without changing the amount', () => {
    const draft = {
      ...defaultGuestInvoiceDraft(),
      customerName: 'Sarah',
      description: 'Campaign',
      amount: 12000,
    };
    const extraction = emptyConversationInvoiceExtraction({
      customerName: 'Sarah',
      amount: undefined,
      paymentTimingNote: '50% upfront',
      candidates: [
        { kind: 'amount', label: '50% upfront', amount: 6000 },
        { kind: 'amount', label: '$12,000 total', amount: 12000 },
      ],
    });
    const view = buildGuestInvoiceAdvisorView({ draft, extraction });
    const deposit = view.insights.find((insight) => insight.id === 'deposit');
    expect(deposit).toBeTruthy();
    expect(deposit?.applyAction).toBe('deposit-note');

    const applied = applyGuestAdvisorAction(draft, 'deposit-note');
    expect(applied.amount).toBe(12000);
    expect(applied.paymentTermsNote).toMatch(/deposit/i);
  });

  it('applies the 7-day due date only when the user chooses that action', () => {
    const draft = defaultGuestInvoiceDraft();
    draft.invoiceDate = new Date('2026-10-01T12:00:00');
    const next = applyGuestAdvisorAction(draft, 'shorten-due-7');
    expect(next.dueDate).toBeInstanceOf(Date);
    expect(next.dueDate && next.invoiceDate).toBeTruthy();
    const days = Math.round(
      ((next.dueDate!.getTime() - next.invoiceDate.getTime()) / (1000 * 60 * 60 * 24))
    );
    expect(days).toBe(7);
    expect(draft.dueDate).not.toBe(next.dueDate);
  });

  it('reads delayed days from conversation payment timing notes', () => {
    const extraction = emptyConversationInvoiceExtraction({
      paymentTimingNote: 'The remaining balance is due within 14 days of delivery',
    });
    const delayed = delayedDaysFromGuestInvoice(defaultGuestInvoiceDraft(), extraction);
    expect(delayed?.days).toBe(14);
  });
});
