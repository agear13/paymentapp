import {
  buildParticipantIdentityReport,
  type ParticipantIdentityRow,
} from '@/lib/deal-network-demo/participant-identity-report';

function row(
  overrides: Partial<ParticipantIdentityRow> & { participantId: string; normalizedName: string }
): ParticipantIdentityRow {
  return {
    dealId: 'deal-1',
    dealName: 'Beach Event',
    name: overrides.normalizedName,
    createdAt: '2026-01-01T00:00:00.000Z',
    compensationProfile: null,
    commissionValue: 0,
    participationModel: 'fixed_payout',
    agreementLifecycle: 'NOT_CREATED',
    participantLifecycle: 'DRAFT',
    earningsTableLabel: 'Not configured',
    hasAiImportInNotes: false,
    inviteToken: 'tok',
    ...overrides,
  };
}

describe('participant identity report', () => {
  it('detects duplicate names and split profile vs display', () => {
    const report = buildParticipantIdentityReport({
      rows: [
        row({
          participantId: 'old-id',
          normalizedName: 'island djs',
          createdAt: '2026-01-01T00:00:00.000Z',
          earningsTableLabel: 'Needs review',
        }),
        row({
          participantId: 'new-id',
          normalizedName: 'island djs',
          createdAt: '2026-01-02T00:00:00.000Z',
          compensationProfile: {
            compensationType: 'FIXED_FEE',
            fixedAmount: 2500,
            configured: true,
            configuredAt: '2026-01-02T00:00:00.000Z',
          },
          earningsTableLabel: 'A$2,500 fixed fee',
          hasAiImportInNotes: true,
        }),
      ],
    });

    expect(report.answers.A_multipleRecordsPerName['island djs']).toBe(true);
    expect(report.answers.B_profileOnParticipantId['island djs']).toBe('new-id');
    expect(report.answers.C_needsReviewOrNotConfiguredRowIds['island djs']).toEqual(['old-id']);
    expect(report.answers.D_sameIdAsProfile['island djs']).toBe(false);
    expect(report.duplicateChains[0]?.participantIds).toEqual(['old-id', 'new-id']);
  });
});
