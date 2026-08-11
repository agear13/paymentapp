/** @jest-environment jsdom */

import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { WorkspaceSettingsScreen } from '@/components/journey/lovable/workspace-settings-screen';

jest.mock('next/link', () => {
  return ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  );
});

describe('WorkspaceSettingsScreen navigation', () => {
  it('does not reference admin console and links Plan & Billing', () => {
    render(<WorkspaceSettingsScreen />);
    expect(screen.queryByText(/admin console/i)).toBeNull();
    const planLinks = screen.getAllByRole('link', { name: /Plan & Billing/i });
    expect(planLinks.some((el) => el.getAttribute('href') === '/workspace/settings/plan')).toBe(true);
    expect(screen.getByRole('link', { name: 'Profile' })).toHaveAttribute(
      'href',
      '/workspace/settings/account'
    );
    expect(screen.getAllByText('Coming soon').length).toBeGreaterThan(0);
  });
});
