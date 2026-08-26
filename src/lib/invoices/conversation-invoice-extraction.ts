/**
 * Conversation → invoice extraction contract.
 *
 * Ephemeral: never persisted. Ownership rules live here so the LLM cannot
 * force invented commercial facts onto CommercialDealDraft.
 * Create Invoice remains the single invoice engine.
 */

import type { CommercialDealDraft } from '@/lib/commercial-os/commercial-deal-draft';
import { conversationOriginCommercialDealDraft } from '@/lib/commercial-os/commercial-deal-draft';
import {
  parseAgreementPrefillDueDate,
  parsePartyOwnedCalendarDate,
} from '@/lib/invoices/agreement-invoice-prefill';

export const CONVERSATION_INVOICE_MAX_CHARS = 50_000;
export const CONVERSATION_INVOICE_DESCRIPTION_MAX = 200;

export type ConversationInvoiceAmbiguousField =
  | 'customer'
  | 'amount'
  | 'currency'
  | 'dueDate'
  | 'description'
  | 'tax';

export type ConversationInvoiceCandidate = {
  kind: 'customer' | 'amount';
  label: string;
  amount?: number;
};

export type ConversationInvoiceUncertainty = {
  field: ConversationInvoiceAmbiguousField | 'general';
  message: string;
};

export type ConversationInvoiceExtraction = {
  customerName?: string;
  customerEmail?: string;
  description?: string;
  amount?: number;
  currency?: string;
  invoiceDate?: string;
  dueDate?: string;
  paymentTimingNote?: string | null;
  timingUnresolved: boolean;
  taxNote?: string | null;
  currencyFromConversation: boolean;
  uncertainties: ConversationInvoiceUncertainty[];
  ambiguousFields: ConversationInvoiceAmbiguousField[];
  candidates: ConversationInvoiceCandidate[];
};

const ISO_CURRENCY = /^[A-Z]{3}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const NARRATIVE_TIMING =
  /\b(after|once|when|upon|within|next month|on completion|as soon as|payment comes through)\b/i;

function asTrimmedString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function asPositiveAmount(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return undefined;
  return Math.round(value * 100) / 100;
}

function asIsoCurrency(value: unknown): string | undefined {
  const raw = asTrimmedString(value)?.toUpperCase();
  if (!raw || !ISO_CURRENCY.test(raw)) return undefined;
  return raw;
}

function asEmail(value: unknown): string | undefined {
  const raw = asTrimmedString(value)?.toLowerCase();
  if (!raw || !EMAIL.test(raw) || raw.length > 255) return undefined;
  return raw;
}

function asAmbiguousFields(value: unknown): ConversationInvoiceAmbiguousField[] {
  if (!Array.isArray(value)) return [];
  const allowed: ConversationInvoiceAmbiguousField[] = [
    'customer',
    'amount',
    'currency',
    'dueDate',
    'description',
    'tax',
  ];
  const seen = new Set<ConversationInvoiceAmbiguousField>();
  for (const item of value) {
    if (typeof item === 'string' && allowed.includes(item as ConversationInvoiceAmbiguousField)) {
      seen.add(item as ConversationInvoiceAmbiguousField);
    }
  }
  return [...seen];
}

function asUncertainties(value: unknown): ConversationInvoiceUncertainty[] {
  if (!Array.isArray(value)) return [];
  const out: ConversationInvoiceUncertainty[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const message = asTrimmedString(row.message) ?? asTrimmedString(row.issue);
    if (!message) continue;
    const fieldRaw = asTrimmedString(row.field) ?? 'general';
    const field = (
      ['customer', 'amount', 'currency', 'dueDate', 'description', 'tax', 'general'] as const
    ).includes(fieldRaw as ConversationInvoiceAmbiguousField | 'general')
      ? (fieldRaw as ConversationInvoiceUncertainty['field'])
      : 'general';
    out.push({ field, message: message.slice(0, 240) });
  }
  return out.slice(0, 12);
}

function asCandidates(value: unknown): ConversationInvoiceCandidate[] {
  if (!Array.isArray(value)) return [];
  const out: ConversationInvoiceCandidate[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const kind = row.kind === 'amount' || row.kind === 'customer' ? row.kind : null;
    const label = asTrimmedString(row.label);
    if (!kind || !label) continue;
    const amount = asPositiveAmount(row.amount);
    out.push(amount != null && kind === 'amount' ? { kind, label: label.slice(0, 80), amount } : { kind, label: label.slice(0, 80) });
  }
  return out.slice(0, 8);
}

function looksLikeWholesaleConversationCopy(description: string, conversationText?: string): boolean {
  const original = asTrimmedString(conversationText);
  if (!original) return (description.match(/\n/g) ?? []).length >= 2 && description.length > 80;

  const conversation = original.replace(/\s+/g, ' ').trim();
  if (conversation.length <= 80) return false;
  if (conversation === description) return true;
  if (conversation.startsWith(description) && conversation.length >= description.length) {
    return description.length > 80 || conversation.length > description.length + 20;
  }
  return description.length > 120 && conversation.includes(description) && conversation.length > 200;
}

