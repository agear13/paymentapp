import type { ExtractedParty, ExtractionResult } from './extraction-types';

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

export function summarizeParticipantRoles(parties: ExtractedParty[]): string {
  const roles = parties
    .map((party) => party.role.value?.trim())
    .filter((role): role is string => Boolean(role));

  const unique = [...new Set(roles.map((role) => role.toLowerCase()))];
  if (unique.length === 0) return '';

  const formatted = unique.map((role) => role.replace(/\b\w/g, (c) => c.toLowerCase()));
  if (formatted.length <= 5) return formatted.join(', ');
  return `${formatted.slice(0, 4).join(', ')}, and others`;
}

export function buildProjectSummaryOneLiner(result: ExtractionResult): string {
  const participantCount = result.parties.length;
  const project = result.projectName.value?.trim();
  const counterparty = result.counterparty.value?.trim();
  const roleSummary = summarizeParticipantRoles(result.parties);
  const { fixedFeeObligationCount, revenueShareObligationCount } = countPartyObligationMetrics(
    result.parties
  );

  if (participantCount === 0) {
    return 'No agreement details detected. Please fill in all fields manually.';
  }

  if (project) {
    const subject = counterparty ?? project;
    if (roleSummary) {
      return `${subject} engaged ${participantCount} participant${participantCount === 1 ? '' : 's'} for ${project}, including ${roleSummary}.`;
    }
    if (fixedFeeObligationCount > 0 && revenueShareObligationCount > 0) {
      return `${project} includes ${participantCount} participant${participantCount === 1 ? '' : 's'} with fixed-fee and revenue-share obligations.`;
    }
    return `${subject} engaged ${participantCount} participant${participantCount === 1 ? '' : 's'} for ${project}.`;
  }

  if (roleSummary) {
    return `${participantCount} participant${participantCount === 1 ? '' : 's'} identified, including ${roleSummary}. Review fields below.`;
  }

  return `${participantCount} participant${participantCount === 1 ? '' : 's'} identified. Review fields below.`;
}
