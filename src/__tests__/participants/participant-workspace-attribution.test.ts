import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  attachParticipantWorkspaceAttribution,
  parseSourceParticipantHint,
  readSourceParticipantHint,
  resolveCreateTimeSourceOrganizationId,
  resolveSyncCreateSourceOrganizationId,
} from '@/lib/participants/participant-workspace-attribution.server';
import { proveSourceOrganizationFromWorkflow } from '@/lib/workflows/prove-source-organization.server';
import { createPilotParticipantForUser } from '@/lib/deal-network-demo/pilot-snapshot.server';

jest.mock('@/lib/server/prisma', () => ({
  prisma: {
    organization_workflows: {
      findUnique: jest.fn(),
    },
    user_organizations: {
      findUnique: jest.fn(),
    },
    organizations: {
      findUnique: jest.fn(),
    },
    deal_network_pilot_participants: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
    },
    deal_network_pilot_deals: {
      findFirst: jest.fn(),
    },
    commission_obligations: {
      create: jest.fn(),
    },
    payouts: {
      create: jest.fn(),
    },
  },
}));

jest.mock('@/lib/logger', () => ({
  log: { warn: jest.fn(), info: jest.fn(), error: jest.fn() },
}));

const { prisma } = jest.requireMock('@/lib/server/prisma');

const WF = 'wf-11111111-1111-1111-1111-111111111111';
const SOURCE_ORG = 'org-source-1111-1111-1111-111111111111';
const NEW_ORG = 'org-new-2222-2222-2222-222222222222';
const OLDEST_ORG = 'org-oldest-0000-0000-0000-000000000000';
const USER = 'user-participant-1';
const OTHER_USER = 'user-other';
const PARTICIPANT = 'p-invite-1';

function eligibleRow(overrides: Record<string, unknown> = {}) {
  return {
    id: PARTICIPANT,
    source_organization_id: SOURCE_ORG,
    deal_id: 'deal-1',
    deal: { id: 'deal-1' },
    source_organization: { id: SOURCE_ORG },
    ...overrides,
  };
}

describe('proveSourceOrganizationFromWorkflow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns the workflow organization after membership on that org is proven', async () => {
    prisma.organization_workflows.findUnique.mockResolvedValue({ organization_id: SOURCE_ORG });
    prisma.user_organizations.findUnique.mockResolvedValue({ id: 'mem-1' });

    await expect(proveSourceOrganizationFromWorkflow(WF, USER)).resolves.toBe(SOURCE_ORG);

    expect(prisma.organization_workflows.findUnique).toHaveBeenCalledWith({
      where: { id: WF },
      select: { organization_id: true },
    });
    expect(prisma.user_organizations.findUnique).toHaveBeenCalledWith({
      where: {
        user_id_organization_id: {
          user_id: USER,
          organization_id: SOURCE_ORG,
        },
      },
      select: { id: true },
    });
  });

  it('never uses oldest membership as the source organization', async () => {
    prisma.organization_workflows.findUnique.mockResolvedValue({ organization_id: SOURCE_ORG });
    prisma.user_organizations.findUnique.mockImplementation(
      async ({
        where,
      }: {
        where: { user_id_organization_id: { organization_id: string } };
      }) =>
        where.user_id_organization_id.organization_id === SOURCE_ORG ? { id: 'mem-source' } : null
    );

    await expect(proveSourceOrganizationFromWorkflow(WF, USER)).resolves.toBe(SOURCE_ORG);
    expect(prisma.user_organizations.findUnique).not.toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          user_id_organization_id: expect.objectContaining({ organization_id: OLDEST_ORG }),
        },
      })
    );
  });

  it('returns null when the actor is not a member of the workflow organization', async () => {
    prisma.organization_workflows.findUnique.mockResolvedValue({ organization_id: SOURCE_ORG });
    prisma.user_organizations.findUnique.mockResolvedValue(null);
    await expect(proveSourceOrganizationFromWorkflow(WF, USER)).resolves.toBeNull();
  });

  it('returns null when the workflow does not exist', async () => {
    prisma.organization_workflows.findUnique.mockResolvedValue(null);
    await expect(proveSourceOrganizationFromWorkflow(WF, USER)).resolves.toBeNull();
    expect(prisma.user_organizations.findUnique).not.toHaveBeenCalled();
  });
});