function sanitizeDescription(value: unknown, conversationText?: string): string | undefined {
  const raw = asTrimmedString(value);
  if (!raw) return undefined;
  if ((raw.match(/\n/g) ?? []).length >= 2 && raw.length > 80) return undefined;
  const collapsed = raw.replace(/\s+/g, ' ').trim();
  if (!collapsed) return undefined;
  const description = collapsed.slice(0, CONVERSATION_INVOICE_DESCRIPTION_MAX).trim();
  if (!description) return undefined;
  if (conversationText && looksLikeWholesaleConversationCopy(description, conversationText)) {
    return undefined;
  }
  return description;
}

function uniqueAmountCandidates(candidates: ConversationInvoiceCandidate[]): number[] {
  const amounts = candidates
    .filter((c) => c.kind === 'amount' && typeof c.amount === 'number')
    .map((c) => c.amount as number);
  return [...new Set(amounts.map((n) => Math.round(n * 100) / 100))];
}

function uniqueCustomerCandidates(candidates: ConversationInvoiceCandidate[]): string[] {
  return [
    ...new Set(
      candidates
        .filter((c) => c.kind === 'customer')
        .map((c) => c.label.trim().toLowerCase())
        .filter(Boolean)
    ),
  ];
}

function pushUniqueField(
  fields: ConversationInvoiceAmbiguousField[],
  field: ConversationInvoiceAmbiguousField
): ConversationInvoiceAmbiguousField[] {
  return fields.includes(field) ? fields : [...fields, field];
}

export function emptyConversationInvoiceExtraction(
  extras?: Partial<ConversationInvoiceExtraction>
): ConversationInvoiceExtraction {
  return {
    timingUnresolved: true,
    currencyFromConversation: false,
    taxNote: null,
    paymentTimingNote: null,
    uncertainties: [],
    ambiguousFields: [],
    candidates: [],
    ...extras,
  };
}

/**
 * Fail closed: strip invented or ambiguous commercial facts from model/client JSON.
 */
export function sanitizeConversationInvoiceExtraction(
  raw: unknown,
  options?: { conversationText?: string }
): ConversationInvoiceExtraction {
  const input = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};

  let ambiguousFields = asAmbiguousFields(input.ambiguousFields);
  if (input.amountAmbiguous === true) {
    ambiguousFields = pushUniqueField(ambiguousFields, 'amount');
  }
  if (input.customerAmbiguous === true) {
    ambiguousFields = pushUniqueField(ambiguousFields, 'customer');
  }
  if (input.currencyAmbiguous === true) {
    ambiguousFields = pushUniqueField(ambiguousFields, 'currency');
  }

  const fromAmountCandidates = asCandidates(input.amountCandidates).map((c) => ({
    ...c,
    kind: 'amount' as const,
  }));
  const fromCustomerCandidates = asCandidates(input.customerCandidates).map((c) => ({
    ...c,
    kind: 'customer' as const,
  }));
  const candidates = [...asCandidates(input.candidates), ...fromAmountCandidates, ...fromCustomerCandidates].slice(
    0,
    8
  );

  const amountCandidates = uniqueAmountCandidates(candidates);
  const customerCandidates = uniqueCustomerCandidates(candidates);

  let amount = asPositiveAmount(input.amount);
  if (ambiguousFields.includes('amount') || amountCandidates.length > 1) {
    amount = undefined;
  }
  if (amountCandidates.length === 1 && amount != null && amountCandidates[0] !== amount) {
    amount = undefined;
  }

  let customerName = asTrimmedString(input.customerName)?.slice(0, 255);
  let customerEmail = asEmail(input.customerEmail);
  if (ambiguousFields.includes('customer') || customerCandidates.length > 1) {
    customerName = undefined;
    customerEmail = undefined;
  }

  let currency = asIsoCurrency(input.currency);
  if (ambiguousFields.includes('currency')) {
    currency = undefined;
  }
  const currencyFromConversation = Boolean(currency);

  const dueDateInput = asTrimmedString(input.dueDate) ?? asTrimmedString(input.due_date);
  const dueDateRaw = parsePartyOwnedCalendarDate(dueDateInput);
  const narrativeDueDateInput = Boolean(dueDateInput && NARRATIVE_TIMING.test(dueDateInput));
  let paymentTimingNote =
    asTrimmedString(input.paymentTimingNote)?.slice(0, 240) ??
    asTrimmedString(input.payment_timing_note)?.slice(0, 240) ??
    null;
  if (!paymentTimingNote && dueDateInput && !dueDateRaw) {
    paymentTimingNote = dueDateInput.slice(0, 240);
  }

  const narrativeTiming = Boolean(
    (paymentTimingNote && NARRATIVE_TIMING.test(paymentTimingNote)) || narrativeDueDateInput
  );
  const modelMarksTimingUnresolved = input.timingUnresolved === true;
  const dueDate =
    dueDateRaw && !ambiguousFields.includes('dueDate') && !modelMarksTimingUnresolved
      ? dueDateRaw
      : undefined;
  const timingUnresolved = !dueDate;

  const invoiceDate = parsePartyOwnedCalendarDate(
    asTrimmedString(input.invoiceDate) ?? asTrimmedString(input.invoice_date)
  );

  const description = sanitizeDescription(input.description, options?.conversationText);
  const taxNote = asTrimmedString(input.taxNote)?.slice(0, 240) ?? null;

  let uncertainties = asUncertainties(input.uncertainties);
  const ensure = (field: ConversationInvoiceUncertainty['field'], message: string) => {
    if (!uncertainties.some((u) => u.message === message)) {
      uncertainties = [...uncertainties, { field, message }];
    }
  };

  if (amount == null && (ambiguousFields.includes('amount') || amountCandidates.length > 1)) {
    ensure('amount', 'Multiple amounts mentioned — choose the invoice total');
  }
  if (!customerName && !customerEmail && (ambiguousFields.includes('customer') || customerCandidates.length > 1)) {
    ensure('customer', "Customer wasn't clearly identified");
  }
  if (!dueDate) {
    ensure(
      'dueDate',
      paymentTimingNote || narrativeTiming
        ? 'Payment timing was mentioned but no calendar due date was specified'
        : "Payment timing wasn't clearly specified"
    );
  }
  if (!currencyFromConversation) {
    ensure('currency', "Currency wasn't explicit — please confirm");
  }
  if (amountCandidates.length > 1) {
    ensure('amount', 'Provvy found additional possible amounts');
  }

  return {
    customerName,
    customerEmail,
    description,
    amount,
    currency,
    invoiceDate,
    dueDate,
    paymentTimingNote,
    timingUnresolved,
    taxNote,
    currencyFromConversation,
    uncertainties,
    ambiguousFields,
    candidates,
  };
}

