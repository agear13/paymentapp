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
import { formatScheduleMoney } from '@/lib/commercial-os/payment-schedule-presentation';
import {
  containsInternalExtractionMetadata,
  currentAgreementScheduleFromParticipant,
  deriveParticipantRelationshipEarnings,
  formatDisplayableExtractedAmount,
  partitionPortalObligations,
  resolveParticipantAgreementTitle,
  resolveParticipantContractingParty,
  resolveParticipantFacingRole,
  sanitizeParticipantFacingCommercialText,
} from '@/lib/participant-portal/participant-current-agreement';
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
  currency: string,
  deal?: RecentDeal
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
  const schedule = deal ? currentAgreementScheduleFromParticipant(participant, deal) : null;
  if (extracted?.compensationTerms?.length) {
    const siblingCount = extracted.compensationTerms.length;
    const milestoneTerms = extracted.compensationTerms.filter(
      (term) => term.type === 'milestone' || term.trigger?.toLowerCase().includes('milestone')
    );
    for (const [index, term] of milestoneTerms.entries()) {
      const label = sanitizeParticipantFacingCommercialText(term.label) ?? term.label;
      const scheduled = schedule?.items[index];
      sections.push({
        kind: 'milestone',
        label,
        amount:
          scheduled?.amount != null
            ? formatCurrency(scheduled.amount, currency)
            : formatDisplayableExtractedAmount(
                term.amount,
                siblingCount,
                term.label,
                schedule?.equalMilestoneAmount ?? null,
                currency
              ),
        trigger:
          sanitizeParticipantFacingCommercialText(scheduled?.dueLabel ?? term.trigger) ??
          term.trigger,
      });
    }
  }

  if (extracted?.conditionalPayments?.length) {
    const siblingCount = extracted.conditionalPayments.length;
    for (const cp of extracted.conditionalPayments) {
      sections.push({
        kind: 'milestone',
        label: sanitizeParticipantFacingCommercialText(cp.trigger) ?? cp.trigger,
        amount: formatDisplayableExtractedAmount(
          cp.amount,
          siblingCount,
          cp.trigger,
          null,
          currency
        ),
        trigger: 'Conditional payment',
      });
    }
  }

  return sections;
}

function visibleCommercialLines(values: Array<string | null | undefined>): string[] {
  return values
    .map((value) => sanitizeParticipantFacingCommercialText(value))
    .filter((value): value is string => Boolean(value))
    .filter((value) => !containsInternalExtractionMetadata(value));
}

