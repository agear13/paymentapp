import type { ExtractionResult, ExtractionConfidence } from '@/lib/ai-extractor/extraction-types';
import type { OnboardingDraftParticipant } from '@/components/onboarding/onboarding-participant-card';
import type { OnboardingTemplateId, OnboardingUseCaseId } from '@/lib/onboarding/operator-onboarding-types';
import { ONBOARDING_AGREEMENT_TEMPLATES } from '@/lib/onboarding/operator-onboarding-types';
import type {
  ParticipantCommercialCard,
  UnifiedSettlementScheduleEntry,
} from '@/lib/ai-extractor/commercial-graph-types';
import {
  mapExtractionToObligationSnapshot,
  primaryServiceCategoryLabel,
  type PersistedDeliverable,
} from '@/lib/ai-extractor/extraction-obligations';
import { serviceCategoryDisplayLabel } from '@/lib/ai-extractor/service-category';
import {
  computeProfileReadinessScore,
  derivePotentialGapsFromProfiles,
} from '@/lib/onboarding/participant-profile-readiness';
import {
  buildDisplayCommercialTerms,
  hasCustomisedParticipantNames,
} from '@/lib/onboarding/template-draft-state';

export type AgreementType =
  | 'Revenue Share Agreement'
  | 'Referral Agreement'
  | 'Affiliate Arrangement'
  | 'Contractor Engagement'
  | 'Event Settlement Agreement'
  | 'Client Invoice Workflow'
  | 'Commercial Agreement'
  | 'Multi-Party Event Coordination Agreement'
  | 'Event Revenue Share Agreement'
  | 'Fixed Fee Service Agreement'
  | 'Customer Attribution Agreement'
  | 'Collaboration Agreement';

export type AgreementCreationSource = 'import' | 'manual' | 'template' | 'explore';

export type AgreementIntelligenceInsight = {
  agreementName: string;
  agreementType: AgreementType;
  agreementTypeConfidence: number;
  participantsFound: { name: string; role?: string }[];
  commercialTermsFound: string[];
  obligationsIdentified: string[];
  potentialGaps: string[];
  readinessScore: number;
  readinessExplanation: string;
  usedExtraction: boolean;
  creationSource: AgreementCreationSource;
  /** v4 extracted service categories (deal-level). */
  serviceCategoriesFound?: string[];
  /** v4 extracted deliverables grouped by participant. */
  deliverablesFound?: { participant: string; items: string[] }[];
  /** v5 — coordinating commercial party. */
  agreementOwner?: string | null;
  agreementOwnerResponsibilities?: string[];
  /** v5 — narrative commercial summary from structured data. */
  commercialSummary?: string;
  /** v5 — executive commercial structure bullets. */
  commercialStructureOverview?: string[];
  /** v5 — commercial dashboard metrics. */
  commercialStructure?: {
    participantCount: number;
    deliverableCount: number;
    operationalObligationCount: number;
    compensationTermCount: number;
    settlementEventCount: number;
    revenueShareAgreementCount: number;
    fixedPaymentAgreementCount: number;
    hybridCompensationCount: number;
    milestonePaymentCount: number;
    instalmentPaymentCount: number;
    conditionalPaymentCount: number;
    estimatedFixedCommitment: number;
    variableRevenueBases: string[];
  };
  /** v5 — operational work obligations only (not compensation). */
  operationalObligations?: { participant: string; items: string[] }[];
  /** v5 — compensation terms separated from operational obligations. */
  compensationTermsFound?: { participant: string; items: string[] }[];
  /** v5 — unified settlement schedule (replaces duplicated settlement sections). */
  settlementSchedule?: UnifiedSettlementScheduleEntry[];
  /** v5 — rich participant summary cards. */
  participantCards?: ParticipantCommercialCard[];
  /** v5 — settlement blockers for executive summary. */
  settlementBlockers?: string[];
  /** Template workflow — values are editable defaults, not extracted data. */
  isTemplateDraft?: boolean;
  templateId?: OnboardingTemplateId;
  templateTitle?: string;
  /** True when participant names or commercial terms were customised from template defaults. */
  isCustomisedDraft?: boolean;
  /** Current commercial term values (without display prefix). */
  customizedCommercialTerms?: string[];
};

