/** @jest-environment jsdom */

import {
  completeJourneyOnboarding,
  resetJourneyOnboardingCompletionForTests,
} from '@/lib/journey/complete-journey-onboarding.client';
import {
  journeyAssessmentContext,
  persistJourneyBusiness,
  persistJourneyObjective,
} from '@/lib/journey/journey-assessment-storage.client';

describe('completeJourneyOnboarding idempotency', () => {
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
});
