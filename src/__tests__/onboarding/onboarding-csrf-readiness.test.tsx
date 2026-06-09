/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import { CSRF_PREPARING_LABEL, useClientCsrfReady } from '@/hooks/use-client-csrf-ready';
import {
  csrfAwareFetch,
  resetClientCsrfStateForTests,
} from '@/lib/security/csrf-fetch.client';

const SIGNED_TOKEN = 'csrf-random-part.csrf-signature-part';

function CsrfReadinessProbe() {
  const { isReady, isPreparing } = useClientCsrfReady();

  return (
    <div>
      <span data-testid="csrf-ready">{isReady ? 'ready' : 'pending'}</span>
      <span data-testid="csrf-preparing">{isPreparing ? 'preparing' : 'idle'}</span>
      <button type="button" disabled={!isReady} data-testid="workspace-submit">
        {isPreparing ? CSRF_PREPARING_LABEL : 'Continue'}
      </button>
    </div>
  );
}

describe('onboarding CSRF readiness UX', () => {
  const originalFetch = global.fetch;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    resetClientCsrfStateForTests();
    fetchMock = jest.fn();
    global.fetch = fetchMock;
  });

  afterEach(() => {
    resetClientCsrfStateForTests();
    global.fetch = originalFetch;
  });

  it('disables onboarding submit and shows preparing state before the token is ready', async () => {
    let resolveBootstrap: (() => void) | null = null;
    const bootstrapPromise = new Promise<Response>((resolve) => {
      resolveBootstrap = () =>
        resolve({
          ok: true,
          json: async () => ({ csrfToken: SIGNED_TOKEN }),
        } as Response);
    });

    fetchMock.mockReturnValueOnce(bootstrapPromise);

    render(<CsrfReadinessProbe />);

    expect(screen.getByTestId('csrf-ready')).toHaveTextContent('pending');
    expect(screen.getByTestId('csrf-preparing')).toHaveTextContent('preparing');
    expect(screen.getByTestId('workspace-submit')).toBeDisabled();
    expect(screen.getByTestId('workspace-submit')).toHaveTextContent(CSRF_PREPARING_LABEL);

    await act(async () => {
      resolveBootstrap?.();
      await bootstrapPromise;
    });

    await waitFor(() => {
      expect(screen.getByTestId('csrf-ready')).toHaveTextContent('ready');
    });

    expect(screen.getByTestId('workspace-submit')).toBeEnabled();
    expect(screen.getByTestId('workspace-submit')).toHaveTextContent('Continue');
  });

  it('allows onboarding submit after the token is ready', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ csrfToken: SIGNED_TOKEN }),
    });

    render(<CsrfReadinessProbe />);

    await waitFor(() => {
      expect(screen.getByTestId('csrf-ready')).toHaveTextContent('ready');
    });

    const button = screen.getByTestId('workspace-submit');
    expect(button).toBeEnabled();

    fireEvent.click(button);

    expect(button).toHaveTextContent('Continue');
  });
});

describe('onboarding workspace mutation after CSRF bootstrap', () => {
  const originalFetch = global.fetch;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    resetClientCsrfStateForTests();
    fetchMock = jest.fn();
    global.fetch = fetchMock;
  });

  afterEach(() => {
    resetClientCsrfStateForTests();
    global.fetch = originalFetch;
  });

  it('does not call bootstrap-workspace until CSRF bootstrap completes', async () => {
    const callOrder: string[] = [];

    fetchMock.mockImplementation(async (url: string) => {
      callOrder.push(url);

      if (url === '/api/security/csrf-token') {
        return {
          ok: true,
          json: async () => ({ csrfToken: SIGNED_TOKEN }),
        };
      }

      if (url === '/api/onboarding/bootstrap-workspace') {
        return {
          ok: true,
          json: async () => ({ data: { organizationId: 'org_1', merchantSettingsId: 'ms_1' } }),
        };
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    await csrfAwareFetch('/api/onboarding/bootstrap-workspace', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspaceName: 'Island Events Co.',
        defaultCurrency: 'USD',
      }),
    });

    expect(callOrder).toEqual([
      '/api/security/csrf-token',
      '/api/onboarding/bootstrap-workspace',
    ]);
  });
});
