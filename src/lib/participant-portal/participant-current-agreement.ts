/**
 * Presentation adapter for the participant-facing current agreement.
 *
 * Separates:
 *   - current agreement / payment schedule
 *   - participant-wide relationship earnings
 *
 * Does not invent historical totals, rewrite obligations, or add a second
 * payment-schedule model. Reuses the existing canonical amount adapter.
 */
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import type { RecentDeal } from '@/lib/data/mock-deal-network';
import { currentAgreementVersion } from '@/lib/agreements/agreement-presentation';
import { displayableCompensationAmount } from '@/lib/commercial-os/compensation-amount-presentation';
import {
  agreementPaymentScheduleFromTerms,
  type AgreementPaymentScheduleView,
} from '@/lib/commercial-os/payment-schedule-presentation';
import { operationalRoleLabel } from '@/lib/projects/participants-for-project';
import { formatCurrency } from '@/lib/formatters/format-currency';
import { DEFAULT_WORKSPACE_CURRENCY } from '@/lib/currency/workspace-currencies';
import type { PortalObligationSnapshot } from '@/lib/participant-portal/participant-portal-types';

const AI_IMPORT_METADATA = /\[AI Import:[^\]]*\]/gi;
const GENERIC_AFFILIATE_TITLE = /affiliate agreement$/i;

export type ParticipantRelationshipEarnings = {
  totalAmount: number | null;
  thisAgreementAmount: number | null;
  previousActivityAmount: number | null;
  totalLabel: string | null;
  thisAgreementLabel: string | null;
  previousActivityLabel: string | null;
};

export function hasExtractedCompensationSchedule(participant: DemoParticipant): boolean {
  return (participant.extractedObligations?.compensationTerms?.length ?? 0) > 0;
}

export function isGenericAffiliateAgreementTitle(title: string | null | undefined): boolean {
  return GENERIC_AFFILIATE_TITLE.test(title?.trim() ?? '');
}

export function sanitizeParticipantFacingCommercialText(
  text: string | null | undefined
): string | null {
  if (!text?.trim()) return null;
  const cleaned = text
    .replace(AI_IMPORT_METADATA, '')
    .replace(/\s*\|\s*/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
  if (!cleaned) return null;
  if (/^other\s*·\s*v\d+$/i.test(cleaned)) return null;
  if (/^v\d+$/i.test(cleaned)) return null;
  return cleaned;
}

export function containsInternalExtractionMetadata(text: string | null | undefined): boolean {
  if (!text) return false;
  return /\[AI Import/i.test(text) || /schema version/i.test(text);
}

export function resolveParticipantAgreementTitle(
  deal: RecentDeal,
  participant: DemoParticipant
): string {
  const dealName = deal.dealName?.trim() || '';
  const snapshotTitle = currentAgreementVersion(participant)?.title?.trim() || '';

  if (hasExtractedCompensationSchedule(participant)) {
    if (dealName && !isGenericAffiliateAgreementTitle(dealName)) return dealName;
    if (snapshotTitle && !isGenericAffiliateAgreementTitle(snapshotTitle)) return snapshotTitle;
    if (dealName) return dealName;
    return snapshotTitle;
  }

  if (dealName) return dealName;
  return snapshotTitle;
}

export function resolveParticipantContractingParty(
  deal: RecentDeal,
  participant: DemoParticipant
): string | null {
  const partner = deal.partner?.trim() || '';
  if (hasExtractedCompensationSchedule(participant) && partner) {
    return partner;
  }
  return partner || null;
}

export function resolveParticipantFacingRole(participant: DemoParticipant): string {
  const labelled = participant.roleLabel?.trim();
  if (labelled) return labelled;
  return operationalRoleLabel(participant);
}

export function currentAgreementScheduleFromParticipant(
  participant: DemoParticipant,
  deal: RecentDeal
): AgreementPaymentScheduleView | null {
  const terms = (participant.extractedObligations?.compensationTerms ?? []).filter((term) => {
    const type = term.type?.toLowerCase();
    return (
      type === 'milestone' ||
      type === 'instalment' ||
      type === 'fixed_fee' ||
      Boolean(term.trigger?.toLowerCase().includes('milestone'))
    );
  });
  if (terms.length === 0) return null;

  const siblingCount = terms.length;
  const projectShare =
    deal.value > 0 && siblingCount >= 2 && Number.isFinite(deal.value / siblingCount)
      ? deal.value / siblingCount
      : null;

  const slices = terms.map((term) => ({
    description: term.label?.trim() || null,
    amount: displayableCompensationAmount(
      term.amount,
      siblingCount,
      term.label,
      projectShare
    ),
    currency: deal.projectValueCurrency ?? DEFAULT_WORKSPACE_CURRENCY,
    dueCondition: term.trigger?.trim() || null,
  }));

  return agreementPaymentScheduleFromTerms(
    slices,
    deal.value > 0 ? deal.value : null,
    deal.projectValueCurrency ?? DEFAULT_WORKSPACE_CURRENCY
  );
}

export function partitionPortalObligations(
  obligations: PortalObligationSnapshot[],
  currentDealId: string | null | undefined
): { currentDeal: PortalObligationSnapshot[]; historical: PortalObligationSnapshot[] } {
  const dealId = currentDealId?.trim() || '';
  const scoped = obligations.filter((row) => row.dealId?.trim());
  if (!dealId || scoped.length === 0) {
    return { currentDeal: [], historical: [] };
  }
  return {
    currentDeal: obligations.filter((row) => row.dealId === dealId),
    historical: obligations.filter((row) => row.dealId && row.dealId !== dealId),
  };
}

export function sumObligationAmounts(obligations: PortalObligationSnapshot[]): number {
  return obligations
    .filter((row) => row.status.toUpperCase() !== 'REVERSED')
    .reduce((sum, row) => sum + row.amountOwed, 0);
}

export function deriveParticipantRelationshipEarnings(
  obligations: PortalObligationSnapshot[],
  currentDealId: string | null | undefined,
  thisAgreementAmount: number | null,
  currency: string
): ParticipantRelationshipEarnings {
  const { historical } = partitionPortalObligations(obligations, currentDealId);
  const relationshipTotal = obligations.length > 0 ? sumObligationAmounts(obligations) : null;
  const previousFromRecords =
    historical.length > 0 ? sumObligationAmounts(historical) : null;

  const previousActivityAmount =
    previousFromRecords != null && previousFromRecords > 0 ? previousFromRecords : null;

  return {
    totalAmount: relationshipTotal != null && relationshipTotal > 0 ? relationshipTotal : null,
    thisAgreementAmount:
      thisAgreementAmount != null && thisAgreementAmount > 0 ? thisAgreementAmount : null,
    previousActivityAmount,
    totalLabel:
      relationshipTotal != null && relationshipTotal > 0
        ? formatCurrency(relationshipTotal, currency)
        : null,
    thisAgreementLabel:
      thisAgreementAmount != null && thisAgreementAmount > 0
        ? formatCurrency(thisAgreementAmount, currency)
        : null,
    previousActivityLabel:
      previousActivityAmount != null
        ? formatCurrency(previousActivityAmount, currency)
        : null,
  };
}

export function formatDisplayableExtractedAmount(
  rawAmount: number | null | undefined,
  siblingCount: number,
  label?: string | null,
  calibratedAmount?: number | null,
  currency = DEFAULT_WORKSPACE_CURRENCY
): string | null {
  const amount = displayableCompensationAmount(
    rawAmount,
    siblingCount,
    label,
    calibratedAmount
  );
  if (amount == null) return null;
  return formatCurrency(amount, currency);
}
