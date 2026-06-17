import type { ExtractedParty, ExtractionResult } from './extraction-types';
import {
  formatServiceCategoryLabels,
  type ServiceCategory,
} from './service-category';
import { inferServiceCategoriesForParties } from './service-category-detection';

export function hasFixedFeeAmount(party: ExtractedParty): boolean {
  return party.fixedAmount.value != null && party.fixedAmount.value > 0;
}

export function hasRevenueSharePct(party: ExtractedParty): boolean {
  return party.revenueSharePct.value != null && party.revenueSharePct.value > 0;
}

export function isHybridExtractedParty(party: ExtractedParty): boolean {
  if (party.participationModel.value === 'hybrid') return true;
  return hasFixedFeeAmount(party) && hasRevenueSharePct(party);
}

export function countPartyObligationMetrics(parties: ExtractedParty[]) {
  let fixedFeeObligationCount = 0;
  let revenueShareObligationCount = 0;
  let hybridParticipantCount = 0;
  let attributionCount = 0;

  for (const party of parties) {
    const hasFixed = hasFixedFeeAmount(party);
    const hasRevenue = hasRevenueSharePct(party);
    const isHybrid = isHybridExtractedParty(party);

    if (isHybrid) hybridParticipantCount += 1;
    if (hasFixed) fixedFeeObligationCount += 1;
    if (hasRevenue) revenueShareObligationCount += 1;
    if (party.participationModel.value === 'customer_attribution') attributionCount += 1;
  }

  return {
    fixedFeeObligationCount,
    revenueShareObligationCount,
    hybridParticipantCount,
    attributionCount,
  };
}

function describeCompensationStructure(
  fixedFeeObligationCount: number,
  revenueShareObligationCount: number
): string | null {
  if (fixedFeeObligationCount > 0 && revenueShareObligationCount > 0) {
    return 'fixed-fee and revenue-share obligations';
  }
  if (fixedFeeObligationCount > 0) return 'fixed-fee obligations';
  if (revenueShareObligationCount > 0) return 'revenue-share obligations';
  return null;
}

export function buildProjectSummaryOneLiner(result: ExtractionResult): string {
  const participantCount = result.parties.length;
  const project = result.projectName.value?.trim();
  const counterparty = result.counterparty.value?.trim();
  const serviceCategories = inferServiceCategoriesForParties(result.parties);
  const serviceSummary = formatServiceCategoryLabels(serviceCategories);
  const { fixedFeeObligationCount, revenueShareObligationCount } = countPartyObligationMetrics(
    result.parties
  );
  const compensationSummary = describeCompensationStructure(
    fixedFeeObligationCount,
    revenueShareObligationCount
  );

  if (participantCount === 0) {
    return 'No agreement details detected. Please fill in all fields manually.';
  }

  if (project && serviceSummary && compensationSummary) {
    return `${project} includes ${participantCount} participant${participantCount === 1 ? '' : 's'} with ${compensationSummary} across ${serviceSummary}.`;
  }

  if (project && serviceSummary) {
    const subject = counterparty ?? project;
    return `${subject} engaged ${participantCount} participant${participantCount === 1 ? '' : 's'} for ${project}, including ${serviceSummary}.`;
  }

  if (project && compensationSummary) {
    return `${project} includes ${participantCount} participant${participantCount === 1 ? '' : 's'} with ${compensationSummary}.`;
  }

  if (project) {
    const subject = counterparty ?? project;
    return `${subject} engaged ${participantCount} participant${participantCount === 1 ? '' : 's'} for ${project}.`;
  }

  if (serviceSummary) {
    return `${participantCount} participant${participantCount === 1 ? '' : 's'} identified across ${serviceSummary}. Review fields below.`;
  }

  return `${participantCount} participant${participantCount === 1 ? '' : 's'} identified. Review fields below.`;
}
