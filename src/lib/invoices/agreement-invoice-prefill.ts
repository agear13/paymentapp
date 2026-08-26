/**
 * Agreement-originated participant invoice prefill.
 *
 * Pure ownership rules only. Does not read URL params, project cashflow,
 * or organiser payment rails. Create Invoice remains the single invoice engine.
 */

import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import type { CommercialDealDraft } from '@/lib/commercial-os/commercial-deal-draft';
import { defaultCommercialDealDraft } from '@/lib/commercial-os/commercial-deal-draft';
import type { RecentDeal } from '@/lib/data/mock-deal-network';
import { PAYMENT_TIMING_NOT_SPECIFIED_IN_AGREEMENT } from '@/lib/ai-extractor/party-linked-settlement';
import { resolveParticipantExportPayoutTiming } from '@/lib/deal-network-demo/export-payout-timing';
import { inferCompensationTypeFromParticipant } from '@/lib/participants/participant-compensation';

export const PARTICIPANT_PORTAL_INVOICE_ORIGIN = 'participant_portal';
export const MANUAL_INVOICE_ORIGIN = 'manual';
export const AGREEMENT_INVOICE_ORIGIN = 'agreement';

export const INVOICE_ORIGIN_VALUES = [
  MANUAL_INVOICE_ORIGIN,
  AGREEMENT_INVOICE_ORIGIN,
  PARTICIPANT_PORTAL_INVOICE_ORIGIN,
] as const;

export type InvoiceOrigin = (typeof INVOICE_ORIGIN_VALUES)[number];

export type ParticipantPortalInvoiceProvenance = {
  invoiceOrigin: typeof PARTICIPANT_PORTAL_INVOICE_ORIGIN;
  originParticipantId: string;
  originSourceOrganizationId: string | null;
  originDealId: string;
};

export type AgreementInvoiceCompensationKind = 'fixed' | 'variable';

export type AgreementInvoicePrefill = {
  origin: typeof PARTICIPANT_PORTAL_INVOICE_ORIGIN;
  compensationKind: AgreementInvoiceCompensationKind;
  amount: number | undefined;
  currency: string | undefined;
  customerName: string | undefined;
  description: string;
  projectName: string | undefined;
  agreementReference: string | undefined;
  /** yyyy-MM-dd when a party-owned calendar date exists. */
  dueDate: string | undefined;
  paymentTimingNote: string | null;
  timingUnresolved: boolean;
  originParticipantId: string;
  originDealId: string | undefined;
  originSourceOrganizationId: string | undefined;
};

function isIsoCurrency(value: string | undefined): value is string {
  return Boolean(value && /^[A-Za-z]{3}$/.test(value.trim()));
}

/**
 * Calendar dates only. Narrative conditions such as "upon approval" must not become due dates.
 */
export function parsePartyOwnedCalendarDate(raw: string | undefined | null): string | undefined {
  const trimmed = raw?.trim();
  if (!trimmed) return undefined;
  const match = /^(\d{4}-\d{2}-\d{2})(?:[T\s].*)?$/.exec(trimmed);
  if (!match) return undefined;
  const isoDate = match[1]!;
  const parsed = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return isoDate;
}

export function classifyAgreementInvoiceCompensation(
  participant: DemoParticipant
): AgreementInvoiceCompensationKind {
  const type = inferCompensationTypeFromParticipant(participant);
  if (
    type === 'REVENUE_SHARE' ||
    type === 'COMMISSION' ||
    type === 'HYBRID' ||
    type === 'CUSTOM'
  ) {
    return 'variable';
  }
  if (
    participant.participationModel === 'revenue_share' ||
    participant.participationModel === 'customer_attribution'
  ) {
    return 'variable';
  }
  if (
    participant.commissionKind === 'pct_deal_value' ||
    participant.commissionKind === 'catalog_attribution'
  ) {
    return 'variable';
  }
  const percentage = participant.compensationProfile?.percentage;
  if (typeof percentage === 'number' && percentage > 0 && type !== 'FIXED_FEE') {
    return 'variable';
  }
  return 'fixed';
}

function partyOwnedFixedAmount(participant: DemoParticipant): number | undefined {
  if (classifyAgreementInvoiceCompensation(participant) !== 'fixed') return undefined;
  if (participant.compensationProfile?.exemptFromPayout) return undefined;

  const fromProfile = participant.compensationProfile?.fixedAmount;
  const fromCommission =
    participant.commissionKind === 'fixed_amount' ? participant.commissionValue : undefined;
  const amount =
    typeof fromProfile === 'number' && fromProfile > 0
      ? fromProfile
      : typeof fromCommission === 'number' && fromCommission > 0
        ? fromCommission
        : undefined;
  return amount;
}

