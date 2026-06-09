import {
  buildProvvypayInsight,
  buildSettlementSimulation,
  DEFAULT_SETTLEMENT_SIMULATION_REVENUE_AUD,
} from '@/lib/agreement-analyzer/extraction/build-settlement-simulation';
import type { AgreementReportJson } from '@/lib/agreement-analyzer/extraction/extraction-types';
import { parsePublicReportJson } from '@/lib/agreement-analyzer/report-types';

function createReport(overrides: Partial<AgreementReportJson> = {}): AgreementReportJson {
  return {
    parties: [],
    revenueSplits: [],
    paymentConditions: [],
    obligations: [],
    risks: [],
    missingInformation: [],
    settlementReadiness: {
      score: 70,
      summary: 'Agreement has gaps that should be resolved before settlement.',
      factors: [],
    },
    ...overrides,
  };
}

describe('buildSettlementSimulation', () => {
  it('simulates a simple 70/30 revenue split', () => {
    const report = createReport({
      parties: [{ name: 'Harbour Events' }, { name: 'Pulse Promotions' }],
      revenueSplits: [
        { party: 'Pulse Promotions Pty Ltd', percentage: 70, basis: 'Net Door Receipts' },
        { party: 'Harbour Events Pty Ltd', percentage: 30, basis: 'Net Door Receipts' },
      ],
    });

    const simulation = buildSettlementSimulation(report);

    expect(simulation).toEqual({
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
    });
  });

  it('simulates a three-way split with rounded payouts', () => {
    const report = createReport({
      parties: [{}, {}, {}],
      revenueSplits: [
        { beneficiary: 'Promoter', percentage: 50, basis: 'gross ticket sales' },
        { beneficiary: 'Venue', percentage: 30, basis: 'gross ticket sales' },
        { beneficiary: 'Artist', percentage: 20, basis: 'gross ticket sales' },
      ],
    });

    const simulation = buildSettlementSimulation(report);

    expect(simulation.supported).toBe(true);
    expect(simulation.participants).toHaveLength(3);
    expect(simulation.participants.map((participant) => participant.estimatedPayout)).toEqual([
      5000, 3000, 2000,
    ]);
  });

  it('handles fixed amount payouts deterministically', () => {
    const report = createReport({
      revenueSplits: [
        { beneficiary: 'Performing Artist', fixedAmount: 2500, basis: 'appearance guarantee' },
        { beneficiary: 'Promoter', percentage: 65, basis: 'net receipts' },
        { beneficiary: 'Venue', percentage: 35, basis: 'net receipts' },
      ],
    });

    const simulation = buildSettlementSimulation(report);

    expect(simulation.supported).toBe(true);
    expect(simulation.participants).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          party: 'Performing Artist',
          fixedAmount: 2500,
          estimatedPayout: 2500,
        }),
        expect.objectContaining({
          party: 'Promoter',
          percentage: 65,
          estimatedPayout: 6500,
        }),
        expect.objectContaining({
          party: 'Venue',
          percentage: 35,
          estimatedPayout: 3500,
        }),
      ])
    );
  });

  it('uses only the primary split layer when multiple layers exist', () => {
    const report = createReport({
      revenueSplits: [
        {
          layer: 'primary',
          splits: [
            { beneficiary: 'Promoter', percentage: 70 },
            { beneficiary: 'Venue', percentage: 30 },
          ],
        },
        {
          layer: 'secondary',
          splits: [{ beneficiary: 'Charity', percentage: 5 }],
        },
      ],
    });

    const simulation = buildSettlementSimulation(report);

    expect(simulation.supported).toBe(true);
    expect(simulation.participants).toHaveLength(2);
    expect(simulation.participants.map((participant) => participant.party)).toEqual([
      'Promoter',
      'Venue',
    ]);
  });

  it('returns unsupported simulation when split rules cannot be determined', () => {
    const report = createReport({
      revenueSplits: [{ beneficiary: 'Venue', basis: 'net receipts after costs' }],
    });

    const simulation = buildSettlementSimulation(report);

    expect(simulation).toEqual({
      supported: false,
      simulationRevenue: DEFAULT_SETTLEMENT_SIMULATION_REVENUE_AUD,
      participants: [],
      notes: ['Revenue-sharing language detected but settlement rules could not be determined.'],
    });
  });

  it('returns unsupported simulation when no revenue splits exist', () => {
    const report = createReport({
      parties: [{ name: 'Client' }],
    });

    const simulation = buildSettlementSimulation(report);

    expect(simulation.supported).toBe(false);
    expect(simulation.notes).toEqual([
      'No revenue-sharing splits were identified for settlement simulation.',
    ]);
  });
});

describe('buildProvvypayInsight', () => {
  it('prioritises revenue-share automation insight for supported percentage splits', () => {
    const simulation = buildSettlementSimulation(
      createReport({
        parties: [{}, {}],
        revenueSplits: [
          { party: 'Promoter', percentage: 70 },
          { party: 'Venue', percentage: 30 },
        ],
      })
    );

    expect(buildProvvypayInsight(simulation, 2)).toBe(
      'Provvypay can automate revenue allocation and settlement execution for agreements like this.'
    );
  });

  it('uses multi-party insight for three or more participants without percentage splits', () => {
    const simulation = {
      supported: false,
      simulationRevenue: DEFAULT_SETTLEMENT_SIMULATION_REVENUE_AUD,
      participants: [],
      notes: ['Revenue-sharing language detected but settlement rules could not be determined.'],
    };

    expect(buildProvvypayInsight(simulation, 4)).toBe(
      'This agreement contains a multi-party settlement structure that is commonly managed using spreadsheets and manual transfers.'
    );
  });

  it('uses two-party automation insight when two parties are present', () => {
    const simulation = {
      supported: false,
      simulationRevenue: DEFAULT_SETTLEMENT_SIMULATION_REVENUE_AUD,
      participants: [],
      notes: ['No revenue-sharing splits were identified for settlement simulation.'],
    };

    expect(buildProvvypayInsight(simulation, 2)).toBe(
      'This agreement could be settled automatically using Provvypay.'
    );
  });
});

describe('parsePublicReportJson settlement simulation compatibility', () => {
  it('parses legacy report_json without settlementSimulation', () => {
    const parsed = parsePublicReportJson(
      createReport({
        revenueSplits: [{ party: 'Venue', percentage: 30 }],
      })
    );

    expect(parsed?.settlementSimulation).toBeUndefined();
  });

  it('parses report_json with settlementSimulation attached', () => {
    const simulation = buildSettlementSimulation(
      createReport({
        revenueSplits: [
          { party: 'Promoter', percentage: 70 },
          { party: 'Venue', percentage: 30 },
        ],
      })
    );

    const parsed = parsePublicReportJson({
      ...createReport(),
      settlementSimulation: simulation,
    });

    expect(parsed?.settlementSimulation).toEqual(simulation);
  });
});
