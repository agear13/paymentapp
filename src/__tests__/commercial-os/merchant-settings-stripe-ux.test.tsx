/** @jest-environment jsdom */

import '@testing-library/jest-dom';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

import { MerchantSettingsForm } from '@/components/dashboard/settings/merchant-settings-form';
import {
  buildMerchantSettingsUpdatePayload,
  deriveStripeSetupDisplayStatus,
  isStripePersistedConnected,
} from '@/lib/settings/merchant-settings-section-save';
import { toast } from 'sonner';

jest.mock('@/hooks/use-organization', () => ({
  useOrganization: () => ({
    organizationId: 'org-test-1',
    organization: { id: 'org-test-1', name: 'Test Org' },
    isLoading: false,
    error: null,
  }),
}));

jest.mock('@/hooks/use-workspace-activation', () => ({
  notifyWorkspaceActivationRefresh: jest.fn(),
}));

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

beforeAll(() => {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

const SETTINGS_ID = 'settings-1';

function merchantSettingsRow(stripeAccountId: string | null) {
  return {
    id: SETTINGS_ID,
    display_name: 'Test Org',
    organization_logo_url: '',
    default_currency: 'AUD',
    stripe_account_id: stripeAccountId,
    hedera_account_id: null,
    wise_profile_id: null,
    wise_enabled: false,
    wise_currency: null,
    evm_wallet_enabled: false,
    evm_wallet_address: null,
    evm_supported_networks: [],
    evm_supported_tokens: [],
    _features: { wiseGloballyEnabled: false, evmGloballyEnabled: false },
  };
}

function resolveFetchUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  if (typeof input === 'object' && input !== null && 'url' in input) {
    return String((input as Request).url);
  }
  return String(input);
}

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

function installMerchantSettingsFetch(options: {
  initialStripe: string | null;
  afterSaveStripe?: string | null;
  patchStatus?: number;
  patchError?: string;
}) {
  let persistedStripe = options.initialStripe;

  global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = resolveFetchUrl(input);
    const method = init?.method ?? 'GET';

    if (url.includes('/api/merchant-settings?') && method === 'GET') {
      return jsonResponse([merchantSettingsRow(persistedStripe)]);
    }

    if (url.includes(`/api/merchant-settings/${SETTINGS_ID}`) && method === 'PATCH') {
      if (options.patchStatus && options.patchStatus >= 400) {
        return jsonResponse({ error: options.patchError ?? 'Save failed' }, options.patchStatus);
      }

      const body = JSON.parse(String(init?.body ?? '{}')) as { stripeAccountId?: string };
      if (body.stripeAccountId) {
        persistedStripe = options.afterSaveStripe ?? body.stripeAccountId;
      }

      return jsonResponse({ settings: { id: SETTINGS_ID } });
    }

    if (url.endsWith('/api/merchant-settings') && method === 'POST') {
      const body = JSON.parse(String(init?.body ?? '{}')) as { stripeAccountId?: string };
      if (body.stripeAccountId) {
        persistedStripe = options.afterSaveStripe ?? body.stripeAccountId;
      }
      return jsonResponse({ settings: { id: SETTINGS_ID } }, 201);
    }

    return jsonResponse({ error: `Unexpected request: ${method} ${url}` }, 500);
  }) as jest.Mock;
}

function stripeStatus() {
  return within(screen.getByTestId('stripe-connect-setup-status'));
}

async function waitForProvidersForm() {
  await waitFor(() => {
    expect(screen.getByPlaceholderText('acct_xxxxxxxxxxxxx')).toBeInTheDocument();
  });
}

