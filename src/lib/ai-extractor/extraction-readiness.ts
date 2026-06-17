import type { ExtractedParty, ExtractionResult } from './extraction-types';
import { deliverableDescriptions } from './parse-deliverables';
import { hasFixedFeeAmount, hasRevenueSharePct } from './party-obligation-metrics';
import type { ServiceCategory } from './service-category';

export const READINESS_DIMENSIONS = [
  'identity',
  'commercialTerms',
  'deliverables',
  'settlementLogic',
  'paymentInfrastructure',
  'taxInformation',
  'compliance',
] as const;

export type ReadinessDimension = (typeof READINESS_DIMENSIONS)[number];

export interface ReadinessDimensionScore {
  dimension: ReadinessDimension;
  label: string;
  score: number;
  weight: number;
  blockers: string[];
}

export interface ExtractionReadinessAssessment {
  score: number;
  dimensions: ReadinessDimensionScore[];
  settlementBlockers: string[];
  summary: string;
}

const DIMENSION_CONFIG: Array<{
  dimension: ReadinessDimension;
  label: string;
  weight: number;
}> = [
  { dimension: 'identity', label: 'Identity', weight: 0.2 },
  { dimension: 'commercialTerms', label: 'Commercial Terms', weight: 0.2 },
  { dimension: 'deliverables', label: 'Operational Obligations', weight: 0.15 },
  { dimension: 'settlementLogic', label: 'Settlement Logic', weight: 0.15 },
  { dimension: 'paymentInfrastructure', label: 'Payment Infrastructure', weight: 0.15 },
  { dimension: 'taxInformation', label: 'Tax Information', weight: 0.1 },
  { dimension: 'compliance', label: 'Compliance', weight: 0.05 },
];

const HALLUCINATED_SETTLEMENT_PATTERNS = [
  /monthly settlement/i,
  /net sales/i,
  /processing fees?/i,
  /after fees/i,
  /deliverable completion/i,
  /on completion$/i,
];

function scoreIdentity(parties: ExtractedParty[]): { score: number; blockers: string[] } {
  if (parties.length === 0) {
    return { score: 0, blockers: ['No participants identified'] };
  }

  const blockers: string[] = [];
  let points = 0;
  const perParty = 100 / parties.length;

  for (const party of parties) {
    let partyPoints = 0;
    if (party.name.confidence === 'high' && party.name.value?.trim()) {
      partyPoints += perParty * 0.5;
    } else {
      blockers.push(`${party.name.value || 'Unnamed participant'}: identity not confirmed`);
    }

    if (party.email.value?.trim() && party.email.confidence !== 'absent') {
      partyPoints += perParty * 0.5;
    } else {
      blockers.push(`${party.name.value}: no email on file`);
    }

    points += partyPoints;
  }

  return { score: Math.round(points), blockers };
}

function scoreCommercialTerms(parties: ExtractedParty[]): { score: number; blockers: string[] } {
  if (parties.length === 0) return { score: 0, blockers: ['No commercial terms'] };

  const blockers: string[] = [];
  let configured = 0;

  for (const party of parties) {
    const hasFixed = hasFixedFeeAmount(party);
    const hasRevenue = hasRevenueSharePct(party);
    const hasConditional = (party.conditionalPayments ?? []).some((c) => c.amount.value != null);
    const isAttribution = party.participationModel.value === 'customer_attribution';

    if (hasFixed || hasRevenue || hasConditional || isAttribution) {
      configured += 1;
    } else {
      blockers.push(`${party.name.value}: compensation terms incomplete`);
    }
  }

  return {
    score: Math.round((configured / parties.length) * 100),
    blockers,
  };
}

function scoreDeliverables(parties: ExtractedParty[]): { score: number; blockers: string[] } {
  if (parties.length === 0) return { score: 0, blockers: ['No deliverables'] };

  const blockers: string[] = [];
  let withDeliverables = 0;

  for (const party of parties) {
    const descriptions = deliverableDescriptions(party);
    if (descriptions.length > 0) {
      withDeliverables += 1;
    } else if (
      party.participationModel.value === 'fixed_payout' ||
      (party.milestones ?? []).some((m) => m.category.value === 'performance')
    ) {
      blockers.push(`${party.name.value}: service deliverables not captured`);
    }
  }

  const score = Math.round((withDeliverables / parties.length) * 100);
  return { score, blockers };
}

