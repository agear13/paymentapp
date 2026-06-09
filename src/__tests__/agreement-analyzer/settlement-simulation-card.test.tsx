/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';

import { SettlementSimulationCard } from '@/components/agreement-analyzer/settlement-simulation-card';
import { DEFAULT_SETTLEMENT_SIMULATION_REVENUE_AUD } from '@/lib/agreement-analyzer/extraction/build-settlement-simulation';

describe('SettlementSimulationCard', () => {
  it('renders supported simulation table and Provvypay insight', () => {
    render(
      <SettlementSimulationCard
        partyCount={2}
        simulation={{
          supported: true,
          simulationRevenue: DEFAULT_SETTLEMENT_SIMULATION_REVENUE_AUD,
          participants: [
            {
              party: 'Pulse Promotions Pty Ltd',
              percentage: 70,
              estimatedPayout: 7000,
              basis: 'Net Door Receipts',
            },
            {
              party: 'Harbour Events Pty Ltd',
              percentage: 30,
              estimatedPayout: 3000,
              basis: 'Net Door Receipts',
            },
          ],
        }}
      />
    );

    expect(screen.getByText('Settlement Simulation')).toBeInTheDocument();
    expect(screen.getByText(/If this agreement generated .*10,000\.00 in revenue/)).toBeInTheDocument();
    expect(screen.getByText('Pulse Promotions Pty Ltd')).toBeInTheDocument();
    expect(screen.getByText('Harbour Events Pty Ltd')).toBeInTheDocument();
    expect(screen.getByText('70% · Net Door Receipts')).toBeInTheDocument();
    expect(screen.getByText(/7,000\.00/)).toBeInTheDocument();
    expect(screen.getByText('Provvypay insight')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Provvypay can automate revenue allocation and settlement execution for agreements like this.'
      )
    ).toBeInTheDocument();
  });

  it('renders unsupported notes instead of the payout table', () => {
    render(
      <SettlementSimulationCard
        partyCount={2}
        simulation={{
          supported: false,
          simulationRevenue: DEFAULT_SETTLEMENT_SIMULATION_REVENUE_AUD,
          participants: [],
          notes: [
            'Revenue-sharing language detected but settlement rules could not be determined.',
          ],
        }}
      />
    );

    expect(screen.getByText('Settlement Simulation')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Revenue-sharing language detected but settlement rules could not be determined.'
      )
    ).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(
      screen.getByText('This agreement could be settled automatically using Provvypay.')
    ).toBeInTheDocument();
  });
});
