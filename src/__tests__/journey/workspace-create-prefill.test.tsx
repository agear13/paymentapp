/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { WorkspaceCreateScreen } from '@/components/journey/lovable/workspace-create-screen';
import { WorkspaceProvisioningScreen } from '@/components/journey/lovable/workspace-provisioning-screen';
import { completeJourneyOnboarding } from '@/lib/journey/complete-journey-onboarding.client';
import { persistSourceParticipantHint } from '@/lib/journey/journey-source-participant.client';
import {
  fetchAuthorizedParticipantWorkspacePrefill,
  shouldOfferParticipantWorkspaceNameConfirm,
} from '@/lib/journey/journey-participant-prefill.client';

const mockReplace = jest.fn();
const mockRefresh = jest.fn();
const mockGetSession = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace, refresh: mockRefresh }),
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
      signInWithOAuth: jest.fn(),
    },
  }),
}));

jest.mock('@/lib/journey/complete-journey-onboarding.client', () => ({
  completeJourneyOnboarding: jest.fn().mockResolvedValue({ organizationId: 'org-new' }),
}));

jest.mock('@/lib/security/auth-audit.client', () => ({
  emitAuthAuditEvent: jest.fn(),
}));

jest.mock('@/components/auth/turnstile-widget', () => ({
  TurnstileWidget: () => null,
}));

const mockComplete = completeJourneyOnboarding as jest.Mock;

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as Response;
}

function mockSession(email = 'alex@example.com') {
  mockGetSession.mockResolvedValue({
    data: { session: { user: { id: 'user-1', email } } },
  });
}

describe('participant workspace-name confirm guards', () => {
  it('offers confirm only when there is no organization and a usable suggestion', () => {
    const prefill = {
      sourceParticipantId: 'p-invite-1',
      suggestedWorkspaceName: "Alex's workspace",
      suggestedDisplayName: 'Alex',
    };
    expect(shouldOfferParticipantWorkspaceNameConfirm(false, prefill)).toBe(true);
    expect(shouldOfferParticipantWorkspaceNameConfirm(true, prefill)).toBe(false);
    expect(
      shouldOfferParticipantWorkspaceNameConfirm(false, {
        sourceParticipantId: 'p-invite-1',
        suggestedWorkspaceName: null,
        suggestedDisplayName: null,
      })
    ).toBe(false);
  });

  it('refetches prefill and does not persist the payload', async () => {
    persistSourceParticipantHint('p-invite-1');
    global.fetch = jest.fn(async () =>
      jsonResponse({
        sourceParticipantId: 'p-invite-1',
        suggestedWorkspaceName: "Alex's workspace",
        suggestedDisplayName: 'Alex',
      })
    ) as jest.Mock;

    const prefill = await fetchAuthorizedParticipantWorkspacePrefill();
    expect(prefill.suggestedWorkspaceName).toBe("Alex's workspace");
    expect(sessionStorage.getItem('provvy.journey.suggestedWorkspaceName')).toBeNull();
    expect(localStorage.getItem('provvy.journey.participantPrefill')).toBeNull();
    expect(String((global.fetch as jest.Mock).mock.calls[0]?.[0])).toContain(
      'sourceParticipantId=p-invite-1'
    );
  });
});