function agreementRoleLabel(participant: DemoParticipant): string {
  const details = participant.roleDetails?.trim();
  if (details && !details.includes('·') && details.length <= 80) return details;
  const firstSegment = details?.split('·')[0]?.trim();
  if (firstSegment && firstSegment.length > 0 && firstSegment.length <= 40) {
    return firstSegment;
  }
  if (participant.role && participant.role !== 'Contributor') return participant.role;
  return 'Agreement';
}

function suggestedInvoiceDescription(
  participant: DemoParticipant,
  deal: RecentDeal,
  kind: AgreementInvoiceCompensationKind
): string {
  const role = agreementRoleLabel(participant);
  const project = deal.dealName?.trim() || 'this agreement';
  if (kind === 'fixed') {
    const label = role === 'Agreement' ? 'Fee' : `${role} fee`;
    return `${label} — ${project}`.slice(0, 200);
  }
  return `${role} — ${project}`.slice(0, 200);
}

function partyOwnedTiming(participant: DemoParticipant): {
  dueDate: string | undefined;
  paymentTimingNote: string | null;
  timingUnresolved: boolean;
} {
  const timingText = resolveParticipantExportPayoutTiming(participant);
  if (timingText === PAYMENT_TIMING_NOT_SPECIFIED_IN_AGREEMENT) {
    return {
      dueDate: undefined,
      paymentTimingNote: PAYMENT_TIMING_NOT_SPECIFIED_IN_AGREEMENT,
      timingUnresolved: true,
    };
  }

  const dueDate =
    parsePartyOwnedCalendarDate(participant.payoutDueDate) ??
    parsePartyOwnedCalendarDate(timingText);

  return {
    dueDate,
    paymentTimingNote: timingText,
    timingUnresolved: false,
  };
}

export function buildAgreementInvoicePrefill(input: {
  participant: DemoParticipant;
  deal: RecentDeal;
  originSourceOrganizationId?: string | null;
}): AgreementInvoicePrefill {
  const { participant, deal } = input;
  const compensationKind = classifyAgreementInvoiceCompensation(participant);
  const timing = partyOwnedTiming(participant);
  const currency = isIsoCurrency(deal.projectValueCurrency)
    ? deal.projectValueCurrency.trim().toUpperCase()
    : undefined;
  const customerName = deal.partner?.trim() || undefined;

  return {
    origin: PARTICIPANT_PORTAL_INVOICE_ORIGIN,
    compensationKind,
    amount: compensationKind === 'fixed' ? partyOwnedFixedAmount(participant) : undefined,
    currency,
    customerName,
    description: suggestedInvoiceDescription(participant, deal, compensationKind),
    projectName: deal.dealName?.trim() || undefined,
    agreementReference: deal.id?.trim() || undefined,
    dueDate: timing.dueDate,
    paymentTimingNote: timing.paymentTimingNote,
    timingUnresolved: timing.timingUnresolved,
    originParticipantId: participant.id,
    originDealId: deal.id?.trim() || undefined,
    originSourceOrganizationId: input.originSourceOrganizationId?.trim() || undefined,
  };
}

export function parseAgreementPrefillDueDate(isoDate: string | undefined): Date | undefined {
  const parsed = parsePartyOwnedCalendarDate(isoDate);
  if (!parsed) return undefined;
  const date = new Date(`${parsed}T12:00:00`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/**
 * Apply agreement-origin facts onto a Create Invoice draft.
 * Always clears an invented +14 due date unless party-owned calendar timing exists.
 */
export function applyAgreementInvoicePrefillToDraft(
  prefill: AgreementInvoicePrefill,
  base?: CommercialDealDraft
): CommercialDealDraft {
  const draft = base
    ? { ...base }
    : { ...defaultCommercialDealDraft(prefill.currency ?? 'AUD'), dueDate: undefined };

  return {
    ...draft,
    customerName: prefill.customerName?.trim() || draft.customerName,
    description: prefill.description.trim() || draft.description,
    amount: prefill.amount,
    currency: prefill.currency ?? draft.currency,
    dueDate: parseAgreementPrefillDueDate(prefill.dueDate),
  };
}

export function agreementOriginTimingCopy(prefill: Pick<
  AgreementInvoicePrefill,
  'timingUnresolved' | 'paymentTimingNote' | 'dueDate'
>): { showUnresolvedTiming: boolean; note: string } {
  if (prefill.timingUnresolved || !prefill.dueDate) {
    if (prefill.timingUnresolved) {
      return {
        showUnresolvedTiming: true,
        note: 'Payment timing was not specified in the agreement. Set a due date if you need one before sending.',
      };
    }
    if (prefill.paymentTimingNote?.trim()) {
      return {
        showUnresolvedTiming: true,
        note: `${prefill.paymentTimingNote}. This is not a calendar due date — set one if you need it before sending.`,
      };
    }
  }
  return {
    showUnresolvedTiming: false,
    note: prefill.paymentTimingNote?.trim() || '',
  };
}
