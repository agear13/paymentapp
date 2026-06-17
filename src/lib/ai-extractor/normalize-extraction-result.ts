import type { ExtractedParty, ExtractionResult, ParticipationModelOption } from './extraction-types';
import { classifyAgreementType } from './classify-agreement-type';
import { buildSettlementEventsFromResult } from './build-settlement-events';
import { buildExtractionReadiness } from './extraction-readiness';
import { logExtractorDebugSnapshot } from './extraction-field-schema';
import { hasFixedFeeAmount, hasRevenueSharePct } from './party-obligation-metrics';
import {
  normalizePartyConditionalPayments,
  parseConditionalPaymentsNonBlocking,
} from './parse-conditional-payments';
import {
  normalizePartyDeliverables,
  parseDeliverablesNonBlocking,
} from './parse-deliverables';
import {
  filterEvidenceBackedSettlementRules,
  parseSettlementRulesNonBlocking,
} from './parse-settlement-rules';
import { inferServiceCategoriesForParty } from './service-category-detection';
import { field, normalizeServiceCategories } from './service-category';

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
  let normalized = normalizePartyDeliverables(party);
  normalized = normalizePartyConditionalPayments(normalized);

  const inferredCategories = inferServiceCategoriesForParty(normalized);
  const serviceCategories =
    inferredCategories.length > 0
      ? {
          value: inferredCategories,
          confidence: normalized.serviceCategories?.confidence ?? ('medium' as const),
        }
      : {
          value: normalizeServiceCategories(
            (normalized.serviceCategories?.value ?? []).map(String)
          ),
          confidence: normalized.serviceCategories?.confidence ?? ('absent' as const),
        };

  return {
    ...normalized,
    participationModel: normalizeParticipationModel(normalized),
    deliverables: normalized.deliverables ?? [],
    deliverablesLegacy: normalized.deliverablesLegacy ?? EMPTY_FIELD_LIST,
    conditionalPayments: normalized.conditionalPayments ?? [],
    milestones: (normalized.milestones ?? []).map((milestone) => ({
      ...milestone,
      status: milestone.status ?? 'pending',
    })),
    serviceCategories,
    conditions: (normalized.conditions ?? []).map((condition) => ({
      ...condition,
      status: condition.status ?? 'pending',
    })),
    dependencies: (normalized.dependencies ?? []).map((dependency) => ({
      ...dependency,
      status: dependency.status ?? 'pending',
    })),
  };
}

export function normalizeExtractionResult(result: ExtractionResult): ExtractionResult {
  const parties = result.parties.map(normalizeExtractedParty);
  const settlementRules = filterEvidenceBackedSettlementRules(result.settlementRules ?? []);

  const withParties: ExtractionResult = {
    ...result,
    schemaVersion: result.schemaVersion ?? 'v4',
    parties,
    settlementRules,
  };

  const agreementTypeValue = classifyAgreementType(withParties);

  const normalized: ExtractionResult = {
    ...withParties,
    agreementType: result.agreementType ?? field(agreementTypeValue, 'high'),
    settlementEvents: buildSettlementEventsFromResult(withParties),
    readinessAssessment: buildExtractionReadiness({
      ...withParties,
      settlementRules,
    }),
  };

  logExtractorDebugSnapshot({
    normalizedParticipants: normalized.parties.length,
    normalizedPaymentTerms: normalized.paymentTerms.length,
    readinessScore: normalized.readinessAssessment?.score ?? 0,
  });

  return normalized;
}

export { parseDeliverablesNonBlocking, parseConditionalPaymentsNonBlocking, parseSettlementRulesNonBlocking };