const CONFIDENCE_TO_SCORE: Record<ExtractionConfidence, number> = {
  high: 94,
  medium: 82,
  low: 68,
  absent: 55,
};

const USE_CASE_TO_AGREEMENT_TYPE: Record<OnboardingUseCaseId, AgreementType> = {
  revenue_sharing: 'Revenue Share Agreement',
  referral_commissions: 'Referral Agreement',
  affiliate_payouts: 'Affiliate Arrangement',
  contractor_payouts: 'Contractor Engagement',
  event_settlement: 'Event Settlement Agreement',
  client_invoices: 'Client Invoice Workflow',
};

function inferAgreementType(
  participants: OnboardingDraftParticipant[],
  terms: string[],
  useCaseId?: OnboardingUseCaseId
): AgreementType {
  if (useCaseId) return USE_CASE_TO_AGREEMENT_TYPE[useCaseId];

  const roles = new Set(participants.map((p) => p.role));
  if (roles.has('Referrer')) return 'Referral Agreement';
  if (roles.has('Affiliate')) return 'Affiliate Arrangement';
  if (roles.has('Contractor') || roles.has('Supplier')) return 'Contractor Engagement';
  if (roles.has('Promoter') || roles.has('Venue')) return 'Event Settlement Agreement';
  if (terms.some((t) => t.toLowerCase().includes('invoice'))) return 'Client Invoice Workflow';
  if (terms.some((t) => t.toLowerCase().includes('revenue share'))) return 'Revenue Share Agreement';
  return 'Commercial Agreement';
}

function deriveCommercialTermsFromParticipants(
  participants: OnboardingDraftParticipant[]
): string[] {
  const terms: string[] = [];
  const roles = new Set(participants.map((p) => p.role));

  if (roles.has('Referrer') || roles.has('Affiliate')) {
    terms.push('Referral Commission');
  }
  if (roles.has('Partner') || roles.has('Promoter') || roles.has('Co-founder')) {
    terms.push('Revenue Share');
  }
  if (roles.has('Contractor') || roles.has('Supplier') || roles.has('Performer')) {
    terms.push('Contractor Fee', 'Fixed Payout');
  }
  if (roles.has('Venue')) {
    terms.push('Customer Attribution');
  }

  if (participants.some((p) => p.role === 'Referrer' || p.role === 'Affiliate')) {
    terms.push('10% Revenue Share');
  } else if (participants.some((p) => p.role === 'Partner' || p.role === 'Promoter')) {
    terms.push('15% Revenue Share');
  }

  return [...new Set(terms)];
}

function deriveObligations(terms: string[], description?: string): string[] {
  const obligations: string[] = [];
  const desc = description?.toLowerCase() ?? '';
  const termText = terms.join(' ').toLowerCase();

  if (termText.includes('monthly') || desc.includes('monthly')) {
    obligations.push('Revenue must be calculated monthly');
  }
  if (termText.includes('10 day') || desc.includes('10 day')) {
    obligations.push('Settlement due within 10 days');
  }
  if (termText.includes('approval') || desc.includes('approval')) {
    obligations.push('Approval required before release');
  }
  if (obligations.length === 0 && terms.length > 0) {
    obligations.push('Commercial obligations tracked for settlement coordination');
  }
  return obligations;
}

function deriveOperationalObligationsFromExtraction(
  participants: OnboardingDraftParticipant[]
): string[] {
  const obligations: string[] = [];

  for (const participant of participants) {
    const graph = participant.extractedObligations;
    if (!graph) continue;

    const operational =
      graph.operationalObligations?.length
        ? graph.operationalObligations
        : graph.deliverables;

    for (const item of operational) {
      const description = 'description' in item ? item.description : String(item);
      if (description.trim()) {
        obligations.push(`${participant.name}: ${description.trim()}`);
      }
    }
  }

  return [...new Set(obligations)];
}

