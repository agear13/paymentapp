import { testParty, field } from '@/lib/ai-extractor/test-helpers/party-fixture';
import type { ExtractionResult } from '@/lib/ai-extractor/extraction-types';
import {
  buildReferralExtractionSuccessSummary,
  canPersistReferralPreview,
  candidateToPromoterInput,
  isReferralRelationshipParty,
  mapExtractionToReferralPreview,
  matchOrganizationService,
  NEW_PROMOTER_EXTRACTION_STATUS,
  persistSelectedReferralCandidates,
  referralExtractionNextStep,
  referralManagementParticipantHref,
  resolvePersistedPromoterId,
  selectedReferralCandidates,
} from '@/lib/workflows/referral-management/import-from-extraction';

const SERVICE_A = '11111111-1111-1111-1111-111111111111';
const SERVICE_B = '22222222-2222-2222-2222-222222222222';

const catalog = [
  { id: SERVICE_A, name: 'Summer Launch Package' },
  { id: SERVICE_B, name: 'Teeth Whitening' },
];

function extraction(parties: ReturnType<typeof testParty>[]): ExtractionResult {
  return {
    projectName: field('Summer Launch'),
    projectDescription: field(null, 'absent'),
    projectValue: field(null, 'absent'),
    currency: field('AUD'),
    counterparty: field('Apex Promotions'),
    parties,
    paymentTerms: [],
    uncertainties: [],
    overallConfidence: 'high',
    sourceHint: 'agreement',
    extractedAt: '2026-08-20T00:00:00.000Z',
  };
}

