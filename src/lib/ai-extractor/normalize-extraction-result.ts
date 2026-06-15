import type { ExtractedParty, ExtractionResult, ParticipationModelOption } from './extraction-types';
import { buildSettlementEventsFromResult } from './build-settlement-events';
import { logExtractorParticipantCount } from './extraction-field-schema';
import { hasFixedFeeAmount, hasRevenueSharePct } from './party-obligation-metrics';
import { inferServiceCategoriesForParty } from './service-category-detection';

const EMPTY_FIELD_LIST = { value: [] as string[], confidence: 'absent' as const };

function normalizeParticipationModel(party: ExtractedParty): ExtractedParty['participationModel'] {
  if (party.participationModel.value === 'customer_attribution') {
    return party.participationModel;
  }
  if (
    party.participationModel.value === 'hybrid' ||
    (hasFixedFeeAmount(party) && hasRevenueSharePct(party))
  ) {
    return {
      ...party.participationModel,
      value: 'hybrid' satisfies ParticipationModelOption,
    };
  }
  return party.participationModel;
}

function normalizeExtractedParty(party: ExtractedParty): ExtractedParty {
  const serviceCategories = party.serviceCategories?.value?.length
    ? party.serviceCategories
    : {
        value: inferServiceCategoriesForParty(party),
        confidence: party.serviceCategories?.confidence ?? ('medium' as const),
      };

  return {
    ...party,
    participationModel: normalizeParticipationModel(party),
    deliverables: party.deliverables ?? EMPTY_FIELD_LIST,
    milestones: (party.milestones ?? []).map((milestone) => ({
      ...milestone,
      status: milestone.status ?? 'pending',
    })),
    serviceCategories,
    conditions: (party.conditions ?? []).map((condition) => ({
      ...condition,
      status: condition.status ?? 'pending',
    })),
    dependencies: (party.dependencies ?? []).map((dependency) => ({
      ...dependency,
      status: dependency.status ?? 'pending',
    })),
  };
}

export function normalizeExtractionResult(result: ExtractionResult): ExtractionResult {
  const parties = result.parties.map(normalizeExtractedParty);
  const normalized: ExtractionResult = {
    ...result,
    schemaVersion: result.schemaVersion ?? 'v3',
    parties,
    settlementEvents: buildSettlementEventsFromResult({ ...result, parties }),
  };

  logExtractorParticipantCount('normalizedParticipants', normalized.parties.length);

  return normalized;
}
