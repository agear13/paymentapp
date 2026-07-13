/**
 * Participant Commercial Workspace — view model derivation.
 *
 * Pure functions over participant + deal + live portal context.
 * Works identically for AI-extracted and manual participants.
 */
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import type { RecentDeal } from '@/lib/data/mock-deal-network';
import {
  buildAgreementSummaryData,
  deriveParticipantCommercialLifecycle,
} from '@/lib/commercial/participant-commercial-lifecycle';
import { hasApprovedAgreement } from '@/lib/operations/primitives/participant-earnings-primitives';
import { isParticipantEarningsConfigured } from '@/lib/operations/selectors/participant-earnings-selectors';
import { formatCurrency } from '@/lib/formatters/format-currency';
import { DEFAULT_WORKSPACE_CURRENCY } from '@/lib/currency/workspace-currencies';
import { REVENUE_SOURCE_OPTIONS } from '@/lib/participants/participant-compensation-types';
import { deriveParticipantPortalIntelligence } from '@/lib/participant-portal/participant-portal-intelligence';
import { deriveParticipantCommercialLifecycleSteps } from '@/lib/participant-portal/participant-commercial-lifecycle';
import { deriveParticipantCommercialPerformance } from '@/lib/participant-portal/participant-commercial-performance';
import { deriveParticipantSettlementExplanation } from '@/lib/participant-portal/participant-settlement-explanation';
import { deriveParticipantCommercialState } from '@/lib/participant-portal/participant-workspace-state';
import { deriveParticipantWorkflowBadges } from '@/lib/commercial/workflows/derive-participant-workflows';
import type {
  ParticipantCommercialWorkspaceModel,
  ParticipantPortalContext,
  PortalAgreementSection,
  PortalAgreementStatus,
  PortalCommercialSection,
  PortalPaymentTimelineItem,
  CommercialStepStatus,
} from '@/lib/participant-portal/participant-portal-types';

export type { ParticipantCommercialWorkspaceModel } from '@/lib/participant-portal/participant-portal-types';

function formatPortalDate(iso: string | null | undefined): string | null {
  if (!iso?.trim()) return null;
  try {
    return new Date(iso).toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'long',
    });
  } catch {
    return iso;
  }
}

function revenueSourceLabel(id: string): string {
  return REVENUE_SOURCE_OPTIONS.find((o) => o.id === id)?.label ?? id.replace(/_/g, ' ');
}

function deriveAgreementStatus(participant: DemoParticipant): {
  status: PortalAgreementStatus;
  label: string;
} {
  if (hasApprovedAgreement(participant)) {
    return { status: 'approved', label: 'Approved' };
  }
  const stage = deriveParticipantCommercialLifecycle(participant);
  if (stage === 'AGREEMENT_SENT') {
    return { status: 'awaiting_acceptance', label: 'Awaiting Acceptance' };
  }
  if (stage === 'EARNINGS_CONFIGURED') {
    return { status: 'not_sent', label: 'Agreement Ready' };
  }
  return { status: 'draft', label: 'Draft' };
}

