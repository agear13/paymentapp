/**
 * @jest-environment jsdom
 */
import fs from 'node:fs';
import path from 'node:path';
import { render, screen } from '@testing-library/react';
import { WorkspaceSettlementRailIntelligence } from '@/components/payouts/workspace-settlement-rail-intelligence';

const readiness = {
  merchantHederaReady: false,
  merchantCregisReady: false,
  merchantAirwallexReady: false,
};

jest.mock('@/hooks/use-payout-rail-readiness', () => ({
  usePayoutRailReadiness: () => readiness,
}));

describe('Workspace Settlement rail intelligence', () => {
  beforeEach(() => {
    readiness.merchantHederaReady = false;
    readiness.merchantCregisReady = false;
    readiness.merchantAirwallexReady = false;
  });

  it('shows Provvy choosing the rail and Coming soon for unconfigured Airwallex and Cregis', () => {
    render(
      <WorkspaceSettlementRailIntelligence currency="USD" recipient="Alex" amount={100} />
    );

    expect(screen.getByText(/Provvy chooses the payout rail/i)).toBeTruthy();
    expect(
      screen.getByText(/Provvy selects the most appropriate payment rail/i)
    ).toBeTruthy();
    expect(screen.getByText('Connect Cregis')).toBeTruthy();
    expect(screen.getByText('Connect Airwallex')).toBeTruthy();
    expect(screen.getAllByText('Coming soon').length).toBeGreaterThan(1);
    expect(screen.getByText('Manual / off-platform')).toBeTruthy();
    expect(screen.getAllByText('Available').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: /confirm payout/i })).toBeNull();
  });

  it('does not recommend an unconfigured automated rail', () => {
    render(<WorkspaceSettlementRailIntelligence currency="USD" />);
    expect(screen.getAllByText('Recommended')).toHaveLength(1);
  });

  it('marks a configured rail as registered without treating it as executable before destination', () => {
    readiness.merchantCregisReady = true;
    readiness.merchantAirwallexReady = true;
    render(<WorkspaceSettlementRailIntelligence currency="USD" />);
    expect(screen.getByText('Cregis')).toBeTruthy();
    expect(screen.getByText('Airwallex')).toBeTruthy();
    expect(screen.queryByText('Connect Cregis')).toBeNull();
    expect(screen.getAllByText('Available once a destination is selected').length).toBeGreaterThan(0);
  });

  it('does not call provider APIs from the Workspace rail panel or Settlement screen', () => {
    const files = [
      'components/payouts/workspace-settlement-rail-intelligence.tsx',
      'components/journey/lovable/workspace-settlement-screen.tsx',
      'hooks/use-workspace-settlement.ts',
    ];
    for (const file of files) {
      const contents = fs.readFileSync(path.join(process.cwd(), file), 'utf8');
      expect(contents).not.toContain('api.sandbox.airwallex.com');
      expect(contents).not.toContain('https://api.airwallex.com');
      expect(contents).not.toContain('https://api.stripe.com');
      expect(contents).not.toContain('/api/v2/payout');
      expect(contents).not.toContain('PolicyRailSelector');
    }
  });

  it('keeps Workspace Settlement on the canonical payout-batch orchestrator', () => {
    const screenSrc = fs.readFileSync(
      path.join(process.cwd(), 'components/journey/lovable/workspace-settlement-screen.tsx'),
      'utf8'
    );
    const hookSrc = fs.readFileSync(
      path.join(process.cwd(), 'hooks/use-workspace-settlement.ts'),
      'utf8'
    );
    expect(screenSrc).toContain('WorkspaceSettlementRailIntelligence');
    expect(screenSrc).toContain('createRelease');
    expect(hookSrc).toContain('/api/payout-batches/create');
    expect(hookSrc).not.toContain('/api/payouts/rails/cregis');
    expect(hookSrc).not.toContain('airwallexRequest');
  });
});