describe('createPilotParticipantForUser source stamp', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.deal_network_pilot_deals.findFirst.mockResolvedValue({ id: 'deal-1' });
    prisma.deal_network_pilot_participants.findUnique.mockResolvedValue(null);
    prisma.deal_network_pilot_participants.create.mockResolvedValue({
      id: PARTICIPANT,
      deal_id: 'deal-1',
      invite_token: 'invite-1',
      participant_payload: {
        id: PARTICIPANT,
        dealId: 'deal-1',
        inviteToken: 'invite-1',
        name: 'Apex',
        role: 'Promoter',
        approvalStatus: 'Pending approval',
      },
      name: 'Apex',
      email: 'apex@example.com',
      authenticated_user_id: null,
    });
  });

  const participant = {
    id: PARTICIPANT,
    name: 'Apex',
    email: 'apex@example.com',
    role: 'Promoter',
    status: 'Pending',
    approvalStatus: 'Pending approval',
    inviteToken: 'invite-1',
    dealId: 'deal-1',
  } as const;

  it('leaves source null when no proven organization is supplied', async () => {
    await createPilotParticipantForUser(USER, {
      ...participant,
      organizationId: 'client-supplied-org',
      sourceOrganizationId: 'client-supplied-org',
    } as never);

    const data = prisma.deal_network_pilot_participants.create.mock.calls[0][0].data as {
      source_organization_id?: string;
    };
    expect(data.source_organization_id).toBeUndefined();
  });

  it('writes only an explicit proven source organization id', async () => {
    await createPilotParticipantForUser(USER, participant as never, {
      sourceOrganizationId: SOURCE_ORG,
    });
    const data = prisma.deal_network_pilot_participants.create.mock.calls[0][0].data as {
      source_organization_id?: string;
    };
    expect(data.source_organization_id).toBe(SOURCE_ORG);
  });
});

describe('create-time source organization helpers', () => {
  it('writes only an explicitly provided source organization', () => {
    expect(resolveCreateTimeSourceOrganizationId(SOURCE_ORG)).toBe(SOURCE_ORG);
    expect(resolveCreateTimeSourceOrganizationId(null)).toBeNull();
    expect(resolveCreateTimeSourceOrganizationId(undefined)).toBeNull();
    expect(resolveCreateTimeSourceOrganizationId('')).toBeNull();
  });

  it('does not stamp existing rows during snapshot sync', () => {
    expect(
      resolveSyncCreateSourceOrganizationId({
        participantId: PARTICIPANT,
        alreadyPersisted: true,
        provenSourceOrganizationId: SOURCE_ORG,
        stampParticipantIds: new Set([PARTICIPANT]),
      })
    ).toBeNull();
  });

  it('stamps only new ids listed by a proven workflow write', () => {
    expect(
      resolveSyncCreateSourceOrganizationId({
        participantId: PARTICIPANT,
        alreadyPersisted: false,
        provenSourceOrganizationId: SOURCE_ORG,
        stampParticipantIds: new Set([PARTICIPANT]),
      })
    ).toBe(SOURCE_ORG);
    expect(
      resolveSyncCreateSourceOrganizationId({
        participantId: 'other',
        alreadyPersisted: false,
        provenSourceOrganizationId: SOURCE_ORG,
        stampParticipantIds: new Set([PARTICIPANT]),
      })
    ).toBeNull();
  });
});

describe('source participant hint parsing', () => {
  it('treats missing or blank values as absent', () => {
    expect(parseSourceParticipantHint(undefined)).toEqual({ kind: 'absent' });
    expect(parseSourceParticipantHint('')).toEqual({ kind: 'absent' });
    expect(parseSourceParticipantHint('  ')).toEqual({ kind: 'absent' });
  });

  it('marks non-string or oversized values invalid without failing callers', () => {
    expect(parseSourceParticipantHint(123)).toEqual({ kind: 'invalid' });
    expect(parseSourceParticipantHint({ id: PARTICIPANT })).toEqual({ kind: 'invalid' });
    expect(parseSourceParticipantHint('x'.repeat(256))).toEqual({ kind: 'invalid' });
  });

  it('prefers sourceParticipantId then participantId then the query string', () => {
    expect(
      readSourceParticipantHint({
        body: { sourceParticipantId: PARTICIPANT, participantId: 'other' },
      })
    ).toEqual({ kind: 'hint', value: PARTICIPANT });
    expect(
      readSourceParticipantHint({
        searchParams: new URLSearchParams({ participantId: PARTICIPANT }),
      })
    ).toEqual({ kind: 'hint', value: PARTICIPANT });
  });
});