function deriveCommercialSections(
  participant: DemoParticipant,
  currency: string
): PortalCommercialSection[] {
  const sections: PortalCommercialSection[] = [];
  const profile = participant.compensationProfile;
  const type = profile?.compensationType;

  const addFixed = (amount: number, dueDate?: string | null) => {
    sections.push({
      kind: 'fixed_fee',
      amount: formatCurrency(amount, currency),
      dueDate: dueDate ?? null,
      dueDateLabel: formatPortalDate(dueDate),
    });
  };

  const addRevenueShare = (pct: number, sources?: string[]) => {
    const sourceLabel =
      sources?.length
        ? sources.map(revenueSourceLabel).join(', ')
        : participant.payoutCondition?.trim() || 'Per commercial agreement';
    sections.push({
      kind: 'revenue_share',
      percentage: `${pct}%`,
      revenueSource: sourceLabel,
      settlement: profile?.notes?.trim() || participant.payoutCondition?.trim() || 'Per agreement terms',
    });
  };

  const addCommission = (pct: number) => {
    const code = participant.referralCode?.trim();
    const commerceUrl = participant.customerCommerceUrl?.trim();
    let attributionType: 'promo_code' | 'referral_link' | 'none' = 'none';
    let attributionValue: string | null = null;

    if (code) {
      attributionType = 'promo_code';
      attributionValue = code;
    } else if (commerceUrl) {
      attributionType = 'referral_link';
      attributionValue = commerceUrl.replace(/^https?:\/\/[^/]+/, '');
    }

    sections.push({
      kind: 'commission',
      percentage: `${pct}%`,
      attributionType,
      attributionValue,
    });
  };

  if (type === 'HYBRID' && profile) {
    if (profile.fixedAmount != null && profile.fixedAmount > 0) {
      addFixed(profile.fixedAmount, participant.payoutDueDate);
    }
    if (profile.percentage != null && profile.percentage > 0) {
      if (profile.customerAttributionEnabled || participant.referralCommerce) {
        addCommission(profile.percentage);
      } else {
        addRevenueShare(profile.percentage, profile.revenueSources);
      }
    }
  } else if (type === 'FIXED_FEE' || participant.commissionKind === 'fixed_amount') {
    const amount = profile?.fixedAmount ?? participant.commissionValue;
    if (amount > 0) addFixed(amount, participant.payoutDueDate);
  } else if (type === 'REVENUE_SHARE' || participant.commissionKind === 'pct_deal_value') {
    const pct = profile?.percentage ?? participant.commissionValue;
    if (pct > 0) addRevenueShare(pct, profile?.revenueSources);
  } else if (type === 'COMMISSION' || participant.participationModel === 'customer_attribution') {
    const pct =
      profile?.percentage ??
      participant.referralCommerce?.commerceCommissionPct ??
      participant.commissionValue;
    if (pct > 0) addCommission(pct);
  } else if (type === 'REIMBURSEMENT' || type === 'CUSTOM') {
    sections.push({
      kind: 'custom',
      label: type === 'REIMBURSEMENT' ? 'Reimbursement' : 'Custom arrangement',
      detail: profile?.notes?.trim() || participant.payoutCondition?.trim() || 'Per commercial agreement',
    });
  }

  const extracted = participant.extractedObligations;
  if (extracted?.compensationTerms?.length) {
    for (const term of extracted.compensationTerms) {
      if (term.type === 'milestone' || term.trigger?.toLowerCase().includes('milestone')) {
        sections.push({
          kind: 'milestone',
          label: term.label,
          amount: term.amount != null ? formatCurrency(term.amount, currency) : null,
          trigger: term.trigger,
        });
      }
    }
  }

  if (extracted?.conditionalPayments?.length) {
    for (const cp of extracted.conditionalPayments) {
      sections.push({
        kind: 'milestone',
        label: cp.trigger,
        amount: cp.amount != null ? formatCurrency(cp.amount, currency) : null,
        trigger: 'Conditional payment',
      });
    }
  }

  return sections;
}

function deriveAgreementSection(participant: DemoParticipant, deal: RecentDeal): PortalAgreementSection {
  const extracted = participant.extractedObligations;
  const summary = buildAgreementSummaryData(participant, deal);

  const deliverables =
    extracted?.deliverables?.map((d) => d.description).filter(Boolean) ??
    (participant.roleDetails?.trim() ? [participant.roleDetails.trim()] : []);

  const commercialObligations =
    extracted?.operationalObligations?.map((o) => o.description).filter(Boolean) ??
    (summary.obligationsSummary ? [summary.obligationsSummary] : []);

  const paymentEvents =
    extracted?.settlementEvents?.map((e) => {
      const parts = [e.type.replace(/_/g, ' ')];
      if (e.amount != null) parts.push(formatCurrency(e.amount, DEFAULT_WORKSPACE_CURRENCY));
      if (e.percentage != null) parts.push(`${e.percentage}%`);
      if (e.trigger) parts.push(`— ${e.trigger}`);
      return parts.join(' ');
    }) ?? (summary.paymentSchedule !== 'Per commercial agreement terms' ? [summary.paymentSchedule] : []);

  const settlementRules =
    extracted?.settlementEvents
      ?.filter((e) => e.trigger)
      .map((e) => e.trigger as string) ?? [];

  const conditionalPayments =
    extracted?.conditionalPayments?.map((cp) => {
      const amt = cp.amount != null ? formatCurrency(cp.amount, DEFAULT_WORKSPACE_CURRENCY) : '';
      return [cp.trigger, amt].filter(Boolean).join(' — ');
    }) ?? [];

  return {
    deliverables,
    commercialObligations,
    paymentEvents,
    settlementRules,
    conditionalPayments,
  };
}

function obligationTimelineStatus(status: string): CommercialStepStatus {
  const s = status.toUpperCase();
  if (s === 'PAID') return 'complete';
  if (s === 'AVAILABLE_FOR_PAYOUT' || s === 'APPROVED') return 'active';
  if (s === 'UNFUNDED' || s === 'PARTIALLY_FUNDED') return 'waiting';
  return 'pending';
}

