/**
 * V5 commercial obligation graph — structured metrics, summary, and participant cards.
 */

import { agreementTypeDisplayLabel } from './classify-agreement-type';
import type { CommercialGraphSnapshot, CommercialStructureMetrics } from './commercial-graph-types';
import type { ExtractionResult } from './extraction-types';
import {
  buildCompensationTermsFromParty,
  buildOperationalObligationsFromParty,
  buildCommercialDependenciesFromParty,
  detectAgreementOwner,
  estimateFixedCommitment,
  formatCompensationTermLabel,
  isHybridCompensation,
} from './migrate-extraction-schema';
import { inferServiceCategoriesForParty } from './service-category-detection';
import { serviceCategoryDisplayLabel } from './service-category';

function uniqueNonEmpty(values: string[]): string[] {
  return [...new Set(values.map((v) => v.trim()).filter(Boolean))];
}

function collectVariableRevenueBases(result: ExtractionResult): string[] {
  const basis = new Set<string>();
  for (const party of result.parties) {
    for (const term of party.compensationTerms ?? buildCompensationTermsFromParty(party, result)) {
      if (term.type !== 'revenue_share') continue;
      const label = term.revenueBasis.value?.trim();
      if (label) basis.add(label);
    }
  }
  return [...basis];
}

export function buildCommercialStructureMetrics(result: ExtractionResult): CommercialStructureMetrics {
  let deliverableCount = 0;
  let operationalObligationCount = 0;
  let compensationTermCount = 0;
  let revenueShareAgreementCount = 0;
  let fixedPaymentAgreementCount = 0;
  let hybridCompensationCount = 0;
  let milestonePaymentCount = 0;
  let instalmentPaymentCount = 0;
  let conditionalPaymentCount = 0;
  let estimatedFixedCommitment = 0;

  for (const party of result.parties) {
    const operational = party.operationalObligations ?? buildOperationalObligationsFromParty(party);
    const compensation = party.compensationTerms ?? buildCompensationTermsFromParty(party, result);

    deliverableCount += operational.length;
    operationalObligationCount += operational.length;
    compensationTermCount += compensation.length;
    estimatedFixedCommitment += estimateFixedCommitment(compensation);

    if (compensation.some((t) => t.type === 'revenue_share')) revenueShareAgreementCount += 1;
    if (compensation.some((t) => t.type === 'fixed_fee')) fixedPaymentAgreementCount += 1;
    milestonePaymentCount += compensation.filter((t) => t.type === 'milestone').length;
    instalmentPaymentCount += compensation.filter((t) => t.type === 'instalment').length;
    if (compensation.some((t) => t.type === 'conditional_bonus')) conditionalPaymentCount += 1;
    if (isHybridCompensation(compensation)) hybridCompensationCount += 1;
  }

  const agreementType = result.agreementType?.value ?? null;
  const owner = detectAgreementOwner(result);

  return {
    agreementType,
    agreementTypeLabel: agreementType
      ? agreementTypeDisplayLabel(agreementType)
      : 'Commercial Agreement',
    agreementOwner: owner?.name.value?.trim() ?? null,
    participantCount: result.parties.length,
    deliverableCount,
    operationalObligationCount,
    compensationTermCount,
    settlementEventCount: result.settlementEvents?.length ?? 0,
    revenueShareAgreementCount,
    fixedPaymentAgreementCount,
    hybridCompensationCount,
    milestonePaymentCount,
    instalmentPaymentCount,
    conditionalPaymentCount,
    estimatedFixedCommitment,
    variableRevenueBases: collectVariableRevenueBases(result),
    settlementBlockers: result.readinessAssessment?.settlementBlockers ?? [],
  };
}

export function buildCommercialStructureOverview(
  metrics: CommercialStructureMetrics
): { bulletPoints: string[] } {
  const bullets: string[] = [
    `${metrics.participantCount} commercial participant${metrics.participantCount === 1 ? '' : 's'}`,
  ];

  if (metrics.hybridCompensationCount > 0) {
    bullets.push(
      `${metrics.hybridCompensationCount} hybrid compensation arrangement${metrics.hybridCompensationCount === 1 ? '' : 's'}`
    );
  }
  if (metrics.milestonePaymentCount > 0) {
    bullets.push(
      `${metrics.milestonePaymentCount} milestone payment arrangement${metrics.milestonePaymentCount === 1 ? '' : 's'}`
    );
  }
  if (metrics.instalmentPaymentCount > 0) {
    bullets.push(
      `${metrics.instalmentPaymentCount} instalment payment${metrics.instalmentPaymentCount === 1 ? '' : 's'}`
    );
  }
  if (metrics.revenueShareAgreementCount > 0) {
    bullets.push(
      `${metrics.revenueShareAgreementCount} revenue share agreement${metrics.revenueShareAgreementCount === 1 ? '' : 's'}`
    );
  }
  if (metrics.conditionalPaymentCount > 0) {
    bullets.push(
      `${metrics.conditionalPaymentCount} conditional bonus${metrics.conditionalPaymentCount === 1 ? '' : 'es'}`
    );
  }

  if (metrics.estimatedFixedCommitment > 0) {
    bullets.push(
      `Estimated committed fixed spend: $${metrics.estimatedFixedCommitment.toLocaleString('en-AU', { maximumFractionDigits: 0 })}`
    );
  }

  if (metrics.variableRevenueBases.length > 0) {
    bullets.push(
      `Additional variable obligations tied to ${metrics.variableRevenueBases.join(', ')}`
    );
  }

  return { bulletPoints: bullets };
}