function deriveAgreementSection(participant: DemoParticipant, deal: RecentDeal): PortalAgreementSection {
  const extracted = participant.extractedObligations;
  const summary = buildAgreementSummaryData(participant, deal);
  const schedule = currentAgreementScheduleFromParticipant(participant, deal);
  const siblingCount = extracted?.settlementEvents?.length ?? 0;

  const deliverables = visibleCommercialLines(
    extracted?.deliverables?.map((d) => d.description) ??
      (participant.roleDetails?.trim() ? [participant.roleDetails.trim()] : [])
  );

  const commercialObligations = visibleCommercialLines(
    extracted?.operationalObligations?.map((o) => o.description) ??
      (summary.obligationsSummary ? [summary.obligationsSummary] : [])
  );

  const paymentEvents =
    schedule?.items.length
      ? schedule.items.map((item, index) => {
          const amount = item.amount != null ? formatCurrency(item.amount, deal.projectValueCurrency ?? DEFAULT_WORKSPACE_CURRENCY) : '';
          return [`${item.label || `Milestone ${index + 1}`}`, amount, item.dueLabel ? `— ${item.dueLabel}` : '']
            .filter(Boolean)
            .join(' ');
        })
      : visibleCommercialLines(
          extracted?.settlementEvents?.map((e) => {
            const parts = [e.type.replace(/_/g, ' ')];
            const amount = formatDisplayableExtractedAmount(
              e.amount,
              siblingCount,
              e.trigger,
              schedule?.equalMilestoneAmount ?? null,
              deal.projectValueCurrency ?? DEFAULT_WORKSPACE_CURRENCY
            );
            if (amount) parts.push(amount);
            if (e.percentage != null) parts.push(`${e.percentage}%`);
            if (e.trigger) parts.push(`— ${e.trigger}`);
            return parts.join(' ');
          }) ??
            (summary.paymentSchedule !== 'Per commercial agreement terms'
              ? [summary.paymentSchedule]
              : [])
        );

  const settlementRules = visibleCommercialLines(
    extracted?.settlementEvents?.filter((e) => e.trigger).map((e) => e.trigger as string) ??
      schedule?.items.map((item) => item.dueLabel).filter(Boolean) ??
      []
  );

  const conditionalPayments = visibleCommercialLines(
    extracted?.conditionalPayments?.map((cp) => {
      const amt = formatDisplayableExtractedAmount(
        cp.amount,
        extracted.conditionalPayments.length,
        cp.trigger,
        null,
        deal.projectValueCurrency ?? DEFAULT_WORKSPACE_CURRENCY
      );
      return [cp.trigger, amt].filter(Boolean).join(' — ');
    }) ?? []
  );

  const termsStatements = visibleCommercialLines([
    participant.participantNotes,
    participant.roleDetails,
    extracted?.settlementEvents?.find((event) => event.trigger?.trim())?.trigger,
  ]);

  return {
    deliverables,
    commercialObligations,
    paymentEvents,
    settlementRules,
    conditionalPayments,
    termsStatements,
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
  deal: RecentDeal,
  currency: string,
  context: ParticipantPortalContext
): PortalPaymentTimelineItem[] {
  const items: PortalPaymentTimelineItem[] = [];
  const extracted = participant.extractedObligations;
  const schedule = currentAgreementScheduleFromParticipant(participant, deal);
  const { currentDeal } = partitionPortalObligations(context.obligations, deal.id);

  if (schedule?.items.length) {
    return schedule.items.map((item, index) => {
      const amountLabel =
        item.amount != null ? formatScheduleMoney(item.amount, currency) : null;
      const title = [item.label || `Milestone ${index + 1}`, amountLabel]
        .filter(Boolean)
        .join(' — ');
      return {
        id: `schedule-${index + 1}`,
        dateLabel: item.dueLabel ?? 'Per agreement',
        title,
        status: 'pending' as const,
        detail: item.dueLabel ?? undefined,
      };
    });
  }

  const hasDealScopedRows = context.obligations.some((row) => Boolean(row.dealId?.trim()));
  const timelineObligations = hasDealScopedRows ? currentDeal : context.obligations;

  if (timelineObligations.length > 0) {
    for (const ob of timelineObligations) {
      items.push({
        id: `obligation-${ob.id}`,
        dateLabel: formatPortalDate(ob.dueDate) ?? 'Per agreement',
        title: ob.explanation.split('.')[0] || 'Commercial payment',
        status: obligationTimelineStatus(ob.status),
        detail: formatCurrency(ob.amountOwed, ob.currency || currency),
      });
    }
  }

  if (participant.payoutDueDate && items.length === 0) {
    items.push({
      id: 'fixed-due',
      dateLabel: formatPortalDate(participant.payoutDueDate) ?? participant.payoutDueDate,
      title: 'Fixed payment',
      status: deriveParticipantCommercialLifecycle(participant) === 'PAID' ? 'complete' : 'pending',
    });
  }

  if (extracted?.settlementEvents?.length && items.length === 0) {
    const siblingCount = extracted.settlementEvents.length;
    for (const [i, event] of extracted.settlementEvents.entries()) {
      items.push({
        id: `settlement-${i}`,
        dateLabel: event.trigger ?? 'Per agreement',
        title: event.type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        status: 'pending',
        detail:
          formatDisplayableExtractedAmount(
            event.amount,
            siblingCount,
            event.trigger,
            null,
            currency
          ) ??
          (event.percentage != null ? `${event.percentage}%` : undefined),
      });
    }
  }

  if (items.length === 0 && participant.payoutCondition?.trim()) {
    const title = sanitizeParticipantFacingCommercialText(participant.payoutCondition);
    if (title) {
      items.push({
        id: 'payout-condition',
        dateLabel: 'TBC',
        title,
        status: 'waiting',
        detail: 'Payment timing will become available once the organiser finalises settlement.',
      });
    }
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
  const schedule = currentAgreementScheduleFromParticipant(participant, deal);
  const { currentDeal } = partitionPortalObligations(context.obligations, deal.id);
  const thisAgreementPayout = schedule?.equalMilestoneAmount ?? schedule?.items[0]?.amount ?? null;
  const thisAgreementTotal = schedule?.totalAmount ?? (deal.value > 0 ? deal.value : null);
  const scopedToSchedule = schedule != null;
  const performance = deriveParticipantCommercialPerformance(
    participant,
    context.obligations,
    context.attributionActivity,
    context.attributionActivity?.currency ?? currency,
    scopedToSchedule
      ? {
          currentAgreementObligations: currentDeal,
          currentAgreementPayout: thisAgreementPayout,
        }
      : undefined
  );
  const settlement = deriveParticipantSettlementExplanation(
    participant,
    context.obligations,
    scopedToSchedule ? { currentAgreementObligations: currentDeal } : undefined
  );
  const commercialState = deriveParticipantCommercialState(participant);
  const workflowStatus = deriveParticipantWorkflowBadges(participant);
  const relationship = deriveParticipantRelationshipEarnings(
    context.obligations,
    deal.id,
    thisAgreementPayout,
    context.attributionActivity?.currency ?? currency
  );

  return {
    participantName: participant.name?.trim() || 'Participant',
    participantRole: resolveParticipantFacingRole(participant),
    participantSubtitle: 'Commercial Participant',
    projectName: resolveParticipantAgreementTitle(deal, participant),
    contractingParty: resolveParticipantContractingParty(deal, participant),
    agreementStatus: agreementMeta.status,
    agreementStatusLabel: agreementMeta.label,
    lifecycleSteps: deriveParticipantCommercialLifecycleSteps(participant, agreement),
    commercialSections: deriveCommercialSections(participant, currency, deal),
    agreement,
    performance,
    relationshipEarnings: {
      totalLabel: relationship.totalLabel,
      thisAgreementLabel: relationship.thisAgreementLabel,
      previousActivityLabel: relationship.previousActivityLabel,
    },
    currentAgreementPayoutLabel:
      thisAgreementPayout != null
        ? formatCurrency(thisAgreementPayout, context.attributionActivity?.currency ?? currency)
        : null,
    currentAgreementTotalLabel:
      thisAgreementTotal != null
        ? formatCurrency(thisAgreementTotal, context.attributionActivity?.currency ?? currency)
        : null,
    settlement,
    paymentTimeline: derivePaymentTimeline(participant, deal, currency, context),
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
