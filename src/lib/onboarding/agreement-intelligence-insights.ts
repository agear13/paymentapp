import type { ExtractionResult, ExtractionConfidence } from '@/lib/ai-extractor/extraction-types';
import type { OnboardingDraftParticipant } from '@/components/onboarding/onboarding-participant-card';
import type { OnboardingTemplateId, OnboardingUseCaseId } from '@/lib/onboarding/operator-onboarding-types';
import { ONBOARDING_AGREEMENT_TEMPLATES } from '@/lib/onboarding/operator-onboarding-types';

export type AgreementType =
  | 'Revenue Share Agreement'
  | 'Referral Agreement'
  | 'Affiliate Arrangement'
  | 'Contractor Engagement'
  | 'Event Settlement Agreement'
  | 'Client Invoice Workflow'
  | 'Commercial Agreement';

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

  if (terms.length > 0) {
    terms.push('Net Sales Basis', 'Monthly Settlement', 'Settlement Within 10 Days');
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
  if (termText.includes('net sales') || termText.includes('revenue share')) {
    obligations.push('Revenue share calculated after processing fees');
  }
  if (termText.includes('approval') || desc.includes('approval')) {
    obligations.push('Approval required before release');
  }
  if (termText.includes('fixed') || termText.includes('contractor')) {
    obligations.push('Settlement triggered on deliverable completion');
  }
  if (obligations.length === 0 && terms.length > 0) {
    obligations.push('Commercial obligations tracked for settlement coordination');
  }
  return obligations;
}

function derivePotentialGaps(participants: OnboardingDraftParticipant[]): string[] {
  const gaps: string[] = [];
  if (participants.some((p) => !p.email?.trim())) {
    gaps.push('Participant email missing');
  }
  gaps.push('Settlement account not configured', 'Tax information missing', 'Payment infrastructure not connected');
  return gaps;
}

function readinessExplanation(score: number): string {
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
}): number {
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
  description?: string
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
  });

  return {
    ...partial,
    obligationsIdentified: obligations,
    potentialGaps:
      partial.potentialGaps.length > 0 ? partial.potentialGaps : derivePotentialGaps(participants),
    readinessScore,
    readinessExplanation: readinessExplanation(readinessScore),
  };
}

export function buildInsightsFromExtraction(
  result: ExtractionResult,
  participants: OnboardingDraftParticipant[]
): AgreementIntelligenceInsight {
  const agreementName =
    result.projectName.value?.trim() ||
    result.counterparty.value?.trim() ||
    'Imported Agreement';

  const terms: string[] = [];
  for (const party of result.parties) {
    if (party.participationModel.value === 'revenue_share' && party.revenueSharePct.value != null) {
      terms.push(`${party.revenueSharePct.value}% Revenue Share`, 'Revenue Share');
    }
    if (party.participationModel.value === 'fixed_payout' && party.fixedAmount.value != null) {
      terms.push('Contractor Fee', 'Fixed Payout');
    }
    if (party.participationModel.value === 'customer_attribution') {
      terms.push('Customer Attribution');
    }
  }
  if (result.paymentTerms.length > 0) {
    terms.push('Settlement Terms Identified');
  }
  if (terms.length === 0) {
    terms.push(...deriveCommercialTermsFromParticipants(participants));
  } else {
    terms.push('Net Sales Basis', 'Monthly Settlement');
  }

  const commercialTermsFound = [...new Set(terms)];
  const agreementType = inferAgreementType(participants, commercialTermsFound);
  const typeConfidence = CONFIDENCE_TO_SCORE[result.overallConfidence];

  return finalizeInsight(
    {
      agreementName,
      agreementType,
      agreementTypeConfidence: typeConfidence,
      participantsFound: participants.map((p) => ({ name: p.name, role: p.role })),
      commercialTermsFound,
      obligationsIdentified: deriveObligations(commercialTermsFound, result.projectDescription.value ?? undefined),
      potentialGaps: derivePotentialGaps(participants),
      usedExtraction: true,
      creationSource: 'import',
    },
    participants,
    result.projectDescription.value ?? undefined
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
      participantsFound: input.participants.map((p) => ({ name: p.name, role: p.role })),
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
      participantsFound: participants.map((p) => ({ name: p.name, role: p.role })),
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
    return { ...current, participantsFound: participants.map((p) => ({ name: p.name, role: p.role })) };
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