function deriveCompensationTermsFromParticipants(
  participants: OnboardingDraftParticipant[]
): { participant: string; items: string[] }[] {
  return participants
    .map((participant) => {
      const graph = participant.extractedObligations;
      if (!graph) return { participant: participant.name, items: [] as string[] };

      const items: string[] = [];

      if (graph.compensationTerms?.length) {
        items.push(...graph.compensationTerms.map((t) => t.label).filter(Boolean));
      } else {
        for (const fixed of graph.fixedObligations) {
          if (fixed.amount != null) items.push(`Fixed fee $${fixed.amount}`);
        }
        for (const share of graph.revenueShareObligations) {
          if (share.percentage != null) items.push(`${share.percentage}% revenue share`);
        }
        for (const conditional of graph.conditionalPayments) {
          const amountLabel =
            conditional.amount != null ? `$${conditional.amount}` : 'conditional amount';
          items.push(`Conditional payment ${amountLabel} when ${conditional.trigger}`);
        }
      }

      return { participant: participant.name, items: [...new Set(items)] };
    })
    .filter((entry) => entry.items.length > 0);
}

function deriveCommercialTermsOverviewFromExtraction(
  result: ExtractionResult
): string[] {
  if (result.commercialGraph?.commercialStructureOverview.bulletPoints.length) {
    return result.commercialGraph.commercialStructureOverview.bulletPoints;
  }

  const graph = result.commercialGraph?.commercialStructure;
  if (!graph) return [];

  return [
    `${graph.participantCount} commercial participants`,
    graph.hybridCompensationCount > 0
      ? `${graph.hybridCompensationCount} hybrid compensation arrangements`
      : null,
    graph.milestonePaymentCount > 0
      ? `${graph.milestonePaymentCount} milestone payment arrangements`
      : null,
    graph.revenueShareAgreementCount > 0
      ? `${graph.revenueShareAgreementCount} revenue share agreements`
      : null,
    graph.conditionalPaymentCount > 0
      ? `${graph.conditionalPaymentCount} conditional bonus${graph.conditionalPaymentCount === 1 ? '' : 'es'}`
      : null,
    graph.estimatedFixedCommitment > 0
      ? `Estimated committed fixed spend: $${graph.estimatedFixedCommitment.toLocaleString('en-AU', { maximumFractionDigits: 0 })}`
      : null,
    graph.variableRevenueBases.length > 0
      ? `Additional variable obligations tied to ${graph.variableRevenueBases.join(', ')}`
      : null,
  ].filter(Boolean) as string[];
}

function deriveDeliverablesFound(
  participants: OnboardingDraftParticipant[]
): { participant: string; items: string[] }[] {
  return participants
    .map((participant) => ({
      participant: participant.name,
      items: (participant.extractedObligations?.deliverables ?? [])
        .map((d: PersistedDeliverable) => d.description.trim())
        .filter(Boolean),
    }))
    .filter((entry) => entry.items.length > 0);
}

function deriveServiceCategoriesFound(participants: OnboardingDraftParticipant[]): string[] {
  const categories = new Set<string>();
  for (const participant of participants) {
    for (const category of participant.extractedObligations?.serviceCategories ?? []) {
      categories.add(serviceCategoryDisplayLabel(category));
    }
  }
  return [...categories];
}

function derivePotentialGaps(
  participants: OnboardingDraftParticipant[],
  readinessBlockers?: string[],
  options?: { isTemplateDraft?: boolean }
): string[] {
  const gaps = derivePotentialGapsFromProfiles(participants);
  if (readinessBlockers?.length) {
    for (const blocker of readinessBlockers) {
      if (!gaps.includes(blocker)) gaps.push(blocker);
    }
  }
  if (options?.isTemplateDraft && gaps.length === 0) {
    gaps.push('Review agreement defaults before continuing');
  }
  return gaps;
}

function confirmedTemplateReadinessExplanation(score: number): string {
  if (score >= 75) {
    return 'Looking good — confirm payout details before continuing.';
  }
  return 'Add participant contact or settlement details to improve readiness.';
}

