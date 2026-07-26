/**
 * @jest-environment jsdom
 */

import { isHackathonJourneyEnabled } from '@/lib/journey/hackathon-journey';
import { deriveWorkflowTimelineStep } from '@/lib/commercial/workflows/settlement-flow.client';
import { resolveWorkflowSettlementCurrency } from '@/lib/commercial/workflows/development-settlement-simulator.client';

describe('resolveWorkflowSettlementCurrency', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('prefers obligation currency in production mode', () => {
    delete process.env.NEXT_PUBLIC_HACKATHON_JOURNEY_ENABLED;
    expect(
      resolveWorkflowSettlementCurrency(
        [
          {
            id: 'obl-1',
            deal_id: 'deal-1',
            participant_id: 'p-1',
            obligation_type: 'PARTICIPANT',
            amount_owed: 3000,
            currency: 'USD',
            status: 'AVAILABLE_FOR_PAYOUT',
            participant: { name: 'Alex', role: 'Supplier' },
          },
        ],
        'AUD',
      ),
    ).toBe('USD');
  });

  it('uses agreement currency in hackathon journey mode', () => {
    process.env.NEXT_PUBLIC_HACKATHON_JOURNEY_ENABLED = 'true';
    expect(
      resolveWorkflowSettlementCurrency(
        [
          {
            id: 'obl-1',
            deal_id: 'deal-1',
            participant_id: 'p-1',
            obligation_type: 'PARTICIPANT',
            amount_owed: 3000,
            currency: 'USD',
            status: 'AVAILABLE_FOR_PAYOUT',
            participant: { name: 'Alex', role: 'Supplier' },
          },
        ],
        'AUD',
      ),
    ).toBe('AUD');
  });
});

describe('deriveWorkflowTimelineStep', () => {
  it('treats FUNDED project status as Xero synchronised', () => {
    const step = deriveWorkflowTimelineStep({
      obligationsLoaded: true,
      settlementStates: [],
      fundingSummary: {
        straitProject: true,
        fundedTotal: 3000,
        owedTotal: 3000,
        projectFundingStatus: 'FUNDED',
        linkedInvoiceCount: 0,
      },
      settlementComplete: false,
    });

    expect(step).toBe(3);
  });
});

describe('executeWorkflowSettlementRelease hackathon routing', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('uses hackathon journey flag for settlement simulator routing', () => {
    delete process.env.NEXT_PUBLIC_HACKATHON_JOURNEY_ENABLED;
    expect(isHackathonJourneyEnabled()).toBe(false);

    process.env.NEXT_PUBLIC_HACKATHON_JOURNEY_ENABLED = 'true';
    expect(isHackathonJourneyEnabled()).toBe(true);
  });
});