describe('workspace provisioning participant-name confirm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();
    mockGetSession.mockResolvedValue({ data: { session: null } });
    persistSourceParticipantHint('p-invite-1');
  });

  it('shows the suggested name and lets the user override it on create', async () => {
    mockSession();
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/auth/turnstile-config')) {
        return jsonResponse({ required: false, siteKey: null });
      }
      if (url === '/api/onboarding') {
        return jsonResponse({ hasOrganization: false });
      }
      if (url.includes('/api/onboarding/participant-prefill')) {
        return jsonResponse({
          sourceParticipantId: 'p-invite-1',
          suggestedWorkspaceName: "Alex's workspace",
          suggestedDisplayName: 'Alex',
        });
      }
      throw new Error(`Unexpected fetch ${url}`);
    }) as jest.Mock;

    render(<WorkspaceCreateScreen />);

    const input = await screen.findByLabelText('Workspace name');
    expect(input).toHaveValue("Alex's workspace");
    expect(mockComplete).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: 'Studio North' } });
    fireEvent.click(screen.getByRole('button', { name: /create workspace/i }));

    await waitFor(() => {
      expect(mockComplete).toHaveBeenCalledWith('alex@example.com', {
        confirmedWorkspaceName: 'Studio North',
      });
    });
    expect(sessionStorage.getItem('provvy.journey.suggestedWorkspaceName')).toBeNull();
    expect(localStorage.getItem('provvy.journey.suggestedWorkspaceName')).toBeNull();
  });

  it('does not apply a participant-derived name when an organization already exists', async () => {
    mockSession();
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/auth/turnstile-config')) {
        return jsonResponse({ required: false, siteKey: null });
      }
      if (url === '/api/onboarding') {
        return jsonResponse({ hasOrganization: true, organizationId: 'org-existing' });
      }
      throw new Error(`Unexpected fetch ${url}`);
    }) as jest.Mock;

    render(<WorkspaceCreateScreen />);

    await waitFor(() => {
      expect(mockComplete).toHaveBeenCalledWith('alex@example.com', {
        confirmedWorkspaceName: undefined,
      });
    });
    expect(screen.queryByLabelText('Workspace name')).not.toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalledWith(
      expect.stringContaining('/api/onboarding/participant-prefill'),
      expect.anything()
    );
  });

  it('continues the existing journey when prefill fails', async () => {
    mockSession();
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/auth/turnstile-config')) {
        return jsonResponse({ required: false, siteKey: null });
      }
      if (url === '/api/onboarding') {
        return jsonResponse({ hasOrganization: false });
      }
      if (url.includes('/api/onboarding/participant-prefill')) {
        return jsonResponse({ error: 'boom' }, false, 500);
      }
      throw new Error(`Unexpected fetch ${url}`);
    }) as jest.Mock;

    render(<WorkspaceCreateScreen />);

    await waitFor(() => {
      expect(mockComplete).toHaveBeenCalledWith('alex@example.com', {
        confirmedWorkspaceName: undefined,
      });
    });
    expect(screen.queryByLabelText('Workspace name')).not.toBeInTheDocument();
  });

  it('continues normally for an invalid or empty prefill', async () => {
    mockSession();
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/auth/turnstile-config')) {
        return jsonResponse({ required: false, siteKey: null });
      }
      if (url === '/api/onboarding') {
        return jsonResponse({ hasOrganization: false });
      }
      if (url.includes('/api/onboarding/participant-prefill')) {
        return jsonResponse({
          sourceParticipantId: null,
          suggestedWorkspaceName: null,
          suggestedDisplayName: null,
        });
      }
      throw new Error(`Unexpected fetch ${url}`);
    }) as jest.Mock;

    render(<WorkspaceCreateScreen />);

    await waitFor(() => {
      expect(mockComplete).toHaveBeenCalled();
    });
    expect(screen.queryByLabelText('Workspace name')).not.toBeInTheDocument();
  });

  it('sends OAuth return users with a suggestion back to the confirm step', async () => {
    mockSession();
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/onboarding') {
        return jsonResponse({ hasOrganization: false });
      }
      if (url.includes('/api/onboarding/participant-prefill')) {
        return jsonResponse({
          sourceParticipantId: 'p-invite-1',
          suggestedWorkspaceName: "Alex's workspace",
          suggestedDisplayName: 'Alex',
        });
      }
      throw new Error(`Unexpected fetch ${url}`);
    }) as jest.Mock;

    render(<WorkspaceProvisioningScreen />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/journey/provisioning');
    });
    expect(mockComplete).not.toHaveBeenCalled();
  });

  it('does not block OAuth provisioning when prefill fails', async () => {
    mockSession();
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/onboarding') {
        return jsonResponse({ hasOrganization: false });
      }
      if (url.includes('/api/onboarding/participant-prefill')) {
        throw new Error('network down');
      }
      throw new Error(`Unexpected fetch ${url}`);
    }) as jest.Mock;

    render(<WorkspaceProvisioningScreen />);

    await waitFor(() => {
      expect(mockComplete).toHaveBeenCalledWith('alex@example.com');
    });
  });
});
