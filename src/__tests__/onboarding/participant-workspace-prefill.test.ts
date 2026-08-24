import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  EMPTY_PARTICIPANT_WORKSPACE_PREFILL,
  extractParticipantOwnedAbnBusinessName,
  parsePrefillSourceParticipantId,
  suggestParticipantWorkspaceName,
} from '@/lib/onboarding/participant-workspace-prefill';
import { loadAuthorizedParticipantWorkspacePrefill } from '@/lib/onboarding/participant-workspace-prefill.server';

jest.mock('@/lib/server/prisma', () => ({
  prisma: {
    deal_network_pilot_participants: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      create: jest.fn(),
    },
  },
}));

const { prisma } = jest.requireMock('@/lib/server/prisma');

const USER = 'user-bound-1';
const OTHER = 'user-other';
const OWNER = 'user-deal-owner';
const P1 = 'p-invite-1';
const P2 = 'p-invite-2';

type Row = {
  id: string;
  authenticated_user_id: string | null;
  name: string | null;
  participant_payload: unknown;
};

const rows: Row[] = [];

function seed(row: Row) {
  rows.push(row);
}

describe('participant workspace-name suggestion', () => {
  it('prefers a participant-owned ABN business name', () => {
    expect(
      suggestParticipantWorkspaceName({
        participantName: 'Alex Rivera',
        abnBusinessName: 'Northwind Promotions',
      })
    ).toEqual({
      suggestedWorkspaceName: 'Northwind Promotions',
      suggestedDisplayName: 'Northwind Promotions',
    });
  });

  it('falls back to "{name}\'s workspace"', () => {
    expect(
      suggestParticipantWorkspaceName({
        participantName: 'Alex Rivera',
        abnBusinessName: '  ',
      })
    ).toEqual({
      suggestedWorkspaceName: "Alex Rivera's workspace",
      suggestedDisplayName: 'Alex Rivera',
    });
  });

  it('returns no suggestion when no usable name exists', () => {
    expect(suggestParticipantWorkspaceName({ participantName: '', abnBusinessName: null })).toEqual({
      suggestedWorkspaceName: null,
      suggestedDisplayName: null,
    });
  });

  it('never treats organiser companyName as an ABN business name', () => {
    expect(
      extractParticipantOwnedAbnBusinessName({
        companyName: 'Organiser Co',
        supplierOnboarding: { abn: { businessName: '' } },
      })
    ).toBeNull();
  });
});