describe('attachParticipantWorkspaceAttribution', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user_organizations.findUnique.mockResolvedValue({ role: 'OWNER' });
    prisma.organizations.findUnique.mockResolvedValue({ id: NEW_ORG });
    prisma.deal_network_pilot_participants.findMany.mockResolvedValue([eligibleRow()]);
    prisma.deal_network_pilot_participants.updateMany.mockResolvedValue({ count: 1 });
  });

  it('attaches the single eligible participant after a genuine new organization', async () => {
    const result = await attachParticipantWorkspaceAttribution({
      userId: USER,
      newOrganizationId: NEW_ORG,
    });
    expect(result).toEqual({ attached: true, participantId: PARTICIPANT });
    expect(prisma.deal_network_pilot_participants.updateMany).toHaveBeenCalledWith({
      where: {
        id: PARTICIPANT,
        authenticated_user_id: USER,
        converted_organization_id: null,
        source_organization_id: { not: null },
        NOT: { source_organization_id: NEW_ORG },
      },
      data: {
        converted_organization_id: NEW_ORG,
        converted_at: expect.any(Date),
      },
    });
  });

  it('writes no attribution when there are zero eligible participants', async () => {
    prisma.deal_network_pilot_participants.findMany.mockResolvedValue([]);
    await expect(
      attachParticipantWorkspaceAttribution({ userId: USER, newOrganizationId: NEW_ORG })
    ).resolves.toEqual({ attached: false, participantId: null });
    expect(prisma.deal_network_pilot_participants.updateMany).not.toHaveBeenCalled();
  });

  it('writes no attribution when multiple eligible participants have no hint', async () => {
    prisma.deal_network_pilot_participants.findMany.mockResolvedValue([
      eligibleRow(),
      eligibleRow({ id: 'p-invite-2' }),
    ]);
    await expect(
      attachParticipantWorkspaceAttribution({ userId: USER, newOrganizationId: NEW_ORG })
    ).resolves.toEqual({ attached: false, participantId: null });
    expect(prisma.deal_network_pilot_participants.updateMany).not.toHaveBeenCalled();
  });

  it('attaches the hinted participant among multiple eligible invitations', async () => {
    prisma.deal_network_pilot_participants.findMany.mockResolvedValue([
      eligibleRow(),
      eligibleRow({ id: 'p-invite-2' }),
    ]);
    await expect(
      attachParticipantWorkspaceAttribution({
        userId: USER,
        newOrganizationId: NEW_ORG,
        hint: { kind: 'hint', value: 'p-invite-2' },
      })
    ).resolves.toEqual({ attached: true, participantId: 'p-invite-2' });
    expect(prisma.deal_network_pilot_participants.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: 'p-invite-2' }) })
    );
  });

  it('writes no attribution for an invalid or unknown hint', async () => {
    await expect(
      attachParticipantWorkspaceAttribution({
        userId: USER,
        newOrganizationId: NEW_ORG,
        hint: { kind: 'invalid' },
      })
    ).resolves.toEqual({ attached: false, participantId: null });

    prisma.deal_network_pilot_participants.findMany.mockResolvedValue([eligibleRow()]);
    await expect(
      attachParticipantWorkspaceAttribution({
        userId: USER,
        newOrganizationId: NEW_ORG,
        hint: { kind: 'hint', value: 'missing-id' },
      })
    ).resolves.toEqual({ attached: false, participantId: null });
    expect(prisma.deal_network_pilot_participants.updateMany).not.toHaveBeenCalled();
  });

  it('cannot attach a participant bound to another authenticated user', async () => {
    prisma.deal_network_pilot_participants.findMany.mockResolvedValue([]);
    await attachParticipantWorkspaceAttribution({
      userId: OTHER_USER,
      newOrganizationId: NEW_ORG,
    });
    expect(prisma.deal_network_pilot_participants.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ authenticated_user_id: OTHER_USER }),
      })
    );
    expect(prisma.deal_network_pilot_participants.updateMany).not.toHaveBeenCalled();
  });

  it('does not overwrite an already converted participant', async () => {
    prisma.deal_network_pilot_participants.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      attachParticipantWorkspaceAttribution({ userId: USER, newOrganizationId: NEW_ORG })
    ).resolves.toEqual({ attached: false, participantId: null });
  });

  it('does not attach when the source organization equals the new organization', async () => {
    prisma.deal_network_pilot_participants.findMany.mockResolvedValue([]);
    await attachParticipantWorkspaceAttribution({
      userId: USER,
      newOrganizationId: SOURCE_ORG,
    });
    expect(prisma.deal_network_pilot_participants.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          NOT: { source_organization_id: SOURCE_ORG },
        }),
      })
    );
    expect(prisma.deal_network_pilot_participants.updateMany).not.toHaveBeenCalled();
  });

  it('fails closed when the unique converted organization constraint is hit', async () => {
    prisma.deal_network_pilot_participants.updateMany.mockRejectedValue({ code: 'P2002' });
    await expect(
      attachParticipantWorkspaceAttribution({ userId: USER, newOrganizationId: NEW_ORG })
    ).resolves.toEqual({ attached: false, participantId: null });
  });

  it('does not bind participants or write commission or payout records', async () => {
    await attachParticipantWorkspaceAttribution({
      userId: USER,
      newOrganizationId: NEW_ORG,
    });
    const update = prisma.deal_network_pilot_participants.updateMany.mock.calls[0][0];
    expect(update.data).toEqual({
      converted_organization_id: NEW_ORG,
      converted_at: expect.any(Date),
    });
    expect(update.data.authenticated_user_id).toBeUndefined();
    expect(prisma.commission_obligations.create).not.toHaveBeenCalled();
    expect(prisma.payouts.create).not.toHaveBeenCalled();
  });
});

