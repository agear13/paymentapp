jest.mock('server-only', () => ({}));

const mockDealFindFirst = jest.fn();
const mockDealUpsert = jest.fn();
const mockDealFindMany = jest.fn();
const mockParticipantFindMany = jest.fn();
const mockParticipantUpdate = jest.fn();
const mockParticipantUpsert = jest.fn();

jest.mock('@/lib/server/prisma', () => ({
  prisma: {
    deal_network_pilot_deals: {
      findFirst: (...args: unknown[]) => mockDealFindFirst(...args),
      findMany: (...args: unknown[]) => mockDealFindMany(...args),
      upsert: (...args: unknown[]) => mockDealUpsert(...args),
    },
    deal_network_pilot_participants: {
      findMany: (...args: unknown[]) => mockParticipantFindMany(...args),
      update: (...args: unknown[]) => mockParticipantUpdate(...args),
      upsert: (...args: unknown[]) => mockParticipantUpsert(...args),
    },
  },
}));

import type { RecentDeal } from '@/lib/data/mock-deal-network';
import {
  findOnboardingDealIdByName,
  persistPilotDealForUser,
} from '@/lib/deal-network-demo/pilot-snapshot.server';

const USER = 'user-1';

function incomingDeal(overrides: Partial<RecentDeal> = {}): RecentDeal {
  return {
    id: 'onb-deal-target',
    dealName: 'Launch Event',
    partner: 'Launch Event',
    value: 5000,
    introducer: '—',
    closer: '—',
    status: 'Pending',
    lastUpdated: '2026-08-23T00:00:00.000Z',
    paymentStatus: 'Not Paid',
    projectDescription: 'Updated description',
    projectValueCurrency: 'AUD',
    ...overrides,
  };
}

function expectNoParticipantAccess() {
  expect(mockParticipantFindMany).not.toHaveBeenCalled();
  expect(mockParticipantUpdate).not.toHaveBeenCalled();
  expect(mockParticipantUpsert).not.toHaveBeenCalled();
}

describe('persistPilotDealForUser', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDealUpsert.mockResolvedValue({ id: 'onb-deal-target' });
  });

  it('creates a new deal without loading participants or other deals', async () => {
    mockDealFindFirst.mockResolvedValue(null);

    const incoming = incomingDeal();
    await persistPilotDealForUser(USER, incoming);

    expect(mockDealFindFirst).toHaveBeenCalledWith({
      where: { id: 'onb-deal-target', user_id: USER },
      select: { id: true, deal_payload: true },
    });
    expect(mockDealFindMany).not.toHaveBeenCalled();
    expectNoParticipantAccess();
    expect(mockDealUpsert).toHaveBeenCalledTimes(1);
    expect(mockDealUpsert).toHaveBeenCalledWith({
      where: { id: 'onb-deal-target' },
      create: expect.objectContaining({
        id: 'onb-deal-target',
        user_id: USER,
        name: 'Launch Event',
      }),
      update: expect.objectContaining({
        user_id: USER,
        name: 'Launch Event',
      }),
    });
    const written = mockDealUpsert.mock.calls[0][0].create.deal_payload as RecentDeal;
    expect(written.dealName).toBe('Launch Event');
    expect(written.projectDescription).toBe('Updated description');
    expect(written.conversationImportHistory).toBeUndefined();
  });

  it('replaces incoming project fields and preserves conversation/import history', async () => {
    const history = [
      {
        id: 'import-1',
        importedAt: '2026-05-20T10:00:00.000Z',
        extractedAt: '2026-05-20T10:00:00.000Z',
        sourceType: 'WhatsApp',
        extractorVersion: 'v1',
        entryPoint: 'participant_add',
        rawConversationText: 'Keep this import',
        extractionSummary: {
          oneLiner: 'Import A',
          participantCount: 1,
          fixedFeeObligationCount: 0,
          revenueShareObligationCount: 1,
          hybridParticipantCount: 0,
          attributionCount: 0,
          agreementTypeLabel: '1 revenue share',
          overallConfidence: 'high',
        },
        parties: [],
      },
    ];
    mockDealFindFirst.mockResolvedValue({
      id: 'onb-deal-target',
      deal_payload: {
        id: 'onb-deal-target',
        dealName: 'Old Name',
        conversationImportHistory: history,
      },
    });

    await persistPilotDealForUser(
      USER,
      incomingDeal({ dealName: 'New Name', projectDescription: 'Replaced' })
    );

    expect(mockDealFindMany).not.toHaveBeenCalled();
    expectNoParticipantAccess();
    const written = mockDealUpsert.mock.calls[0][0].update.deal_payload as RecentDeal;
    expect(written.dealName).toBe('New Name');
    expect(written.projectDescription).toBe('Replaced');
    expect(written.conversationImportHistory).toEqual(history);
  });
});

describe('findOnboardingDealIdByName', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('selects the newest matching onboarding deal without hydrating participants', async () => {
    mockDealFindFirst.mockResolvedValue({ id: 'onb-deal-newest' });

    const id = await findOnboardingDealIdByName(USER, '  Launch Event  ');

    expect(id).toBe('onb-deal-newest');
    expect(mockDealFindFirst).toHaveBeenCalledWith({
      where: {
        user_id: USER,
        id: { startsWith: 'onb-deal-' },
        name: 'Launch Event',
      },
      orderBy: { created_at: 'desc' },
      select: { id: true },
    });
    expect(mockDealFindMany).not.toHaveBeenCalled();
    expectNoParticipantAccess();
  });
});