function templateReadinessExplanation(score: number, isTemplateDraft: boolean): string {
  if (isTemplateDraft) {
    if (score >= 75) {
      return 'Almost there — add settlement details for each participant.';
    }
    if (score >= 60) {
      return 'Keep going — add participant names, contact details, and how they will be paid.';
    }
    return 'This template is a starting point. Customise participants and settlement details as you go.';
  }
  return readinessExplanation(score);
}

function readinessExplanation(score: number, extractedSummary?: string): string {
  if (extractedSummary?.trim()) {
    return extractedSummary;
  }
  if (score >= 90) {
    return 'This agreement is almost ready for coordination and settlement.';
  }
  if (score >= 75) {
    return 'Core commercial terms are clear. A few details may be needed before settlement.';
  }
  if (score >= 60) {
    return 'Provvypay identified the agreement structure. Additional configuration will improve readiness.';
  }
  return 'Agreement structure detected. Complete participant and settlement details to proceed.';
}

function computeReadinessScore(input: {
  participants: OnboardingDraftParticipant[];
  agreementName: string;
  terms: string[];
  obligations: string[];
  typeConfidence: number;
  usedExtraction: boolean;
  extractedScore?: number;
}): number {
  return computeProfileReadinessScore({
    participants: input.participants,
    typeConfidence: input.typeConfidence,
    termsCount: input.terms.length,
    obligationsCount: input.obligations.length,
    usedExtraction: input.usedExtraction,
    extractedScore: input.extractedScore,
  });
}

function finalizeInsight(
  partial: Omit<AgreementIntelligenceInsight, 'readinessScore' | 'readinessExplanation'>,
  participants: OnboardingDraftParticipant[],
  description?: string,
  extractedReadiness?: { score?: number; summary?: string; blockers?: string[] }
): AgreementIntelligenceInsight {
  const obligations =
    partial.obligationsIdentified.length > 0
      ? partial.obligationsIdentified
      : deriveObligations(partial.commercialTermsFound, description);
  const readinessScore = computeReadinessScore({
    participants,
    agreementName: partial.agreementName,
    terms: partial.commercialTermsFound,
    obligations,
    typeConfidence: partial.agreementTypeConfidence,
    usedExtraction: partial.usedExtraction,
    extractedScore: extractedReadiness?.score,
  });

  const isTemplateDraft = partial.isTemplateDraft ?? false;
  const explanation = extractedReadiness?.summary
    ? extractedReadiness.summary
    : partial.creationSource === 'template' && !isTemplateDraft
      ? confirmedTemplateReadinessExplanation(readinessScore)
      : templateReadinessExplanation(readinessScore, isTemplateDraft);

  return {
    ...partial,
    obligationsIdentified: obligations,
    potentialGaps:
      partial.potentialGaps.length > 0
        ? partial.potentialGaps
        : derivePotentialGaps(participants, extractedReadiness?.blockers, { isTemplateDraft }),
    readinessScore,
    readinessExplanation: explanation,
  };
}

function participantRoleFromDraft(participant: OnboardingDraftParticipant): string | undefined {
  const categoryLabel = primaryServiceCategoryLabel(
    participant.extractedObligations?.serviceCategories ?? []
  );
  if (categoryLabel) {
    return categoryLabel.charAt(0).toUpperCase() + categoryLabel.slice(1);
  }
  return participant.role;
}

