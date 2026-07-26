/**
 * @jest-environment jsdom
 */

import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import {
  isDevelopmentApprovalSimulatorEnabled,
} from '@/lib/journey/hackathon-journey';
import {
  listParticipantsAwaitingExternalApproval,
  simulateExternalParticipantApprovals,
} from '@/lib/journey/development-approval-simulator.client';
import { resetClientCsrfStateForTests } from '@/lib/security/csrf-fetch.client';

const SIGNED_CSRF_TOKEN = 'csrf-random-part.csrf-signature-part';

function buildParticipant(overrides: Partial<DemoParticipant> = {}): DemoParticipant {
  return {
    id: 'participant-1',
    dealId: 'deal-1',
    name: 'Alex Supplier',
    email: 'alex@example.com',
    inviteToken: 'invite-token-1',
    agreementLifecycle: 'SHARED',
    participantLifecycle: 'INVITE_SENT',
    agreementSharedAt: '2026-07-26T00:00:00.000Z',
    ...overrides,
  } as DemoParticipant;
}

describe('isDevelopmentApprovalSimulatorEnabled', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('is disabled in production unless an explicit demo flag is set', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.DEMO_APPROVAL_SIMULATOR_ENABLED;
    delete process.env.NEXT_PUBLIC_DEMO_APPROVAL_SIMULATOR_ENABLED;
    delete process.env.HACKATHON_JOURNEY_ENABLED;

    expect(isDevelopmentApprovalSimulatorEnabled()).toBe(false);
  });

  it('is enabled in production when the demo flag is set', () => {
    process.env.NODE_ENV = 'production';
    process.env.NEXT_PUBLIC_DEMO_APPROVAL_SIMULATOR_ENABLED = 'true';

    expect(isDevelopmentApprovalSimulatorEnabled()).toBe(true);
  });

  it('is enabled in development by default', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.DEMO_APPROVAL_SIMULATOR_ENABLED;

    expect(isDevelopmentApprovalSimulatorEnabled()).toBe(true);
  });
});

describe('listParticipantsAwaitingExternalApproval', () => {
  it('includes only participants who can approve via the production flow', () => {
    const pending = buildParticipant();
    const approved = buildParticipant({
      id: 'participant-2',
      inviteToken: 'invite-token-2',
      approvalStatus: 'Approved',
      approvedAt: '2026-07-26T01:00:00.000Z',
      agreementLifecycle: 'APPROVED',
      participantLifecycle: 'AGREEMENT_ACCEPTED',
    });
    const draft = buildParticipant({
      id: 'participant-3',
      inviteToken: 'invite-token-3',
      agreementLifecycle: 'GENERATED',
      participantLifecycle: 'INVITE_GENERATED',
      agreementSharedAt: undefined,
    });

    expect(
      listParticipantsAwaitingExternalApproval([pending, approved, draft]).map((p) => p.id),
    ).toEqual(['participant-1']);
  });
});

describe('simulateExternalParticipantApprovals', () => {
  const originalEnv = process.env;
  const originalFetch = global.fetch;

  beforeEach(() => {
    resetClientCsrfStateForTests();
    process.env = { ...originalEnv, NODE_ENV: 'development' };
    jest.useFakeTimers();
  });

  afterEach(() => {
    resetClientCsrfStateForTests();
    process.env = originalEnv;
    global.fetch = originalFetch;
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('does nothing when the simulator is disabled', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.NEXT_PUBLIC_DEMO_APPROVAL_SIMULATOR_ENABLED;

    const fetchMock = jest.fn();
    global.fetch = fetchMock;

    const result = await simulateExternalParticipantApprovals([buildParticipant()]);

    expect(result.approved).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('approves pending participants through the production invite approve route', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ csrfToken: SIGNED_CSRF_TOKEN }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ participant: buildParticipant({ approvalStatus: 'Approved' }) }),
      });
    global.fetch = fetchMock;

    const promise = simulateExternalParticipantApprovals([buildParticipant()], {
      minDelayMs: 3000,
      maxDelayMs: 3000,
    });

    await jest.advanceTimersByTimeAsync(3000);
    const result = await promise;

    expect(result.attempted).toBe(1);
    expect(result.approved).toBe(1);
    expect(result.errors).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/security/csrf-token', {
      credentials: 'include',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/deal-network-pilot/invites/invite-token-1/approve',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
      }),
    );
  });
});