describe('attribution safety isolation', () => {
  const srcRoot = process.cwd();

  it('does not let generic invitation paths prove or stamp source organization', () => {
    const unattributed = [
      'app/api/onboarding/participants/route.ts',
      'app/api/deal-network-pilot/participants/route.ts',
      'app/api/deal-network-pilot/snapshot/route.ts',
      'app/api/onboarding/bootstrap-project/route.ts',
      'lib/participants/coordinate-commercial-participant.server.ts',
    ];
    for (const file of unattributed) {
      const source = readFileSync(join(srcRoot, file), 'utf8');
      expect(source).not.toContain('proveSourceOrganizationFromWorkflow');
      expect(source).not.toContain('sourceOrganizationIdForNewIds');
      expect(source).not.toContain('source_organization_id');
    }
  });

  it('does not resolve source from oldest membership or deal-org inference helpers', () => {
    const prove = readFileSync(join(srcRoot, 'lib/workflows/prove-source-organization.server.ts'), 'utf8');
    expect(prove).not.toContain('getOrganizationForAuthenticatedUser');
    expect(prove).not.toContain('resolveOrganizationIdForPilotDeal');
    expect(prove).not.toContain('resolveOrganizationIdForOperator');

    const create = readFileSync(join(srcRoot, 'lib/deal-network-demo/pilot-snapshot.server.ts'), 'utf8');
    const createFn = create.slice(create.indexOf('export async function createPilotParticipantForUser'));
    const createBody = createFn.slice(0, createFn.indexOf('export async function getParticipantByInviteToken'));
    expect(createBody).not.toContain('getOrganizationForAuthenticatedUser');
    expect(createBody).not.toContain('resolveOrganizationIdForPilotDeal');
  });

  it('does not accept a client organization id on the prove helper', () => {
    const prove = readFileSync(join(srcRoot, 'lib/workflows/prove-source-organization.server.ts'), 'utf8');
    expect(prove).toContain('workflowId');
    expect(prove).toContain('actorUserId');
    expect(prove).not.toMatch(/organizationId:\s*string/);
  });
});
