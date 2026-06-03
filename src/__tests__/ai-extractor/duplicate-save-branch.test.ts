import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import type { RecentDeal } from '@/lib/data/mock-deal-network';
import { detectDuplicates, defaultResolutions } from '@/lib/ai-extractor/duplicate-detection';
import { runParticipantAddSaveBranchTrace } from '@/lib/ai-extractor/duplicate-save-path-instrumentation';
import type { ExtractionResult } from '@/lib/ai-extractor/extraction-types';
import type { ReviewFormState } from '@/lib/ai-extractor/review-form-types';
import { validateExtractionResult } from '@/lib/ai-extractor/extraction-service';

function field<T>(value: T) {
  return { value, confidence: 'high' as const };
}

function baseDeal(): RecentDeal {
  return {
    id: 'deal-trace',
    dealName: 'Beach Event',
    partner: 'Venue',
    value: 10000,
    introducer: '',
    closer: '',
    status: 'Pending',
    lastUpdated: new Date().toISOString(),
    paymentStatus: 'Not Paid',
  };
}

function existingIsland(): DemoParticipant {
  return {
    id: 'part-island-existing',
    name: 'Island DJs',
    email: '',
    role: 'Contributor',
    commissionKind: 'fixed_amount',
    commissionValue: 0,
    status: 'Pending',
    approvalStatus: 'Pending approval',
    inviteToken: 'tok-island',
    dealId: 'deal-trace',
    agreementLifecycle: 'NOT_CREATED',
    participantLifecycle: 'DRAFT',
  };
}

function extractionIsland(): ExtractionResult {
  return validateExtractionResult({
    projectName: field('Saturday Beach Event'),
    projectDescription: field(null),
    projectValue: field(2500),
    currency: field('AUD'),
    counterparty: field('Venue'),
    parties: [
      {
        id: 'ep-1',
        name: field('Island DJs'),
        email: field(null, 'absent'),
        role: field('Contractor'),
        participationModel: field('fixed_payout'),
        fixedAmount: field(2500),
        revenueSharePct: field(null, 'absent'),
        notes: field(''),
      },
    ],
    paymentTerms: [],
    uncertainties: [],
    overallConfidence: 'high',
    sourceHint: 'whatsapp',
    extractedAt: new Date().toISOString(),
  });
}

function formWithResolutions(
  resolutions: ReviewFormState['duplicateResolutions']
): ReviewFormState {
  return {
    entryPoint: 'participant_add',
    existingDealId: 'deal-trace',
    sourceType: 'whatsapp',
    projectName: 'Saturday Beach Event',
    projectDescription: '',
    projectValue: 2500,
    currency: 'AUD',
    counterparty: 'Venue',
    parties: [
      {
        id: 'ep-1',
        name: 'Island DJs',
        email: '',
        role: 'Contractor',
        participationModel: 'fixed_payout',
        fixedAmount: 2500,
        revenueSharePct: null,
        notes: '',
      },
    ],
    duplicateResolutions: resolutions,
    extractedCurrencyCode: 'AUD',
    extractedCurrencyUnsupported: false,
  };
}

describe('duplicate save path branching', () => {
  const deal = baseDeal();
  const projectParticipants = [existingIsland()];
  const snapshotParticipants = [existingIsland()];
  const result = extractionIsland();

  it('enters update branch when duplicateResolutions is update (modal after init)', () => {
    const duplicateMatchesAtSave = detectDuplicates(
      formWithResolutions({}).parties,
      projectParticipants
    );
    const form = formWithResolutions(defaultResolutions(duplicateMatchesAtSave));

    const { report } = runParticipantAddSaveBranchTrace({
      label: 'island:update',
      form,
      result,
      existingDeal: deal,
      duplicateMatchesAtSave,
      snapshotParticipants,
      provenanceTag: '[test]',
    });

    expect(report.duplicateMatchesAtSave).toHaveLength(1);
    expect(report.partyTraces[0]?.resolutionComputed).toBe('update');
    expect(report.partyTraces[0]?.enteredBranch).toBe('update');
    expect(report.participantCountAfterSave).toBe(1);
    expect(report.sameNameCountAfter['island djs']).toBe(1);
    expect(report.snapshotDiff.newParticipantsCreated).toHaveLength(0);
    expect(report.snapshotDiff.existingParticipantUpdated).toHaveLength(1);
  });

  it('enters create branch when duplicateResolutions entry is missing (save ?? create)', () => {
    const duplicateMatchesAtSave = detectDuplicates(
      formWithResolutions({}).parties,
      projectParticipants
    );
    const form = formWithResolutions({});

    const { report } = runParticipantAddSaveBranchTrace({
      label: 'island:create-fallback',
      form,
      result,
      existingDeal: deal,
      duplicateMatchesAtSave,
      snapshotParticipants,
      provenanceTag: '[test]',
    });

    expect(report.duplicateMatchesAtSave).toHaveLength(1);
    expect(report.partyTraces[0]?.resolutionRaw).toBeUndefined();
    expect(report.partyTraces[0]?.resolutionComputed).toBe('create');
    expect(report.partyTraces[0]?.enteredBranch).toBe('create');
    expect(report.participantCountAfterSave).toBe(2);
    expect(report.sameNameCountAfter['island djs']).toBe(2);
    expect(report.snapshotDiff.newParticipantsCreated).toHaveLength(1);
    expect(report.snapshotDiff.duplicateNameRowsAfter[0]?.participantIds).toHaveLength(2);
  });
});
