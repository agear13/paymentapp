/** @jest-environment jsdom */

import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { FeatureGate } from '@/components/entitlements/feature-gate';

const mockUseEntitlements = jest.fn();

jest.mock('@/hooks/use-entitlements', () => ({
  useEntitlements: () => mockUseEntitlements(),
  trackEntitlementAnalytics: jest.fn(),
}));

jest.mock('@/components/entitlements/entitlement-upgrade-panel', () => ({
  EntitlementUpgradePanel: ({ feature }: { feature: string }) => (
    <div data-testid="upgrade-panel">Upgrade for {feature}</div>
  ),
}));

describe('FeatureGate', () => {
  beforeEach(() => {
    mockUseEntitlements.mockReset();
  });

  it('shows loading skeleton while entitlements load', () => {
    mockUseEntitlements.mockReturnValue({
      entitlements: null,
      loading: true,
      isAllowed: () => false,
      getDecision: () => null,
      pilotBypass: false,
    });

    render(
      <FeatureGate feature="payment_links" mode="block">
        <div>Secret form</div>
      </FeatureGate>
    );

    expect(screen.queryByText('Secret form')).not.toBeInTheDocument();
    expect(screen.getByText(/Loading plan details/i)).toBeInTheDocument();
  });

  it('renders children when entitled', () => {
    mockUseEntitlements.mockReturnValue({
      entitlements: { organizationId: 'org-1', plan: 'professional' },
      loading: false,
      isAllowed: () => true,
      getDecision: () => ({ allowed: true }),
      pilotBypass: false,
    });

    render(
      <FeatureGate feature="payment_links" mode="block">
        <div>Invoice form</div>
      </FeatureGate>
    );

    expect(screen.getByText('Invoice form')).toBeInTheDocument();
  });

  it('shows upgrade panel in block mode when denied', () => {
    mockUseEntitlements.mockReturnValue({
      entitlements: { organizationId: 'org-1', plan: 'starter' },
      loading: false,
      isAllowed: () => false,
      getDecision: () => ({
        allowed: false,
        requiredPlan: 'professional',
        reason: 'plan_tier',
      }),
      pilotBypass: false,
    });

    render(
      <FeatureGate feature="payment_links" mode="block" pageTitle="Create invoice">
        <div>Invoice form</div>
      </FeatureGate>
    );

    expect(screen.queryByText('Invoice form')).not.toBeInTheDocument();
    expect(screen.getByTestId('upgrade-panel')).toHaveTextContent('payment_links');
  });
});
