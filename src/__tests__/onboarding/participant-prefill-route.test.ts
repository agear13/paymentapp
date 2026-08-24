import { NextRequest } from 'next/server';
import { GET } from '@/app/api/onboarding/participant-prefill/route';

jest.mock('@/lib/auth/session', () => ({
  getCurrentUser: jest.fn(),
}));

jest.mock('@/lib/onboarding/participant-workspace-prefill.server', () => ({
  loadAuthorizedParticipantWorkspacePrefill: jest.fn(),
}));

import { getCurrentUser } from '@/lib/auth/session';
import { loadAuthorizedParticipantWorkspacePrefill } from '@/lib/onboarding/participant-workspace-prefill.server';
import { EMPTY_PARTICIPANT_WORKSPACE_PREFILL } from '@/lib/onboarding/participant-workspace-prefill';

const mockGetCurrentUser = getCurrentUser as jest.Mock;
const mockLoad = loadAuthorizedParticipantWorkspacePrefill as jest.Mock;

function request(search = 'sourceParticipantId=p-invite-1') {
  return new NextRequest(`http://localhost/api/onboarding/participant-prefill?${search}`);
}

const ALLOWLIST = ['sourceParticipantId', 'suggestedDisplayName', 'suggestedWorkspaceName'];

describe('GET /api/onboarding/participant-prefill', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue({ id: 'user-bound-1', email: 'alex@example.com' });
    mockLoad.mockResolvedValue({
      sourceParticipantId: 'p-invite-1',
      suggestedWorkspaceName: "Alex's workspace",
      suggestedDisplayName: 'Alex',
    });
  });

  it('requires an authenticated session', async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const response = await GET(request());
    expect(response.status).toBe(401);
    expect(mockLoad).not.toHaveBeenCalled();
  });

  it('returns only the allowlisted personalization fields', async () => {
    const response = await GET(request());
    expect(response.status).toBe(200);
    const json = (await response.json()) as Record<string, unknown>;
    expect(Object.keys(json).sort()).toEqual([...ALLOWLIST].sort());
    expect(json).toEqual({
      sourceParticipantId: 'p-invite-1',
      suggestedWorkspaceName: "Alex's workspace",
      suggestedDisplayName: 'Alex',
    });
    expect(mockLoad).toHaveBeenCalledWith('user-bound-1', 'p-invite-1');
  });

  it('returns empty prefill rather than leaking when the loader finds nothing', async () => {
    mockLoad.mockResolvedValue(EMPTY_PARTICIPANT_WORKSPACE_PREFILL);
    const response = await GET(request('sourceParticipantId=stale-id'));
    expect(response.status).toBe(200);
    const json = (await response.json()) as Record<string, unknown>;
    expect(json).toEqual(EMPTY_PARTICIPANT_WORKSPACE_PREFILL);
    expect(Object.keys(json).sort()).toEqual([...ALLOWLIST].sort());
    expect(JSON.stringify(json)).not.toMatch(
      /invite_token|portal|paymentSetup|bsb|accountNumber|gst|source_organization|converted_organization|commission|payout|merchant_settings/i
    );
  });

  it('does not accept write methods as a mutation surface', async () => {
    const route = await import('@/app/api/onboarding/participant-prefill/route');
    expect(route).toHaveProperty('GET');
    expect(route).not.toHaveProperty('POST');
    expect(route).not.toHaveProperty('PATCH');
    expect(route).not.toHaveProperty('PUT');
  });
});