describe('merchant settings stripe UX helpers', () => {
  it('reports setup required when no persisted Stripe account exists', () => {
    expect(deriveStripeSetupDisplayStatus('', '')).toBe('setup_required');
    expect(isStripePersistedConnected('')).toBe(false);
  });

  it('reports connected from persisted database value when form matches', () => {
    expect(deriveStripeSetupDisplayStatus('acct_live_123', 'acct_live_123')).toBe('connected');
    expect(isStripePersistedConnected('acct_live_123')).toBe(true);
  });

  it('reports unsaved changes when form value differs from persisted value', () => {
    expect(deriveStripeSetupDisplayStatus('acct_new_456', 'acct_live_123')).toBe('unsaved_changes');
    expect(deriveStripeSetupDisplayStatus('acct_new_456', '')).toBe('unsaved_changes');
  });

  it('sends provider fields only for providers section PATCH payloads', () => {
    const payload = buildMerchantSettingsUpdatePayload(
      ['providers'],
      {
        displayName: 'Should not send',
        organizationLogoUrl: '',
        defaultCurrency: 'AUD',
        stripeAccountId: 'acct_test_123',
        hederaAccountId: '',
        wiseProfileId: '',
        wiseEnabled: false,
        wiseCurrency: '',
        evmWalletEnabled: false,
        evmWalletAddress: '',
        evmSupportedNetworks: [],
        evmSupportedTokens: [],
      },
      {
        isPilotVariant: false,
        evmWalletEnabled: false,
        evmWalletAddress: null,
        evmSupportedNetworks: [],
        evmSupportedTokens: [],
      }
    );

    expect(payload).toEqual({
      stripeAccountId: 'acct_test_123',
      hederaAccountId: undefined,
      wiseProfileId: undefined,
      wiseEnabled: false,
      wiseCurrency: undefined,
      evmWalletEnabled: false,
      evmWalletAddress: null,
      evmSupportedNetworks: [],
      evmSupportedTokens: [],
    });
    expect(payload).not.toHaveProperty('displayName');
    expect(payload).not.toHaveProperty('defaultCurrency');
  });

  it('sends branding fields only for branding section PATCH payloads', () => {
    const payload = buildMerchantSettingsUpdatePayload(
      ['branding'],
      {
        displayName: 'Updated name',
        organizationLogoUrl: '',
        defaultCurrency: 'USD',
        stripeAccountId: 'acct_should_not_send',
        hederaAccountId: '',
        wiseProfileId: '',
        wiseEnabled: false,
        wiseCurrency: '',
        evmWalletEnabled: false,
        evmWalletAddress: '',
        evmSupportedNetworks: [],
        evmSupportedTokens: [],
      },
      {
        isPilotVariant: false,
        evmWalletEnabled: false,
        evmWalletAddress: null,
        evmSupportedNetworks: [],
        evmSupportedTokens: [],
      }
    );

    expect(payload).toEqual({
      displayName: 'Updated name',
      organizationLogoUrl: undefined,
      defaultCurrency: 'USD',
    });
    expect(payload).not.toHaveProperty('stripeAccountId');
  });
});

describe('MerchantSettingsForm providers stripe UX', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('shows Setup required when no Stripe account is configured', async () => {
    installMerchantSettingsFetch({ initialStripe: null });

    render(<MerchantSettingsForm sections={['providers']} presentation="commercial-os" />);

    await waitForProvidersForm();
    await waitFor(() => {
      expect(stripeStatus().getByText('Setup required')).toBeInTheDocument();
    });
    expect(screen.getByPlaceholderText('acct_xxxxxxxxxxxxx')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save payment providers' })).toBeInTheDocument();
  });

  it('shows Connected when persisted Stripe account exists', async () => {
    installMerchantSettingsFetch({ initialStripe: 'acct_live_123' });

    render(<MerchantSettingsForm sections={['providers']} presentation="commercial-os" />);

    await waitForProvidersForm();
    await waitFor(() => {
      expect(stripeStatus().getByText('Connected')).toBeInTheDocument();
    });
  });

  it('shows Unsaved changes when the user edits the Stripe account ID', async () => {
    installMerchantSettingsFetch({ initialStripe: null });

    render(<MerchantSettingsForm sections={['providers']} presentation="commercial-os" />);

    await waitForProvidersForm();
    await stripeStatus().findByText('Setup required');

    const input = screen.getByPlaceholderText('acct_xxxxxxxxxxxxx');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'acct_unsaved_999' } });

    expect(await stripeStatus().findByText('Unsaved changes')).toBeInTheDocument();
    expect(stripeStatus().queryByText('Connected')).not.toBeInTheDocument();
  });

  it('re-fetches after save and shows Connected when stripe_account_id is persisted', async () => {
    installMerchantSettingsFetch({
      initialStripe: null,
      afterSaveStripe: 'acct_saved_777',
    });

    render(<MerchantSettingsForm sections={['providers']} presentation="commercial-os" />);

    await waitForProvidersForm();
    const input = screen.getByPlaceholderText('acct_xxxxxxxxxxxxx');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'acct_saved_777' } });

    fireEvent.click(screen.getByRole('button', { name: 'Save payment providers' }));

    await waitFor(() => {
      expect(stripeStatus().getByText('Connected')).toBeInTheDocument();
    });
    expect(stripeStatus().queryByText('Unsaved changes')).not.toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it('keeps unsaved state and shows the save error when PATCH fails', async () => {
    installMerchantSettingsFetch({
      initialStripe: null,
      patchStatus: 403,
      patchError: 'Forbidden - insufficient organization permissions',
    });

    render(<MerchantSettingsForm sections={['providers']} presentation="commercial-os" />);

    await waitForProvidersForm();
    const input = screen.getByPlaceholderText('acct_xxxxxxxxxxxxx');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'acct_fail_000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save payment providers' }));

    expect(await stripeStatus().findByText('Unsaved changes')).toBeInTheDocument();
    await waitFor(() => {
      expect(
        screen.getByText('Forbidden - insufficient organization permissions')
      ).toBeInTheDocument();
    });
    expect(toast.error).toHaveBeenCalledWith('Forbidden - insufficient organization permissions');
    expect(stripeStatus().queryByText('Connected')).not.toBeInTheDocument();
  });
});