describe('Referral Management import-from-extraction adapter', () => {
  const venue = testParty({
    id: 'venue',
    name: field('Venue Co'),
    role: field('Venue'),
    participationModel: field('fixed_payout'),
    fixedAmount: field(null, 'absent'),
  });
  const apex = testParty({
    id: 'apex',
    name: field('Apex Promotions'),
    email: field('apex@example.com'),
    role: field('Promoter'),
    participationModel: field('revenue_share'),
    revenueSharePct: field(20),
    deliverables: [
      {
        description: field('Summer Launch Package'),
        category: field(null, 'absent'),
      },
    ],
  });
  const dj = testParty({
    id: 'dj',
    name: field('DJ Nova'),
    role: field('DJ'),
    participationModel: field('fixed_payout'),
    fixedAmount: field(2500),
  });

  it('B: extracts a referral relationship from agreement parties', () => {
    const preview = mapExtractionToReferralPreview({
      extraction: extraction([venue, apex, dj]),
      catalog,
      sourceLabel: 'Uploaded agreement',
    });
    expect(preview.candidates).toHaveLength(1);
    expect(preview.candidates[0].name).toBe('Apex Promotions');
    expect(preview.candidates[0].percentage).toBe(20);
    expect(preview.candidates[0].compensationKind).toBe('revenue_share');
    expect(preview.sourceLabel).toBe('Uploaded agreement');
  });

  it('C: review payload is editable before creation and does not invent a promoter', () => {
    const preview = mapExtractionToReferralPreview({
      extraction: extraction([apex]),
      catalog,
      sourceLabel: 'Pasted agreement or conversation',
    });
    expect(preview.candidates[0].selected).toBe(true);
    const mapped = candidateToPromoterInput({
      ...preview.candidates[0],
      name: 'Apex Promotions Pty Ltd',
      percentage: 25,
    });
    expect(mapped).toMatchObject({
      name: 'Apex Promotions Pty Ltd',
      email: 'apex@example.com',
      compensation: { kind: 'revenue_share', percentage: 25, serviceId: SERVICE_A },
    });
  });

  it('D: exact organization_service names are preselected', () => {
    expect(matchOrganizationService(catalog, 'summer launch package')).toEqual({
      serviceId: SERVICE_A,
      serviceMatch: 'exact',
      serviceSuggestions: [{ id: SERVICE_A, name: 'Summer Launch Package' }],
    });
    const preview = mapExtractionToReferralPreview({
      extraction: extraction([apex]),
      catalog,
      sourceLabel: 'Uploaded agreement',
    });
    expect(preview.candidates[0].serviceId).toBe(SERVICE_A);
    expect(preview.candidates[0].serviceMatch).toBe('exact');
  });

  it('does not invent a service when there is no exact catalogue match', () => {
    const unmatched = testParty({
      ...apex,
      deliverables: [{ description: field('Unknown Offer'), category: field(null, 'absent') }],
    });
    const preview = mapExtractionToReferralPreview({
      extraction: extraction([unmatched]),
      catalog,
      sourceLabel: 'Uploaded agreement',
    });
    expect(preview.candidates[0].serviceId).toBeNull();
    expect(preview.candidates[0].serviceMatch).toBe('none');
    expect(candidateToPromoterInput(preview.candidates[0])).toEqual({
      error: 'Select an existing catalogue service. A service will not be invented.',
    });
  });

  it('F: contractual parties are not automatically added as promoters', () => {
    expect(isReferralRelationshipParty(venue)).toBe(false);
    expect(isReferralRelationshipParty(dj)).toBe(false);
    expect(isReferralRelationshipParty(apex)).toBe(true);
    const preview = mapExtractionToReferralPreview({
      extraction: extraction([venue, apex, dj]),
      catalog,
      sourceLabel: 'Uploaded agreement',
    });
    expect(preview.excludedParties.map((row) => row.name)).toEqual(['Venue Co', 'DJ Nova']);
    expect(preview.candidates.map((row) => row.name)).toEqual(['Apex Promotions']);
  });

  it('G: confirmed candidate maps onto the existing P4 promoter payload', () => {
    const preview = mapExtractionToReferralPreview({
      extraction: extraction([apex]),
      catalog,
      sourceLabel: 'Uploaded agreement',
    });
    expect(candidateToPromoterInput(preview.candidates[0])).toEqual({
      name: 'Apex Promotions',
      email: 'apex@example.com',
      phone: undefined,
      role: 'Promoter',
      compensation: {
        kind: 'revenue_share',
        percentage: 20,
        serviceId: SERVICE_A,
      },
    });
  });

  it('requires the operator to choose when multiple catalogue names match exactly', () => {
    const ambiguous = matchOrganizationService(
      [
        { id: SERVICE_A, name: 'Whitening' },
        { id: SERVICE_B, name: 'Whitening' },
      ],
      'Whitening'
    );
    expect(ambiguous.serviceMatch).toBe('ambiguous');
    expect(ambiguous.serviceId).toBeNull();
  });

  it('builds a success summary from the created participant identifier', () => {
    const preview = mapExtractionToReferralPreview({
      extraction: extraction([apex]),
      catalog,
      sourceLabel: 'Pasted agreement or conversation',
    });
    const [candidate] = selectedReferralCandidates(preview);
    expect(candidate?.name).toBe('Apex Promotions');
    expect(
      buildReferralExtractionSuccessSummary({
        candidate: candidate!,
        catalog,
        participantId: 'participant-apex',
      })
    ).toEqual({
      participantId: 'participant-apex',
      participantName: 'Apex Promotions',
      commission: '20% revenue share',
      eligibleServices: ['Summer Launch Package'],
      status: NEW_PROMOTER_EXTRACTION_STATUS,
      nextStep:
        'Apex Promotions needs to review and approve their agreement before their referral can be activated.',
      inviteActionLabel: 'Send Apex Promotions an invitation →',
    });
  });

  it('uses the existing coordination action for next-step copy', () => {
    expect(
      referralExtractionNextStep('Sarah', {
        nextActionKind: 'request_approval',
        agreementStatus: 'not_requested',
      })
    ).toBe('Sarah needs to review and approve their agreement before their referral can be activated.');
    expect(
      referralExtractionNextStep('Sarah', {
        nextActionKind: 'request_approval',
        agreementStatus: 'requested',
      })
    ).toBe('Wait for Sarah to review and approve their agreement.');
    expect(
      referralExtractionNextStep('Sarah', {
        nextActionKind: 'activate_referral',
        referralStatus: 'ready',
      })
    ).toBe("Activate Sarah's referral so they can start referring.");
    expect(referralExtractionNextStep('Sarah', { nextActionKind: 'none' })).toBeNull();
  });

  it('uses the API-returned participant id for the exact participant route', () => {
    expect(
      resolvePersistedPromoterId({
        ok: true,
        participantId: 'created-from-api-7f3c',
      })
    ).toBe('created-from-api-7f3c');
    expect(
      referralManagementParticipantHref('created-from-api-7f3c')
    ).toBe('/workspace/workflows/referral-management?participant=created-from-api-7f3c');
    expect(
      resolvePersistedPromoterId({
        ok: false,
        existing: { participantId: 'existing-promoter' },
      })
    ).toBe('existing-promoter');
    expect(resolvePersistedPromoterId({ ok: true, participantId: '  ' })).toBeNull();
    expect(resolvePersistedPromoterId({ ok: false })).toBeNull();
  });

  it('creates a participant from a complete extraction and returns that id', async () => {
    const preview = mapExtractionToReferralPreview({
      extraction: extraction([apex]),
      catalog,
      sourceLabel: 'Pasted agreement or conversation',
    });
    const persist = jest.fn().mockResolvedValue({
      ok: true,
      participantId: 'persisted-apex-id',
    });

    const result = await persistSelectedReferralCandidates({ preview, persist });

    expect(result).toEqual({
      ok: true,
      participantId: 'persisted-apex-id',
      candidate: expect.objectContaining({ name: 'Apex Promotions', email: 'apex@example.com' }),
      coordination: null,
    });
    expect(persist).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'apex@example.com',
        reuseExisting: true,
        compensation: expect.objectContaining({ serviceId: SERVICE_A }),
      })
    );
  });

  it('persists a contract extraction to the returned participant id', async () => {
    const preview = mapExtractionToReferralPreview({
      extraction: extraction([apex]),
      catalog,
      sourceLabel: 'Uploaded agreement',
    });
    const result = await persistSelectedReferralCandidates({
      preview,
      persist: async () => ({ ok: true, participantId: 'created-from-contract-id' }),
    });
    expect(result).toMatchObject({ ok: true, participantId: 'created-from-contract-id' });
    expect(preview.sourceLabel).toBe('Uploaded agreement');
  });

  it('keeps the extraction for review when creation fails or the API omits an id', async () => {
    const preview = mapExtractionToReferralPreview({
      extraction: extraction([apex]),
      catalog,
      sourceLabel: 'Uploaded agreement',
    });

    await expect(
      persistSelectedReferralCandidates({
        preview,
        persist: async () => ({ ok: false, error: 'Could not save the extracted participant.' }),
      })
    ).resolves.toEqual({
      ok: false,
      error: 'Could not save the extracted participant.',
    });

    await expect(
      persistSelectedReferralCandidates({
        preview,
        persist: async () => ({ ok: true, participantId: undefined }),
      })
    ).resolves.toEqual({
      ok: false,
      error: 'Could not save the extracted participant.',
    });
  });

  it('does not persist when extracted participant data is incomplete', () => {
    const preview = mapExtractionToReferralPreview({
      extraction: extraction([{ ...apex, email: field(null, 'absent') }]),
      catalog,
      sourceLabel: 'Pasted agreement or conversation',
    });
    expect(canPersistReferralPreview(preview)).toEqual({
      ok: false,
      error: 'Email is required before this referral relationship can be created.',
    });
  });
});
