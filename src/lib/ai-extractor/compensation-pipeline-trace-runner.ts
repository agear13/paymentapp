import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import type { RecentDeal } from '@/lib/data/mock-deal-network';
import { detectDuplicates, defaultResolutions } from '@/lib/ai-extractor/duplicate-detection';
import {
  findFirstCompensationDivergence,
  logCompensationPipelineTrace,
  snapFromExtractedParty,
  snapFromParticipant,
  snapFromReviewedParty,
  snapProfileBuildStage,
  type CompensationPipelineSnapshot,
} from '@/lib/ai-extractor/compensation-pipeline-trace';
import {
  mapSinglePartyToParticipant,
  mergeExtractedCompensationIntoExistingParticipant,
  traceBuildCompensationProfileFromReview,
} from '@/lib/ai-extractor/extraction-mapper';
import type { ExtractionResult } from '@/lib/ai-extractor/extraction-types';
import { reviewFormFromExtraction, type ReviewFormState, type ReviewedParty } from '@/lib/ai-extractor/review-form-types';

export function runCompensationPipelineTraceForImport(input: {
  label: string;
  result: ExtractionResult;
  formAtSave: ReviewFormState;
  party: ReviewedParty;
  project: RecentDeal;
  provenanceTag: string;
  entryPoint: ReviewFormState['entryPoint'];
  sourceType: ReviewFormState['sourceType'];
  currencyContext?: {
    project?: Pick<RecentDeal, 'projectValueCurrency'> | null;
    workspaceCurrency?: string | null;
  };
  existingParticipantsForDuplicate?: DemoParticipant[];
  mergeExistingParticipant?: DemoParticipant | null;
}): {
  snapshots: CompensationPipelineSnapshot[];
  built: DemoParticipant;
  afterPersist: DemoParticipant;
} {
  const {
    label,
    result,
    formAtSave,
    party,
    project,
    provenanceTag,
    entryPoint,
    sourceType,
    currencyContext,
    existingParticipantsForDuplicate,
    mergeExistingParticipant,
  } = input;

  const original = result.parties.find((p) => p.id === party.id);
  const freshForm = reviewFormFromExtraction(
    result,
    entryPoint,
    sourceType,
    formAtSave.existingDealId,
    currencyContext
  );
  const freshParty = freshForm.parties.find((p) => p.id === party.id) ?? party;

  const snapshots: CompensationPipelineSnapshot[] = [];

  if (original) {
    snapshots.push(snapFromExtractedParty('0.validatedExtractionResult', original));
  }

  snapshots.push(
    snapFromReviewedParty('1.reviewFormFromExtraction', freshParty, {
      extractedCurrencyUnsupported: freshForm.extractedCurrencyUnsupported,
      extractedCurrencyCode: freshForm.extractedCurrencyCode,
      currency: freshForm.currency,
    })
  );

  snapshots.push(
    snapFromReviewedParty('2.ExtractionReviewModal.formAtSave', party, {
      extractedCurrencyUnsupported: formAtSave.extractedCurrencyUnsupported,
      extractedCurrencyCode: formAtSave.extractedCurrencyCode,
      currency: formAtSave.currency,
      formDiffersFromFresh:
        freshParty.fixedAmount !== party.fixedAmount ||
        freshParty.revenueSharePct !== party.revenueSharePct ||
        freshParty.participationModel !== party.participationModel,
    })
  );

  snapshots.push(snapProfileBuildStage(party, original));

  const built = mapSinglePartyToParticipant(party, project, provenanceTag, original);
  snapshots.push(snapFromParticipant('4.mapSinglePartyToParticipant', built, {
    profileFromReview: traceBuildCompensationProfileFromReview(party, original) != null,
  }));

  let finalParticipant = built;
  if (mergeExistingParticipant) {
    finalParticipant = mergeExtractedCompensationIntoExistingParticipant(
      mergeExistingParticipant,
      built
    );
    snapshots.push(
      snapFromParticipant('5.mergeExtractedCompensationIntoExistingParticipant', finalParticipant, {
        existingParticipantId: mergeExistingParticipant.id,
        existingHadProfile: mergeExistingParticipant.compensationProfile != null,
        builtHadProfile: built.compensationProfile != null,
      })
    );
  } else if (existingParticipantsForDuplicate?.length) {
    const matches = detectDuplicates([party], existingParticipantsForDuplicate);
    const resolutions = formAtSave.duplicateResolutions;
    snapshots.push({
      stage: '5.mergeSkipped',
      participationModel: party.participationModel,
      fixedAmount: party.fixedAmount,
      revenueSharePct: party.revenueSharePct,
      compensationProfile: null,
      compensationType: null,
      configured: null,
      hints: {
        duplicateMatches: matches.length,
        resolution: resolutions[party.id] ?? 'create',
        wouldMerge: resolutions[party.id] === 'update' && matches.length > 0,
      },
    });
  }

  const afterPersist = JSON.parse(JSON.stringify(finalParticipant)) as DemoParticipant;
  snapshots.push(snapFromParticipant('6.persistPilotSnapshot.participant_payload', afterPersist));

  const expectations =
    party.participationModel === 'fixed_payout'
      ? { fixedAmount: 2500, compensationType: 'FIXED_FEE', configured: true }
      : party.participationModel === 'revenue_share'
        ? {
            revenueSharePct: 15,
            compensationType: 'REVENUE_SHARE',
            configured: true,
            rejectCompensationType: 'FIXED_FEE',
          }
        : {};

  const divergence = findFirstCompensationDivergence(label, snapshots, expectations);

  logCompensationPipelineTrace({
    label,
    extractionCurrency: result.currency,
    extractedCurrencyUnsupported: formAtSave.extractedCurrencyUnsupported,
    snapshots,
    divergence: {
      ...divergence,
      summary: {
        firstFixedAmountLoss: divergence.firstFixedAmountLoss,
        firstRevenueShareLoss: divergence.firstRevenueShareLoss,
        firstWrongCompensationType: divergence.firstWrongCompensationType,
        firstConfiguredLoss: divergence.firstConfiguredLoss,
      },
    },
  });

  return { snapshots, built, afterPersist };
}
