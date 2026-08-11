/** @jest-environment jsdom */

import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import { WorkspaceAccountMenu } from '@/components/commercial-os/workspace-account-menu';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { email: 'operator@example.com', user_metadata: { full_name: 'Alex Operator' } } },
      }),
    },
  }),
}));

jest.mock('@/lib/auth/sign-out.client', () => ({
  signOutClient: jest.fn(),
}));

describe('WorkspaceAccountMenu', () => {
  it('renders account menu trigger with user initials', async () => {
    render(<WorkspaceAccountMenu />);

    await waitFor(() => {
      expect(screen.getByLabelText('Account menu')).toHaveTextContent('AO');
    });
  });
});
