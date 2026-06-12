import type { ExtractedParty, ExtractionResult, ParticipationModelOption } from './extraction-types';
import { hasFixedFeeAmount, hasRevenueSharePct } from './party-obligation-metrics';

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
  return {
    ...party,
    participationModel: normalizeParticipationModel(party),
    deliverables: party.deliverables ?? EMPTY_FIELD_LIST,
    milestones: party.milestones ?? [],
  };
}

export function normalizeExtractionResult(result: ExtractionResult): ExtractionResult {
  return {
    ...result,
    schemaVersion: result.schemaVersion ?? 'v2',
    parties: result.parties.map(normalizeExtractedParty),
  };
}