export function buildCommercialSummaryNarrative(
  result: ExtractionResult,
  metrics: CommercialStructureMetrics
): string {
  const agreementName = result.projectName.value?.trim() || 'This agreement';
  const parts: string[] = [];

  parts.push(
    `${agreementName} engages ${metrics.participantCount} independent supplier${metrics.participantCount === 1 ? '' : 's'}.`
  );

  if (metrics.hybridCompensationCount > 0) {
    parts.push(
      `${metrics.hybridCompensationCount} supplier${metrics.hybridCompensationCount === 1 ? ' receives a hybrid compensation arrangement combining fixed payments and revenue sharing' : 's receive hybrid compensation combining fixed payments and revenue sharing'}.`
    );
  }

  if (metrics.milestonePaymentCount > 0) {
    parts.push('At least one supplier has milestone-based payments tied to delivery.');
  }

  if (metrics.instalmentPaymentCount > 0) {
    parts.push('At least one supplier has instalment payments tied to event timing.');
  }

  if (metrics.conditionalPaymentCount > 0) {
    parts.push(
      `${metrics.conditionalPaymentCount} supplier${metrics.conditionalPaymentCount === 1 ? ' has a conditional attendance or performance bonus' : 's have conditional attendance or performance bonuses'}.`
    );
  }

  if (metrics.estimatedFixedCommitment > 0) {
    parts.push(
      `The agreement commits approximately $${metrics.estimatedFixedCommitment.toLocaleString('en-AU', { maximumFractionDigits: 0 })} in fixed payments`
    );
    if (metrics.variableRevenueBases.length > 0) {
      parts.push(
        `in addition to revenue share obligations across ${metrics.variableRevenueBases.join(', ')}.`
      );
    } else {
      parts.push('in addition to any variable revenue share obligations.');
    }
  } else if (metrics.variableRevenueBases.length > 0) {
    parts.push(
      `Compensation is primarily variable, tied to ${metrics.variableRevenueBases.join(', ')}.`
    );
  }

  return parts.join(' ');
}

function settlementTriggersForParty(result: ExtractionResult, partyId: string): string[] {
  const fromEvents = (result.settlementEvents ?? [])
    .filter((event) => event.partyId.value === partyId)
    .map((event) => event.trigger.value?.trim())
    .filter(Boolean) as string[];

  const party = result.parties.find((p) => p.id === partyId);
  const fromTerms = (party?.compensationTerms ?? [])
    .map((term) => term.trigger.value?.trim())
    .filter(Boolean) as string[];

  return uniqueNonEmpty([...fromEvents, ...fromTerms]);
}

export function buildCommercialGraph(result: ExtractionResult): CommercialGraphSnapshot {
  const metrics = buildCommercialStructureMetrics(result);
  const owner = detectAgreementOwner(result);
  const currency = result.currency.value?.trim().toUpperCase() || 'AUD';

  const participantCards = result.parties.map((party) => {
    const categories = inferServiceCategoriesForParty(party);
    const operational = party.operationalObligations ?? buildOperationalObligationsFromParty(party);
    const compensation = party.compensationTerms ?? buildCompensationTermsFromParty(party, result);
    const dependencies = party.commercialDependencies ?? buildCommercialDependenciesFromParty(party, compensation);

    return {
      participantId: party.id,
      name: party.name.value?.trim() || 'Unnamed participant',
      role: party.role.value?.trim() || 'Participant',
      serviceCategory:
        categories.length > 0 ? serviceCategoryDisplayLabel(categories[0]!) : null,
      deliverables: operational.map((o) => o.description.value?.trim()).filter(Boolean) as string[],
      operationalObligations: operational
        .map((o) => o.description.value?.trim())
        .filter(Boolean) as string[],
      compensationTerms: compensation.map((t) => formatCompensationTermLabel(t, currency)),
      settlementSchedule: settlementTriggersForParty(result, party.id),
      dependencies: dependencies.map((d) => d.description.value?.trim()).filter(Boolean) as string[],
    };
  });

  const settlementSchedule = participantCards.map((card) => ({
    participantId: card.participantId,
    participantName: card.name,
    compensationSummary: card.compensationTerms,
    settlementTriggers:
      card.settlementSchedule.length > 0
        ? card.settlementSchedule
        : ['Settlement timing not explicitly captured'],
  }));

  return {
    schemaVersion: 'v5',
    agreementOwner: owner?.name.value?.trim() ?? null,
    agreementOwnerResponsibilities: (owner?.responsibilities ?? [])
      .map((r) => r.value?.trim())
      .filter(Boolean) as string[],
    commercialStructure: metrics,
    commercialSummary: buildCommercialSummaryNarrative(result, metrics),
    commercialStructureOverview: buildCommercialStructureOverview(metrics),
    participantCards,
    settlementSchedule,
    operationalObligations: participantCards.map((card) => ({
      participant: card.name,
      items: card.operationalObligations,
    })),
    compensationTerms: participantCards.map((card) => ({
      participant: card.name,
      items: card.compensationTerms,
    })),
    readinessAssessment: result.readinessAssessment,
  };
}

export function enrichExtractionWithCommercialGraph(result: ExtractionResult): ExtractionResult {
  return {
    ...result,
    commercialGraph: buildCommercialGraph(result),
  };
}