export function buildInsightsFromExtraction(
  result: ExtractionResult,
  participants: OnboardingDraftParticipant[]
): AgreementIntelligenceInsight {
  const agreementName =
    result.projectName.value?.trim() ||
    result.counterparty.value?.trim() ||
    'Imported Agreement';

  const snapshot = mapExtractionToObligationSnapshot(result);
  const commercialTermsFound = deriveCommercialTermsOverviewFromExtraction(result);
  const obligationsIdentified = deriveOperationalObligationsFromExtraction(participants);
  const compensationTermsFound = deriveCompensationTermsFromParticipants(participants);
  const commercialGraph = result.commercialGraph;
  const agreementType =
    (snapshot.agreementTypeLabel as AgreementType) ||
    inferAgreementType(participants, commercialTermsFound);
  const typeConfidence = CONFIDENCE_TO_SCORE[result.overallConfidence];
  const readiness = snapshot.readinessAssessment;

  return finalizeInsight(
    {
      agreementName,
      agreementType,
      agreementTypeConfidence: typeConfidence,
      participantsFound: participants.map((participant) => ({
        name: participant.name,
        role: participantRoleFromDraft(participant),
      })),
      commercialTermsFound,
      obligationsIdentified,
      potentialGaps: derivePotentialGaps(participants, readiness?.settlementBlockers),
      usedExtraction: true,
      creationSource: 'import',
      serviceCategoriesFound: deriveServiceCategoriesFound(participants),
      deliverablesFound: deriveDeliverablesFound(participants),
      agreementOwner: commercialGraph?.agreementOwner ?? snapshot.agreementOwner,
      agreementOwnerResponsibilities: commercialGraph?.agreementOwnerResponsibilities,
      commercialSummary: commercialGraph?.commercialSummary,
      commercialStructureOverview: commercialGraph?.commercialStructureOverview.bulletPoints,
      commercialStructure: commercialGraph?.commercialStructure
        ? {
            participantCount: commercialGraph.commercialStructure.participantCount,
            deliverableCount: commercialGraph.commercialStructure.deliverableCount,
            operationalObligationCount: commercialGraph.commercialStructure.operationalObligationCount,
            compensationTermCount: commercialGraph.commercialStructure.compensationTermCount,
            settlementEventCount: commercialGraph.commercialStructure.settlementEventCount,
            revenueShareAgreementCount: commercialGraph.commercialStructure.revenueShareAgreementCount,
            fixedPaymentAgreementCount: commercialGraph.commercialStructure.fixedPaymentAgreementCount,
            hybridCompensationCount: commercialGraph.commercialStructure.hybridCompensationCount,
            milestonePaymentCount: commercialGraph.commercialStructure.milestonePaymentCount,
            instalmentPaymentCount: commercialGraph.commercialStructure.instalmentPaymentCount,
            conditionalPaymentCount: commercialGraph.commercialStructure.conditionalPaymentCount,
            estimatedFixedCommitment: commercialGraph.commercialStructure.estimatedFixedCommitment,
            variableRevenueBases: commercialGraph.commercialStructure.variableRevenueBases,
          }
        : undefined,
      operationalObligations: commercialGraph?.operationalObligations,
      compensationTermsFound,
      settlementSchedule: commercialGraph?.settlementSchedule,
      participantCards: commercialGraph?.participantCards,
      settlementBlockers: readiness?.settlementBlockers,
    },
    participants,
    result.projectDescription.value ?? undefined,
    readiness
      ? {
          score: readiness.score,
          summary: readiness.summary,
          blockers: readiness.settlementBlockers,
        }
      : undefined
  );
}

export function buildInsightsFromManual(input: {
  agreementName: string;
  participants: OnboardingDraftParticipant[];
  description?: string;
  creationSource?: AgreementCreationSource;
  useCaseId?: OnboardingUseCaseId;
}): AgreementIntelligenceInsight {
  const terms = deriveCommercialTermsFromParticipants(input.participants);
  if (input.description?.toLowerCase().includes('monthly')) {
    terms.push('Monthly Settlement');
  }
  if (input.description?.toLowerCase().includes('10 day')) {
    terms.push('Settlement Within 10 Days');
  }
  if (input.description?.toLowerCase().includes('approval')) {
    terms.push('Approval Required Before Release');
  }

  const commercialTermsFound = [...new Set(terms)];
  const agreementType = inferAgreementType(
    input.participants,
    commercialTermsFound,
    input.useCaseId
  );

  return finalizeInsight(
    {
      agreementName: input.agreementName.trim() || 'New Agreement',
      agreementType,
      agreementTypeConfidence: 88,
      participantsFound: input.participants.map((p) => ({
        name: p.name,
        role: participantRoleFromDraft(p),
      })),
      commercialTermsFound,
      obligationsIdentified: deriveObligations(commercialTermsFound, input.description),
      potentialGaps: derivePotentialGaps(input.participants),
      usedExtraction: false,
      creationSource: input.creationSource ?? 'manual',
    },
    input.participants,
    input.description
  );
}