function scoreSettlementLogic(result: ExtractionResult): { score: number; blockers: string[] } {
  const blockers: string[] = [];
  const rules = result.settlementRules ?? [];
  const paymentTerms = result.paymentTerms ?? [];

  const explicitTriggers = [
    ...rules.map((r) => r.trigger.value).filter(Boolean),
    ...paymentTerms.map((p) => p.dueCondition.value).filter(Boolean),
  ];

  const hallucinated = explicitTriggers.filter((trigger) =>
    HALLUCINATED_SETTLEMENT_PATTERNS.some((pattern) => pattern.test(trigger ?? ''))
  );

  if (hallucinated.length > 0) {
    blockers.push('Settlement timing includes unsupported inferred rules');
  }

  if (explicitTriggers.length === 0) {
    blockers.push('No explicit settlement timing captured from source text');
    return { score: 40, blockers };
  }

  const evidenceBacked = explicitTriggers.filter(
    (t) => t && rules.some((r) => r.trigger.value === t && r.trigger.confidence !== 'absent')
  );

  const score =
    hallucinated.length > 0
      ? 30
      : evidenceBacked.length > 0
        ? 80
        : Math.min(70, 40 + explicitTriggers.length * 10);

  return { score, blockers };
}

function scorePaymentInfrastructure(): { score: number; blockers: string[] } {
  return {
    score: 0,
    blockers: [
      'No payout destinations (bank accounts / wallets) captured',
      'Payment rail selection not confirmed',
    ],
  };
}

function scoreTaxInformation(): { score: number; blockers: string[] } {
  return {
    score: 0,
    blockers: ['Tax identifiers (ABN / GST / W-9) not captured for participants'],
  };
}

function scoreCompliance(result: ExtractionResult): { score: number; blockers: string[] } {
  const blockers: string[] = [];
  if (result.currency.confidence === 'absent' || !result.currency.value) {
    blockers.push('Settlement currency not confirmed');
  }
  return {
    score: result.currency.confidence === 'high' && result.currency.value ? 100 : 20,
    blockers,
  };
}

function buildSettlementBlockers(dimensions: ReadinessDimensionScore[]): string[] {
  const blockers = new Set<string>();
  for (const dimension of dimensions) {
    for (const blocker of dimension.blockers) {
      blockers.add(blocker);
    }
  }
  return [...blockers];
}

export function buildExtractionReadiness(result: ExtractionResult): ExtractionReadinessAssessment {
  const scorers: Record<
    ReadinessDimension,
    () => { score: number; blockers: string[] }
  > = {
    identity: () => scoreIdentity(result.parties),
    commercialTerms: () => scoreCommercialTerms(result.parties),
    deliverables: () => scoreDeliverables(result.parties),
    settlementLogic: () => scoreSettlementLogic(result),
    paymentInfrastructure: () => scorePaymentInfrastructure(),
    taxInformation: () => scoreTaxInformation(),
    compliance: () => scoreCompliance(result),
  };

  const dimensions: ReadinessDimensionScore[] = DIMENSION_CONFIG.map(({ dimension, label, weight }) => {
    const { score, blockers } = scorers[dimension]();
    return { dimension, label, score, weight, blockers };
  });

  const weightedScore = dimensions.reduce((sum, d) => sum + d.score * d.weight, 0);
  const score = Math.min(89, Math.round(weightedScore));
  const settlementBlockers = buildSettlementBlockers(dimensions);

  const summary =
    settlementBlockers.length > 0
      ? `Settlement not ready today: ${settlementBlockers.slice(0, 3).join('; ')}${settlementBlockers.length > 3 ? '…' : ''}`
      : `Agreement readiness ${score}% — review remaining gaps before settlement.`;

  return { score, dimensions, settlementBlockers, summary };
}

export function formatReadinessDimensionLabel(dimension: ReadinessDimensionScore): string {
  return `${dimension.label}: ${dimension.score}%`;
}

// re-export for type-only consumers
export type { ServiceCategory };
