/** @jest-environment jsdom */

jest.mock('@/lib/security/csrf-fetch.client', () => ({
  csrfAwareFetch: (input: RequestInfo | URL, init?: RequestInit) => fetch(input, init),
}));

import {
  completeJourneyOnboarding,
  resetJourneyOnboardingCompletionForTests,
} from '@/lib/journey/complete-journey-onboarding.client';
import {
  journeyAssessmentContext,
  persistJourneyBusiness,
  persistJourneyObjective,
} from '@/lib/journey/journey-assessment-storage.client';
import {
  persistSourceParticipantHint,
  readStoredSourceParticipantHint,
} from '@/lib/journey/journey-source-participant.client';

describe('completeJourneyOnboarding idempotency', () => {
  const originalFetch = global.fetch;
  const fetchMock = jest.fn();

  beforeEach(() => {
    jest.resetAllMocks();
    resetJourneyOnboardingCompletionForTests();
    sessionStorage.clear();
    localStorage.clear();
    global.fetch = fetchMock as unknown as typeof fetch;

    persistJourneyObjective('reconcile');
    persistJourneyBusiness({ industry: 'Professional services', size: '1–5' });
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('skips bootstrap and patch when assessment is already saved', async () => {
    const objective = 'reconcile';
    const business = { industry: 'Professional services', size: '1–5' };

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        hasOrganization: true,
        organizationId: 'org-123',
        state: {
          onboarding_context: journeyAssessmentContext(objective, business),
          merchantSettingsId: 'merchant-123',
        },
      }),
    });

    const result = await completeJourneyOnboarding('user@company.com');

    expect(result).toEqual({
      organizationId: 'org-123',
      merchantSettingsId: 'merchant-123',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/onboarding');
  });

  it('deduplicates concurrent completion calls', async () => {
    let resolveGet: (value: Response) => void;
    const getPromise = new Promise<Response>((resolve) => {
      resolveGet = resolve;
    });

    fetchMock.mockReturnValueOnce(getPromise);

    const first = completeJourneyOnboarding('user@company.com');
    const second = completeJourneyOnboarding('user@company.com');

    resolveGet!({
      ok: true,
      json: async () => ({
        hasOrganization: true,
        organizationId: 'org-123',
        state: {
          onboarding_context: journeyAssessmentContext('reconcile', {
            industry: 'Professional services',
            size: '1–5',
          }),
          merchantSettingsId: 'merchant-123',
        },
      }),
    } as Response);

    const [a, b] = await Promise.all([first, second]);
    expect(a).toEqual(b);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('sends stored sourceParticipantId on bootstrap and clears it after success', async () => {
    persistSourceParticipantHint('p-invite-1');
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/onboarding') {
        return {
          ok: true,
          json: async () => ({ hasOrganization: false }),
        };
      }
      if (url === '/api/onboarding/bootstrap-workspace') {
        return {
          ok: true,
          json: async () => ({ organizationId: 'org-new', merchantSettingsId: 'ms-1' }),
        };
      }
      if (url === '/api/onboarding' || url.includes('/api/onboarding')) {
        return { ok: true, json: async () => ({}) };
      }
      throw new Error(`Unexpected fetch ${url}`);
    });

    const result = await completeJourneyOnboarding('user@company.com');
    expect(result.organizationId).toBe('org-new');

    const bootstrapCall = fetchMock.mock.calls.find(
      (call) => String(call[0]) === '/api/onboarding/bootstrap-workspace'
    );
    expect(bootstrapCall).toBeTruthy();
    const body = JSON.parse(String((bootstrapCall?.[1] as RequestInit)?.body)) as {
      sourceParticipantId?: string;
    };
    expect(body.sourceParticipantId).toBe('p-invite-1');
    expect(readStoredSourceParticipantHint()).toBeNull();
  });

  it('omits sourceParticipantId when no journey hint is stored', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/onboarding') {
        return { ok: true, json: async () => ({ hasOrganization: false }) };
      }
      if (url === '/api/onboarding/bootstrap-workspace') {
        return {
          ok: true,
          json: async () => ({ organizationId: 'org-new', merchantSettingsId: 'ms-1' }),
        };
      }
      return { ok: true, json: async () => ({}) };
    });

    await completeJourneyOnboarding('user@company.com');
    const bootstrapCall = fetchMock.mock.calls.find(
      (call) => String(call[0]) === '/api/onboarding/bootstrap-workspace'
    );
    const body = JSON.parse(String((bootstrapCall?.[1] as RequestInit)?.body)) as {
      sourceParticipantId?: string;
    };
    expect(body.sourceParticipantId).toBeUndefined();
  });

  it('still bootstraps when reusing an existing org with a participant hint so attribution can attach', async () => {
    persistSourceParticipantHint('p-invite-1');
    const objective = 'reconcile';
    const business = { industry: 'Professional services', size: '1–5' };
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === '/api/onboarding' && init?.method === 'PATCH') {
        throw new Error('matching-assessment reuse with a hint must not PATCH');
      }
      if (url === '/api/onboarding') {
        return {
          ok: true,
          json: async () => ({
            hasOrganization: true,
            organizationId: 'org-123',
            state: {
              onboarding_context: journeyAssessmentContext(objective, business),
              merchantSettingsId: 'merchant-123',
            },
          }),
        };
      }
      if (url === '/api/onboarding/bootstrap-workspace') {
        return {
          ok: true,
          status: 200,
          json: async () => ({ organizationId: 'org-123', merchantSettingsId: 'merchant-123' }),
        };
      }
      throw new Error(`Unexpected fetch ${url}`);
    });

    await completeJourneyOnboarding('user@company.com');
    const bootstrapCall = fetchMock.mock.calls.find(
      (call) => String(call[0]) === '/api/onboarding/bootstrap-workspace'
    );
    expect(bootstrapCall).toBeTruthy();
    const body = JSON.parse(String((bootstrapCall?.[1] as RequestInit)?.body)) as {
      sourceParticipantId?: string;
    };
    expect(body.sourceParticipantId).toBe('p-invite-1');
    expect(readStoredSourceParticipantHint()).toBeNull();
    expect(
      fetchMock.mock.calls.some(
        (call) =>
          String(call[0]) === '/api/onboarding' &&
          (call[1] as RequestInit | undefined)?.method === 'PATCH'
      )
    ).toBe(false);
  });

  it('uses the confirmed workspace name only on genuine create', async () => {
    persistSourceParticipantHint('p-invite-1');
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/onboarding') {
        return { ok: true, json: async () => ({ hasOrganization: false }) };
      }
      if (url === '/api/onboarding/bootstrap-workspace') {
        return {
          ok: true,
          json: async () => ({ organizationId: 'org-new', merchantSettingsId: 'ms-1' }),
        };
      }
      return { ok: true, json: async () => ({}) };
    });

    await completeJourneyOnboarding('user@company.com', {
      confirmedWorkspaceName: '  Studio North  ',
    });

    const bootstrapCall = fetchMock.mock.calls.find(
      (call) => String(call[0]) === '/api/onboarding/bootstrap-workspace'
    );
    const body = JSON.parse(String((bootstrapCall?.[1] as RequestInit)?.body)) as {
      workspaceName?: string;
      defaultCurrency?: string;
    };
    expect(body.workspaceName).toBe('Studio North');
    expect(body.defaultCurrency).toBe('AUD');
    expect(readStoredSourceParticipantHint()).toBeNull();
    expect(sessionStorage.getItem('provvy.journey.suggestedWorkspaceName')).toBeNull();
    expect(localStorage.getItem('provvy.journey.suggestedWorkspaceName')).toBeNull();
  });

  it('does not PATCH onboarding state after bootstrap reuse, even when assessment mismatches', async () => {
    persistSourceParticipantHint('p-invite-1');
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === '/api/onboarding' && init?.method === 'PATCH') {
        throw new Error('reuse must not PATCH onboarding');
      }
      if (url === '/api/onboarding') {
        return {
          ok: true,
          json: async () => ({
            hasOrganization: true,
            organizationId: 'org-123',
            state: {
              step: 'complete',
              completed: true,
              completedAt: '2026-08-01T00:00:00.000Z',
              projectId: 'deal-1',
              onboarding_context: 'Event Settlement',
              merchantSettingsId: 'merchant-123',
            },
          }),
        };
      }
      if (url === '/api/onboarding/bootstrap-workspace') {
        return {
          ok: true,
          status: 200,
          json: async () => ({ organizationId: 'org-123', merchantSettingsId: 'merchant-123' }),
        };
      }
      throw new Error(`Unexpected fetch ${url}`);
    });

    const result = await completeJourneyOnboarding('user@company.com');
    expect(result.organizationId).toBe('org-123');
    expect(readStoredSourceParticipantHint()).toBeNull();
    expect(
      fetchMock.mock.calls.some(
        (call) =>
          String(call[0]) === '/api/onboarding' &&
          (call[1] as RequestInit | undefined)?.method === 'PATCH'
      )
    ).toBe(false);
  });

  it('does not PATCH after reuse when local assessment is empty', async () => {
    sessionStorage.clear();
    localStorage.clear();
    persistSourceParticipantHint('p-invite-1');
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === '/api/onboarding' && init?.method === 'PATCH') {
        throw new Error('empty assessment reuse must not PATCH');
      }
      if (url === '/api/onboarding') {
        return {
          ok: true,
          json: async () => ({
            hasOrganization: true,
            organizationId: 'org-123',
            state: {
              completed: true,
              projectId: 'deal-1',
              onboarding_context: 'Event Settlement',
              merchantSettingsId: 'merchant-123',
            },
          }),
        };
      }
      if (url === '/api/onboarding/bootstrap-workspace') {
        return {
          ok: true,
          status: 200,
          json: async () => ({ organizationId: 'org-123', merchantSettingsId: 'merchant-123' }),
        };
      }
      throw new Error(`Unexpected fetch ${url}`);
    });

    await completeJourneyOnboarding('alex@example.com');
    expect(
      fetchMock.mock.calls.some(
        (call) => (call[1] as RequestInit | undefined)?.method === 'PATCH'
      )
    ).toBe(false);
  });

  it('PATCHes the initial journey snapshot only after a genuine create', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === '/api/onboarding' && (!init?.method || init.method === 'GET')) {
        return { ok: true, json: async () => ({ hasOrganization: false }) };
      }
      if (url === '/api/onboarding/bootstrap-workspace') {
        return {
          ok: true,
          status: 201,
          json: async () => ({ organizationId: 'org-new', merchantSettingsId: 'ms-1' }),
        };
      }
      if (url === '/api/onboarding' && init?.method === 'PATCH') {
        return { ok: true, json: async () => ({ ok: true }) };
      }
      throw new Error(`Unexpected fetch ${url}`);
    });

    await completeJourneyOnboarding('user@company.com');
    const patchCall = fetchMock.mock.calls.find(
      (call) =>
        String(call[0]) === '/api/onboarding' &&
        (call[1] as RequestInit | undefined)?.method === 'PATCH'
    );
    expect(patchCall).toBeTruthy();
    const body = JSON.parse(String((patchCall?.[1] as RequestInit)?.body)) as {
      state?: { step?: string; workspace_name?: string };
    };
    expect(body.state?.step).toBe('use_case');
    expect(body.state?.workspace_name).toBe('Professional services');
  });

  it('ignores a participant-derived name when reusing an existing organization', async () => {
    persistSourceParticipantHint('p-invite-1');
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/onboarding') {
        return {
          ok: true,
          json: async () => ({
            hasOrganization: true,
            organizationId: 'org-123',
            state: {
              onboarding_context: journeyAssessmentContext('reconcile', {
                industry: 'Retail',
                size: '1–5',
              }),
              merchantSettingsId: 'merchant-123',
            },
          }),
        };
      }
      if (url === '/api/onboarding/bootstrap-workspace') {
        return {
          ok: true,
          json: async () => ({ organizationId: 'org-123', merchantSettingsId: 'merchant-123' }),
        };
      }
      return { ok: true, json: async () => ({}) };
    });

    await completeJourneyOnboarding('user@company.com', {
      confirmedWorkspaceName: 'Apex Promotions',
    });

    const bootstrapCall = fetchMock.mock.calls.find(
      (call) => String(call[0]) === '/api/onboarding/bootstrap-workspace'
    );
    expect(bootstrapCall).toBeTruthy();
    const body = JSON.parse(String((bootstrapCall?.[1] as RequestInit)?.body)) as {
      workspaceName?: string;
      defaultCurrency?: string;
    };
    expect(body.workspaceName).toBe('Professional services');
    expect(body.workspaceName).not.toBe('Apex Promotions');
    expect(body.defaultCurrency).toBe('AUD');
    expect(readStoredSourceParticipantHint()).toBeNull();
  });

  it('retains the source participant hint when bootstrap fails', async () => {
    persistSourceParticipantHint('p-invite-1');
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/onboarding') {
        return { ok: true, json: async () => ({ hasOrganization: false }) };
      }
      if (url === '/api/onboarding/bootstrap-workspace') {
        return { ok: false, json: async () => ({ error: 'create failed' }) };
      }
      throw new Error(`Unexpected fetch ${url}`);
    });

    await expect(
      completeJourneyOnboarding('user@company.com', {
        confirmedWorkspaceName: 'Studio North',
      })
    ).rejects.toThrow('create failed');
    expect(readStoredSourceParticipantHint()).toBe('p-invite-1');
  });
});