export function conversationInvoiceReviewMessages(
  extraction: ConversationInvoiceExtraction
): string[] {
  const messages: string[] = [];
  const seen = new Set<string>();
  const add = (message: string | undefined | null) => {
    const trimmed = message?.trim();
    if (!trimmed || seen.has(trimmed)) return;
    seen.add(trimmed);
    messages.push(trimmed);
  };

  const amountIsAmbiguous =
    extraction.ambiguousFields.includes('amount') ||
    extraction.candidates.filter((c) => c.kind === 'amount').length > 1;
  if (amountIsAmbiguous) {
    add(
      extraction.uncertainties.find((u) => u.field === 'amount')?.message ??
        'Multiple amounts mentioned — choose the invoice total'
    );
  }
  if (
    extraction.ambiguousFields.includes('customer') ||
    extraction.candidates.filter((c) => c.kind === 'customer').length > 1
  ) {
    add(
      extraction.uncertainties.find((u) => u.field === 'customer')?.message ??
        "Customer wasn't clearly identified"
    );
  }
  if (extraction.timingUnresolved || !extraction.dueDate) {
    add(
      extraction.paymentTimingNote?.trim()
        ? `${extraction.paymentTimingNote}. This is not a calendar due date — set one if you need it before sending.`
        : extraction.uncertainties.find((u) => u.field === 'dueDate')?.message ??
            "Payment timing wasn't clearly specified"
    );
  }
  if (!extraction.currencyFromConversation) {
    add("Currency wasn't explicit — please confirm");
  }
  if (extraction.taxNote?.trim()) {
    add(extraction.taxNote.trim());
  }
  for (const item of extraction.uncertainties) {
    if (item.field === 'general') add(item.message);
  }
  return messages;
}

/**
 * Apply only safe conversation facts. Always clears an invented +14 due date
 * unless an explicit calendar date survived sanitization.
 */
export function applyConversationInvoiceExtractionToDraft(
  extraction: unknown,
  base?: CommercialDealDraft,
  options?: { conversationText?: string }
): CommercialDealDraft {
  const safe = sanitizeConversationInvoiceExtraction(extraction, options);
  const draft = base
    ? { ...base, dueDate: undefined }
    : conversationOriginCommercialDealDraft(safe.currency ?? 'AUD');

  return {
    ...draft,
    customerName: safe.customerName?.trim() || '',
    customerEmail: safe.customerEmail?.trim() || '',
    description: safe.description?.trim() || '',
    amount: safe.amount,
    currency: safe.currencyFromConversation && safe.currency ? safe.currency : draft.currency,
    invoiceDate: parseAgreementPrefillDueDate(safe.invoiceDate) ?? draft.invoiceDate,
    dueDate: parseAgreementPrefillDueDate(safe.dueDate),
  };
}