function formatTemplateObligation(item: string, isUntouchedDefault: boolean): string {
  if (isUntouchedDefault) {
    return item.startsWith('Default:') ? item : `Default: ${item}`;
  }
  return item.replace(/^Default:\s*/i, '');
}

export function buildInsightsFromTemplate(
  templateId: OnboardingTemplateId,
  participants: OnboardingDraftParticipant[],
  options?: {
    confirmed?: boolean;
    commercialTerms?: string[];
    originalCommercialTerms?: string[];
  }
): AgreementIntelligenceInsight {
  const confirmed = options?.confirmed ?? false;
  const template = ONBOARDING_AGREEMENT_TEMPLATES.find((t) => t.id === templateId);
  const originals = options?.originalCommercialTerms ?? template?.commercialTerms ?? [];
  const currents = options?.commercialTerms ?? originals;
  const commercialTermsFound = buildDisplayCommercialTerms(originals, currents);
  const agreementType = inferAgreementType(participants, commercialTermsFound, template?.useCaseId);

  const termsCustomised = originals.some(
    (original, index) => (currents[index] ?? original).trim() !== original.trim()
  );
  const isCustomisedDraft =
    hasCustomisedParticipantNames(participants) || termsCustomised;

  const obligationInputs = commercialTermsFound.map((term) =>
    term.replace(/^Default:\s*/i, '')
  );
  const defaultObligations = deriveObligations(obligationInputs, template?.description).map(
    (item) => formatTemplateObligation(item, !isCustomisedDraft && !confirmed)
  );

  const agreementName = isCustomisedDraft
    ? template?.agreementName ?? 'Template Agreement'
    : template?.agreementName ?? 'Template Agreement';

  return finalizeInsight(
    {
      agreementName,
      agreementType,
      agreementTypeConfidence: confirmed ? 82 : 72,
      participantsFound: participants.map((p) => ({
        name: p.name,
        role: participantRoleFromDraft(p),
      })),
      commercialTermsFound,
      obligationsIdentified: defaultObligations,
      potentialGaps: [],
      usedExtraction: false,
      creationSource: 'template',
      isTemplateDraft: !confirmed,
      isCustomisedDraft,
      customizedCommercialTerms: [...currents],
      templateId,
      templateTitle: template?.title ?? 'Agreement Template',
    },
    participants,
    template?.description
  );
}

export function rebuildInsightFromParticipants(
  current: AgreementIntelligenceInsight,
  participants: OnboardingDraftParticipant[],
  description?: string
): AgreementIntelligenceInsight {
  if (current.creationSource === 'explore') {
    return {
      ...current,
      participantsFound: participants.map((p) => ({
        name: p.name,
        role: participantRoleFromDraft(p),
      })),
    };
  }

  switch (current.creationSource) {
    case 'import':
      return buildInsightsFromManual({
        agreementName: current.agreementName,
        participants,
        description,
        creationSource: 'import',
      });
    case 'template': {
      const template = ONBOARDING_AGREEMENT_TEMPLATES.find((t) => t.id === current.templateId);
      return buildInsightsFromTemplate(
        current.templateId ?? 'revenue_share',
        participants,
        {
          confirmed: !current.isTemplateDraft,
          commercialTerms: current.customizedCommercialTerms ?? [...(template?.commercialTerms ?? [])],
          originalCommercialTerms: [...(template?.commercialTerms ?? [])],
        }
      );
    }
    default:
      return buildInsightsFromManual({
        agreementName: current.agreementName,
        participants,
        description,
        creationSource: current.creationSource,
      });
  }
}