function derivePaymentTimeline(
  participant: DemoParticipant,
  currency: string,
  context: ParticipantPortalContext
): PortalPaymentTimelineItem[] {
  const items: PortalPaymentTimelineItem[] = [];
  const extracted = participant.extractedObligations;

  for (const [i, ob] of context.obligations.entries()) {
    items.push({
      id: `obligation-${ob.id}`,
      dateLabel: formatPortalDate(ob.dueDate) ?? 'Per agreement',
      title: ob.explanation.split('.')[0] || 'Commercial payment',
      status: obligationTimelineStatus(ob.status),
      detail: formatCurrency(ob.amountOwed, ob.currency || currency),
    });
    void i;
  }

  if (participant.payoutDueDate && context.obligations.length === 0) {
    items.push({
      id: 'fixed-due',
      dateLabel: formatPortalDate(participant.payoutDueDate) ?? participant.payoutDueDate,
      title: 'Fixed payment',
      status: deriveParticipantCommercialLifecycle(participant) === 'PAID' ? 'complete' : 'pending',
    });
  }

  if (extracted?.settlementEvents?.length) {
    for (const [i, event] of extracted.settlementEvents.entries()) {
      if (context.obligations.some((o) => o.explanation.includes(event.type))) continue;
      items.push({
        id: `settlement-${i}`,
        dateLabel: event.trigger ?? 'Per agreement',
        title: event.type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        status: 'pending',
        detail:
          event.amount != null
            ? formatCurrency(event.amount, currency)
            : event.percentage != null
              ? `${event.percentage}%`
              : undefined,
      });
    }
  }

  if (items.length === 0 && participant.payoutCondition?.trim()) {
    items.push({
      id: 'payout-condition',
      dateLabel: 'TBC',
      title: participant.payoutCondition.trim(),
      status: 'waiting',
      detail: 'Payment timing will become available once the organiser finalises settlement.',
    });
  }

  return items;
}

export function deriveParticipantCommercialWorkspace(
  participant: DemoParticipant,
  deal: RecentDeal,
  context: ParticipantPortalContext,
  currency = deal.projectValueCurrency ?? DEFAULT_WORKSPACE_CURRENCY
): ParticipantCommercialWorkspaceModel {
  const agreementMeta = deriveAgreementStatus(participant);
  const agreement = deriveAgreementSection(participant, deal);
  const performance = deriveParticipantCommercialPerformance(
    participant,
    context.obligations,
    context.attributionActivity,
    context.attributionActivity?.currency ?? currency
  );
  const settlement = deriveParticipantSettlementExplanation(participant, context.obligations);
  const commercialState = deriveParticipantCommercialState(participant);
  const workflowStatus = deriveParticipantWorkflowBadges(participant);

  return {
    participantName: participant.name?.trim() || 'Participant',
    participantRole: participant.role,
    participantSubtitle: 'Commercial Participant',
    projectName: deal.dealName,
    agreementStatus: agreementMeta.status,
    agreementStatusLabel: agreementMeta.label,
    lifecycleSteps: deriveParticipantCommercialLifecycleSteps(participant, agreement),
    commercialSections: deriveCommercialSections(participant, currency),
    agreement,
    performance,
    settlement,
    paymentTimeline: derivePaymentTimeline(participant, currency, context),
    intelligence: deriveParticipantPortalIntelligence(
      participant,
      deal,
      settlement,
      performance
    ),
    currency: context.attributionActivity?.currency ?? currency,
    syncedAt: context.syncedAt,
    hasEarningsConfiguration:
      isParticipantEarningsConfigured(participant) || performance.metrics.length > 0,
    commercialState,
    workflowStatus: {
      commercial: workflowStatus.commercialStatus,
      settlement: workflowStatus.settlementStatus,
      accounting: workflowStatus.accountingStatus,
    },
  };
}

/** @deprecated Use deriveParticipantCommercialWorkspace */
export const deriveParticipantPortalViewModel = deriveParticipantCommercialWorkspace;

export type {
  ParticipantCommercialWorkspaceModel,
  PortalAgreementSection,
  PortalCommercialSection,
  PortalPaymentTimelineItem,
  CommercialLifecycleStep,
  SettlementExplanation,
  ParticipantCommercialPerformance,
} from '@/lib/participant-portal/participant-portal-types';