describe('loadAuthorizedParticipantWorkspacePrefill', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    rows.length = 0;
    prisma.deal_network_pilot_participants.findFirst.mockImplementation(
      async ({ where }: { where: { id: string; authenticated_user_id: string } }) => {
        const match = rows.find(
          (row) =>
            row.id === where.id && row.authenticated_user_id === where.authenticated_user_id
        );
        return match
          ? {
              id: match.id,
              name: match.name,
              participant_payload: match.participant_payload,
            }
          : null;
      }
    );
  });

  it('returns an allowlisted suggestion for the bound user and requested id', async () => {
    seed({
      id: P1,
      authenticated_user_id: USER,
      name: 'Alex Rivera',
      participant_payload: { companyName: 'Organiser Co' },
    });

    await expect(loadAuthorizedParticipantWorkspacePrefill(USER, P1)).resolves.toEqual({
      sourceParticipantId: P1,
      suggestedWorkspaceName: "Alex Rivera's workspace",
      suggestedDisplayName: 'Alex Rivera',
    });

    expect(prisma.deal_network_pilot_participants.findFirst).toHaveBeenCalledWith({
      where: { id: P1, authenticated_user_id: USER },
      select: { id: true, name: true, participant_payload: true },
    });
  });

  it('uses ABN business name when it is genuinely present', async () => {
    seed({
      id: P1,
      authenticated_user_id: USER,
      name: 'Alex Rivera',
      participant_payload: {
        companyName: 'Organiser Co',
        supplierOnboarding: {
          abn: { abn: '51824753556', businessName: 'Northwind Promotions' },
          gst: { gstStatus: 'yes' },
          bank: { bsb: '062-000', accountNumber: '12345678' },
        },
        invite_token: 'inv-secret',
        portalToken: 'portal-secret',
        paymentSetupToken: 'pay-secret',
      },
    });

    const prefill = await loadAuthorizedParticipantWorkspacePrefill(USER, P1);
    expect(prefill.suggestedWorkspaceName).toBe('Northwind Promotions');
    expect(JSON.stringify(prefill)).not.toMatch(
      /inv-secret|portal-secret|pay-secret|51824753556|062-000|12345678|Organiser Co/
    );
  });

  it('returns empty suggestions when the bound row has no usable name', async () => {
    seed({
      id: P1,
      authenticated_user_id: USER,
      name: '  ',
      participant_payload: { companyName: 'Organiser Co' },
    });

    await expect(loadAuthorizedParticipantWorkspacePrefill(USER, P1)).resolves.toEqual({
      sourceParticipantId: P1,
      suggestedWorkspaceName: null,
      suggestedDisplayName: null,
    });
  });

  it('returns empty prefill for another user\'s participant id', async () => {
    seed({
      id: P1,
      authenticated_user_id: OTHER,
      name: 'Other Person',
      participant_payload: {},
    });

    await expect(loadAuthorizedParticipantWorkspacePrefill(USER, P1)).resolves.toEqual(
      EMPTY_PARTICIPANT_WORKSPACE_PREFILL
    );
  });

  it('selects only the requested row when two participants are bound to the same user', async () => {
    seed({
      id: P1,
      authenticated_user_id: USER,
      name: 'First',
      participant_payload: {},
    });
    seed({
      id: P2,
      authenticated_user_id: USER,
      name: 'Second',
      participant_payload: {},
    });

    await expect(loadAuthorizedParticipantWorkspacePrefill(USER, P2)).resolves.toEqual({
      sourceParticipantId: P2,
      suggestedWorkspaceName: "Second's workspace",
      suggestedDisplayName: 'Second',
    });
    expect(prisma.deal_network_pilot_participants.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: P2, authenticated_user_id: USER },
      })
    );
    expect(prisma.deal_network_pilot_participants.findMany).not.toHaveBeenCalled();
  });

  it('returns empty prefill for an invalid or stale id', async () => {
    seed({
      id: P1,
      authenticated_user_id: USER,
      name: 'Alex',
      participant_payload: {},
    });

    await expect(loadAuthorizedParticipantWorkspacePrefill(USER, 'x'.repeat(256))).resolves.toEqual(
      EMPTY_PARTICIPANT_WORKSPACE_PREFILL
    );
    await expect(loadAuthorizedParticipantWorkspacePrefill(USER, 'missing-id')).resolves.toEqual(
      EMPTY_PARTICIPANT_WORKSPACE_PREFILL
    );
    expect(parsePrefillSourceParticipantId('x'.repeat(256))).toBeNull();
  });

  it('does not require source_organization_id', async () => {
    seed({
      id: P1,
      authenticated_user_id: USER,
      name: 'Alex',
      participant_payload: {},
    });

    await expect(loadAuthorizedParticipantWorkspacePrefill(USER, P1)).resolves.toMatchObject({
      sourceParticipantId: P1,
      suggestedWorkspaceName: "Alex's workspace",
    });
    const where = prisma.deal_network_pilot_participants.findFirst.mock.calls[0]?.[0]?.where;
    expect(where).not.toHaveProperty('source_organization_id');
    expect(where).not.toHaveProperty('email');
  });

  it('does not prefill for an operator or deal owner who is not the bound authenticated user', async () => {
    seed({
      id: P1,
      authenticated_user_id: null,
      name: 'Alex',
      participant_payload: {},
    });

    await expect(loadAuthorizedParticipantWorkspacePrefill(OWNER, P1)).resolves.toEqual(
      EMPTY_PARTICIPANT_WORKSPACE_PREFILL
    );
  });

  it('is read-only and never writes attribution fields', async () => {
    seed({
      id: P1,
      authenticated_user_id: USER,
      name: 'Alex',
      participant_payload: {},
    });

    await loadAuthorizedParticipantWorkspacePrefill(USER, P1);
    expect(prisma.deal_network_pilot_participants.update).not.toHaveBeenCalled();
    expect(prisma.deal_network_pilot_participants.updateMany).not.toHaveBeenCalled();
    expect(prisma.deal_network_pilot_participants.create).not.toHaveBeenCalled();
  });
});

describe('participant prefill surface', () => {
  it('keeps the API and loader allowlisted and write-free', () => {
    const root = process.cwd();
    const loader = readFileSync(
      join(root, 'lib/onboarding/participant-workspace-prefill.server.ts'),
      'utf8'
    );
    const route = readFileSync(
      join(root, 'app/api/onboarding/participant-prefill/route.ts'),
      'utf8'
    );
    const combined = `${loader}\n${route}`;

    expect(combined).toContain('authenticated_user_id');
    expect(combined).not.toContain('attachParticipantWorkspaceAttribution');
    expect(combined).not.toContain('converted_organization_id');
    expect(combined).not.toContain('converted_at');
    expect(combined).not.toContain('invite_token');
    expect(combined).not.toContain('source_organization_id');
    expect(combined).not.toMatch(/email fallback|findFirst\(\{\s*where:\s*\{\s*email/i);
    expect(loader).toContain('findFirst');
    expect(loader).not.toContain('updateMany');
    expect(loader).not.toContain('.update(');
  });
});
