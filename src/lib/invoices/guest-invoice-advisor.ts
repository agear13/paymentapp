import type { ConversationInvoiceExtraction } from '@/lib/invoices/conversation-invoice-extraction';
import {
  parseDelayedPaymentDays,
  textAlreadyHasEarlyPaymentDiscount,
} from '@/lib/commercial-incentive/detect-delayed-terms';
import { EARLY_PAYMENT_INCENTIVE_POLICY } from '@/lib/commercial-incentive/policy';
import type { GuestInvoiceDraft } from '@/lib/invoices/guest-invoice-draft';
import { guestInvoiceHasPreviewContent } from '@/lib/invoices/guest-invoice-draft';

export type GuestAdvisorApplyAction = 'early-payment-note' | 'shorten-due-7' | 'deposit-note';

export type GuestAdvisorInsight = {
  id: string;
  observation: string;
  recommendation: string;
  applyLabel?: string;
  applyAction?: GuestAdvisorApplyAction;
};

export type GuestAdvisorView = {
  visible: boolean;
  headline: string;
  insights: GuestAdvisorInsight[];
  unlockCopy: string;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function calendarDaysBetween(from: Date, to: Date): number | null {
  const start = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const end = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  const days = Math.round((end - start) / MS_PER_DAY);
  return days > 0 ? days : null;
}

export function delayedDaysFromGuestInvoice(
  draft: GuestInvoiceDraft,
  extraction: ConversationInvoiceExtraction | null | undefined
): { days: number; source: string } | null {
  const timingNote = extraction?.paymentTimingNote?.trim() || draft.paymentTermsNote.trim();
  const fromNote = parseDelayedPaymentDays(timingNote);
  if (fromNote != null) {
    return { days: fromNote, source: timingNote };
  }
  if (draft.dueDate && draft.invoiceDate) {
    const days = calendarDaysBetween(draft.invoiceDate, draft.dueDate);
    if (days != null) {
      return { days, source: `${days} days from invoice date` };
    }
  }
  return null;
}

function looksLikeDepositLabel(label: string): boolean {
  return /\b(deposit|upfront|up-front|50\s*%|instalment|installment|milestone)\b/i.test(label);
}

export function guestInvoiceMentionsDeposit(
  extraction: ConversationInvoiceExtraction | null | undefined
): boolean {
  if (!extraction) return false;
  if (extraction.candidates.some((candidate) => looksLikeDepositLabel(candidate.label))) {
    return true;
  }
  return looksLikeDepositLabel(extraction.paymentTimingNote ?? '');
}

export function buildGuestInvoiceAdvisorView(input: {
  draft: GuestInvoiceDraft;
  extraction: ConversationInvoiceExtraction | null;
  appliedActionIds?: readonly string[];
}): GuestAdvisorView {
  const applied = new Set(input.appliedActionIds ?? []);
  if (!guestInvoiceHasPreviewContent(input.draft) && !input.extraction) {
    return {
      visible: false,
      headline: '',
      insights: [],
      unlockCopy: '',
    };
  }

  const insights: GuestAdvisorInsight[] = [];
  const delayed = delayedDaysFromGuestInvoice(input.draft, input.extraction);
  const timingAlreadyHasIncentive = textAlreadyHasEarlyPaymentDiscount(
    `${input.extraction?.paymentTimingNote ?? ''} ${input.draft.paymentTermsNote}`
  );

  if (delayed && !timingAlreadyHasIncentive) {
    const source = delayed.source.replace(/\.$/, '');
    if (delayed.days >= EARLY_PAYMENT_INCENTIVE_POLICY.minDelayedDays) {
      insights.push({
        id: 'early-payment',
        observation: `Your remaining balance is due ${delayed.days} days after the invoice date (${source}).`,
        recommendation: `Depending on your customer relationship, you could consider shorter terms or offering ${EARLY_PAYMENT_INCENTIVE_POLICY.incentivePercent}% off if paid within ${EARLY_PAYMENT_INCENTIVE_POLICY.acceleratedDays} days. That may help encourage faster payment — it is not a guarantee.`,
        applyLabel: `Add ${EARLY_PAYMENT_INCENTIVE_POLICY.incentivePercent}% within ${EARLY_PAYMENT_INCENTIVE_POLICY.acceleratedDays} days as a note`,
        applyAction: applied.has('early-payment') ? undefined : 'early-payment-note',
      });
    } else {
      insights.push({
        id: 'shorter-terms',
        observation: `Payment timing on this invoice is ${source}.`,
        recommendation:
          'Depending on your customer relationship, you could consider a shorter payment window. One option is setting the due date 7 days from the invoice date. Provvy will not change the invoice unless you choose to.',
        applyLabel: 'Set due date to 7 days from issue',
        applyAction: applied.has('shorter-terms') ? undefined : 'shorten-due-7',
      });
    }
  }

  if (guestInvoiceMentionsDeposit(input.extraction) && !applied.has('deposit')) {
    insights.push({
      id: 'deposit',
      observation: 'The conversation mentions a deposit or staged payment.',
      recommendation:
        'One option is requiring a deposit before work begins, then invoicing the remaining balance on completion. Provvy will not split or change the amount unless you edit it.',
      applyLabel: 'Add a deposit note to payment terms',
      applyAction: 'deposit-note',
    });
  }

  if (insights.length === 0) {
    insights.push({
      id: 'created',
      observation: "I've created your invoice from the details available.",
      recommendation:
        'Want personalised commercial recommendations? Connect your business to Provvy to unlock more context. Provvy cannot see payment history or accounting records until you connect those systems.',
    });
  }

  return {
    visible: true,
    headline: 'Provvy Advisor',
    insights,
    unlockCopy: 'Want personalised commercial recommendations? Connect your business to Provvy to unlock more context.',
  };
}

export function applyGuestAdvisorAction(
  draft: GuestInvoiceDraft,
  action: GuestAdvisorApplyAction
): GuestInvoiceDraft {
  if (action === 'early-payment-note') {
    const note = `${EARLY_PAYMENT_INCENTIVE_POLICY.incentivePercent}% discount if paid within ${EARLY_PAYMENT_INCENTIVE_POLICY.acceleratedDays} days`;
    return {
      ...draft,
      paymentTermsNote: mergePaymentTermsNote(draft.paymentTermsNote, note),
    };
  }
  if (action === 'shorten-due-7') {
    const dueDate = new Date(draft.invoiceDate);
    dueDate.setDate(dueDate.getDate() + EARLY_PAYMENT_INCENTIVE_POLICY.acceleratedDays);
    return { ...draft, dueDate };
  }
  if (action === 'deposit-note') {
    return {
      ...draft,
      paymentTermsNote: mergePaymentTermsNote(
        draft.paymentTermsNote,
        'Consider requiring a deposit before work begins.'
      ),
    };
  }
  return draft;
}

function mergePaymentTermsNote(current: string, addition: string): string {
  const trimmed = current.trim();
  if (!trimmed) return addition;
  if (trimmed.toLowerCase().includes(addition.toLowerCase())) return trimmed;
  return `${trimmed} ${addition}`;
}
