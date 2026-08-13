/** @jest-environment jsdom */

import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { ConnectAccountingModal } from '@/components/journey/lovable/connect-accounting-modal';
import { ACCOUNTING_PROVIDER_OPTIONS } from '@/lib/accounting/accounting-integration-copy';

const mockXeroConnectUrl = jest.fn(
  (organizationId: string, returnTo: string) =>
    `/api/xero/connect?organization_id=${organizationId}&return_to=${encodeURIComponent(returnTo)}`
);

jest.mock('@/hooks/use-organization', () => ({
  useOrganization: () => ({ organizationId: 'org-123' }),
}));

jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: jest.fn() }),
}));

jest.mock('@/lib/journey/commercial-os-routes', () => {
  const actual = jest.requireActual<typeof import('@/lib/journey/commercial-os-routes')>(
    '@/lib/journey/commercial-os-routes'
  );
  return {
    ...actual,
    xeroConnectUrl: (organizationId: string, returnTo: string) =>
      mockXeroConnectUrl(organizationId, returnTo),
  };
});

jest.mock('@/lib/xero/xero-oauth-continue-context', () => ({
  storeXeroOAuthContinueFrom: jest.fn(),
}));

describe('ConnectAccountingModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete (window as Window & { location?: Location }).location;
    window.location = { href: '' } as Location;
  });

  it('renders disabled coming-soon providers as non-interactive with readable badges', () => {
    render(<ConnectAccountingModal open onOpenChange={jest.fn()} />);

    for (const provider of ACCOUNTING_PROVIDER_OPTIONS.filter((option) => !option.available)) {
      expect(screen.getByText(provider.name)).toBeInTheDocument();
    }

    const comingSoonBadges = screen
      .getAllByText('Coming soon', { exact: false })
      .filter((node) => node.className.includes('uppercase'));
    expect(comingSoonBadges.length).toBeGreaterThanOrEqual(2);
    comingSoonBadges.forEach((badge) => {
      expect(badge.className).toMatch(/text-foreground/);
    });

    expect(screen.queryByRole('button', { name: /quickbooks/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /myob/i })).not.toBeInTheDocument();
  });

  it('starts Xero OAuth against the Commercial OS accounting setup return path', () => {
    render(
      <ConnectAccountingModal
        open
        onOpenChange={jest.fn()}
        continueFrom="/workspace/receivables/create"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /xero/i }));
    fireEvent.click(screen.getByRole('button', { name: /continue to xero/i }));

    expect(mockXeroConnectUrl).toHaveBeenCalledWith('org-123', '/workspace/connected/xero');
  });
});
