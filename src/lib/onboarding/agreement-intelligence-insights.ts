import type { ExtractionResult, ExtractionConfidence } from '@/lib/ai-extractor/extraction-types';
import type { OnboardingDraftParticipant } from '@/components/onboarding/onboarding-participant-card';
import type { OnboardingTemplateId, OnboardingUseCaseId } from '@/lib/onboarding/operator-onboarding-types';
import { ONBOARDING_AGREEMENT_TEMPLATES } from '@/lib/onboarding/operator-onboarding-types';
import {
  formatSettlementRuleLabel,
  mapExtractionToObligationSnapshot,
  primaryServiceCategoryLabel,
  type PersistedDeliverable,
} from '@/lib/ai-extractor/extraction-obligations';
import { isHallucinatedSettlementTrigger } from '@/lib/ai-extractor/parse-settlement-rules';
import { serviceCategoryDisplayLabel } from '@/lib/ai-extractor/service-category';

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

const HALLUCINATED_COMMERCIAL_TERMS = [
  'net sales basis',
  'monthly settlement',
  'settlement within 10 days',
];

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

function deriveObligationsFromExtraction(
  result: ExtractionResult,
  participants: OnboardingDraftParticipant[]
): string[] {
  const obligations: string[] = [];
  const snapshot = mapExtractionToObligationSnapshot(result);

  for (const participant of participants) {
    const graph = participant.extractedObligations;
    if (!graph) continue;

    for (const deliverable of graph.deliverables) {
      if (deliverable.description.trim()) {
        obligations.push(`${participant.name}: ${deliverable.description}`);
      }
    }

    for (const fixed of graph.fixedObligations) {
      if (fixed.amount != null) {
        obligations.push(`${participant.name}: fixed fee ${fixed.amount}`);
      }
    }

    for (const share of graph.revenueShareObligations) {
      if (share.percentage != null) {
        obligations.push(`${participant.name}: ${share.percentage}% revenue share`);
      }
    }

    for (const conditional of graph.conditionalPayments) {
      const amountLabel =
        conditional.amount != null ? `$${conditional.amount}` : 'conditional amount';
      obligations.push(
        `${participant.name}: conditional payment ${amountLabel} when ${conditional.trigger}`
      );
    }
  }

  for (const rule of snapshot.settlementRules) {
    obligations.push(`Settlement rule: ${formatSettlementRuleLabel(rule)}`);
  }

  for (const term of result.paymentTerms) {
    const description = term.description.value?.trim();
    const due = term.dueCondition.value?.trim();
    if (description) {
      obligations.push(`Payment term: ${description}`);
    }
    if (due && !isHallucinatedSettlementTrigger(due)) {
      obligations.push(`Settlement trigger: ${due}`);
    }
  }

  return [...new Set(obligations)];
}

function deriveCommercialTermsFromExtraction(
  result: ExtractionResult,
  participants: OnboardingDraftParticipant[]
): string[] {
  const terms: string[] = [];
  const snapshot = mapExtractionToObligationSnapshot(result);

  for (const participant of participants) {
    const graph = participant.extractedObligations;
    if (!graph) continue;

    for (const share of graph.revenueShareObligations) {
      if (share.percentage != null) {
        terms.push(`${share.percentage}% Revenue Share`);
      }
    }

    for (const fixed of graph.fixedObligations) {
      if (fixed.amount != null) {
        terms.push(`Fixed Payout ${fixed.amount}`);
      }
    }

    for (const conditional of graph.conditionalPayments) {
      const amountLabel =
        conditional.amount != null ? `$${conditional.amount}` : 'conditional amount';
      terms.push(`Conditional Payment: ${amountLabel} when ${conditional.trigger}`);
    }

    if (graph.settlementEvents.some((event) => event.type === 'attribution')) {
      terms.push('Customer Attribution');
    }
  }

  for (const rule of snapshot.settlementRules) {
    terms.push(formatSettlementRuleLabel(rule));
  }

  for (const term of result.paymentTerms) {
    const description = term.description.value?.trim();
    if (description) {
      terms.push(description);
    }
  }

  return [...new Set(terms)].filter(
    (term) => !HALLUCINATED_COMMERCIAL_TERMS.some((blocked) => term.toLowerCase().includes(blocked))
  );
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
  readinessBlockers?: string[]
): string[] {
  const gaps: string[] = [];
  if (participants.some((p) => !p.email?.trim())) {
    gaps.push('Participant email missing');
  }
  gaps.push('Settlement account not configured', 'Tax information missing', 'Payment infrastructure not connected');
  if (readinessBlockers?.length) {
    for (const blocker of readinessBlockers) {
      if (!gaps.includes(blocker)) gaps.push(blocker);
    }
  }
  return gaps;
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
  if (input.extractedScore != null) {
    return Math.max(0, Math.min(100, Math.round(input.extractedScore)));
  }

  let score = input.typeConfidence;
  if (!input.agreementName.trim()) score -= 8;
  if (input.participants.length === 0) score -= 22;
  else if (input.participants.length >= 2) score += 2;
  if (input.participants.every((p) => p.email?.trim())) score += 4;
  else score -= 4;
  if (input.obligations.length >= 3) score += 3;
  if (input.terms.length >= 4) score += 2;
  if (input.usedExtraction) score += 2;
  return Math.max(45, Math.min(98, Math.round(score)));
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

  return {
    ...partial,
    obligationsIdentified: obligations,
    potentialGaps:
      partial.potentialGaps.length > 0
        ? partial.potentialGaps
        : derivePotentialGaps(participants, extractedReadiness?.blockers),
    readinessScore,
    readinessExplanation: readinessExplanation(readinessScore, extractedReadiness?.summary),
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
  const commercialTermsFound = deriveCommercialTermsFromExtraction(result, participants);
  const obligationsIdentified = deriveObligationsFromExtraction(result, participants);
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

export function buildInsightsFromTemplate(
  templateId: OnboardingTemplateId,
  participants: OnboardingDraftParticipant[]
): AgreementIntelligenceInsight {
  const template = ONBOARDING_AGREEMENT_TEMPLATES.find((t) => t.id === templateId);
  const commercialTermsFound = [...(template?.commercialTerms ?? [])];
  const agreementType = inferAgreementType(participants, commercialTermsFound, template?.useCaseId);

  return finalizeInsight(
    {
      agreementName: template?.agreementName ?? 'Template Agreement',
      agreementType,
      agreementTypeConfidence: 92,
      participantsFound: participants.map((p) => ({
        name: p.name,
        role: participantRoleFromDraft(p),
      })),
      commercialTermsFound,
      obligationsIdentified: deriveObligations(commercialTermsFound, template?.description),
      potentialGaps: derivePotentialGaps(participants),
      usedExtraction: false,
      creationSource: 'template',
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
    case 'template':
      return buildInsightsFromManual({
        agreementName: current.agreementName,
        participants,
        description,
        creationSource: 'template',
        useCaseId: undefined,
      });
    default:
      return buildInsightsFromManual({
        agreementName: current.agreementName,
        participants,
        description,
        creationSource: current.creationSource,
      });
  }
}
