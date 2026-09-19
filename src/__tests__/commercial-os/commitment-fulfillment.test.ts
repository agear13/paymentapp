import fs from 'fs';
import path from 'path';
import { FLAGSHIP_ADVISOR_PAYMENT } from '@/lib/advisor/payment-advisor-context';
import { agreementPaymentScheduleFromExtraction } from '@/lib/commercial-os/payment-schedule-presentation';
import {
  commitmentRouteContextFromSchedule,
  formatCommitmentCorridorLabel,
} from '@/lib/commercial-os/commitment-route-context';
import {
  collectComparedRoutes,
  shouldDisplayRouteWinner,
} from '@/lib/commercial-os/commitment-fulfillment-presentation';
import { abcRetailAcmeSupplyProductionExtraction } from '@/__tests__/commercial-incentive/extraction-fixture';
import type { AdvisorOfferingSnapshot } from '@/lib/advisor/payment-advisor-types';

const CARD = [
  path.join(process.cwd(), 'components/commercial-os/commitment-fulfillment-card.tsx'),
  path.join(process.cwd(), 'src/components/commercial-os/commitment-fulfillment-card.tsx'),
].find((file) => fs.existsSync(file));

if (!CARD) {
  throw new Error('Could not find commitment-fulfillment-card.tsx');
}

function offering(
  overrides: Partial<AdvisorOfferingSnapshot> & Pick<AdvisorOfferingSnapshot, 'offeringId' | 'providerName'>
): AdvisorOfferingSnapshot {
  return {
    providerId: 'wise',
    productName: 'International',
    rank: 1,
    isRecommended: false,
    pricing: {
      kind: 'indicative_catalogue',
      totalLabel: 'A$120',
      amount: 120,
      live: false,
      sourceType: 'catalogue',
      retrievedAt: null,
    },
    availability: { type: 'available', provenance: 'catalogue' },
    whyShort: 'Catalogue alternative',
    ...overrides,
  };
}

describe('commitment fulfillment composition', () => {
  it('uses the production A$25,000 milestone on the flagship AU→ID corridor', () => {
    const schedule = agreementPaymentScheduleFromExtraction(
      abcRetailAcmeSupplyProductionExtraction()
    );
    const payment = commitmentRouteContextFromSchedule(schedule);

    expect(payment.origin).toBe('AU');
    expect(payment.destination).toBe('ID');
    expect(payment.amount).toBe(25_000);
    expect(payment.amount).not.toBe(FLAGSHIP_ADVISOR_PAYMENT.amount);
    expect(payment.sourceCurrency).toBe('AUD');
    expect(payment.destinationCurrency).toBe('IDR');
    expect(payment.transactionType).toBe('supplier_payment');
    expect(formatCommitmentCorridorLabel(payment)).toBe(
      'Australia → Indonesia · AUD → IDR · A$25,000 supplier payment'
    );
  });

  it('does not claim a cheaper/better winner without explained moderate-or-high evidence', () => {
    expect(shouldDisplayRouteWinner(null)).toBe(false);
    expect(
      shouldDisplayRouteWinner({
        status: 'insufficient',
        summary: 'Still gathering',
        confidence: { label: 'Unknown', level: 'unknown' },
        displayedOfferingId: 'wise-international',
        displayedProviderName: 'Wise',
      })
    ).toBe(false);
    expect(
      shouldDisplayRouteWinner({
        status: 'explained',
        summary: 'Low evidence',
        confidence: { label: 'Low', level: 'low' },
        displayedOfferingId: 'wise-international',
        displayedProviderName: 'Wise',
      })
    ).toBe(false);
    expect(
      shouldDisplayRouteWinner({
        status: 'explained',
        summary: 'Enough evidence',
        confidence: { label: 'Moderate', level: 'moderate' },
        displayedOfferingId: 'wise-international',
        displayedProviderName: 'Wise',
      })
    ).toBe(true);
  });

  it('lists compared routes as alternatives without duplicating the same offering', () => {
    const wise = offering({
      offeringId: 'wise-international',
      providerId: 'wise',
      providerName: 'Wise',
      isRecommended: true,
    });
    const airwallex = offering({
      offeringId: 'airwallex-international',
      providerId: 'airwallex',
      providerName: 'Airwallex',
      productName: 'Business',
      rank: 2,
    });

    expect(
      collectComparedRoutes({
        recommendation: wise,
        alternatives: [airwallex],
        scenarioComparison: {
          scenarioProviderId: 'airwallex',
          scenarioOffering: airwallex,
          recommendedOffering: wise,
          comparedOfferings: [wise, airwallex],
          scenarioIsRecommended: false,
        },
      }).map((row) => row.offeringId)
    ).toEqual(['wise-international', 'airwallex-international']);
  });

  it('reuses existing advisor, passport, and X Layer surfaces without new engines or hardcoded readiness', () => {
    const source = fs.readFileSync(CARD, 'utf8');
    expect(source).toContain('How could this commitment be fulfilled?');
    expect(source).toContain('/api/advisor/ask');
    expect(source).toContain('airwallex_scenario_comparison');
    expect(source).toContain('OnboardingReadinessPanel');
    expect(source).toContain('selectPassportOffering');
    expect(source).toContain('shouldDisplayRouteWinner');
    expect(source).not.toContain('43%');
    expect(source).not.toContain('71%');
    expect(source).not.toContain('supplier accepted');
    expect(source).not.toContain('sendErc20Payment');
    expect(source).not.toContain('compareLandingRoutes');
    expect(source).not.toContain('rankLandingRoutes');
    expect(source).not.toContain('textarea');
    expect(source).not.toContain('Ask Provvy');
  });

  it('mounts the existing fulfillment, passport, and X Layer sequence after incentive approval', () => {
    const files = [
      'components/journey/lovable/agreement-intelligence-hub-screen.tsx',
      'src/components/journey/lovable/agreement-intelligence-hub-screen.tsx',
      'components/journey/lovable/commercial-workspace-agreement-panel.tsx',
      'src/components/journey/lovable/commercial-workspace-agreement-panel.tsx',
    ]
      .map((rel) => path.join(process.cwd(), rel))
      .filter((file) => fs.existsSync(file));

    expect(files.length).toBeGreaterThanOrEqual(2);
    for (const file of files) {
      const source = fs.readFileSync(file, 'utf8');
      expect(source).toContain('EarlyPaymentIncentiveCard');
      expect(source).toContain('CommitmentFulfillmentCard');
      expect(source).toContain('OnchainCommitmentCard');
      expect(source).toContain('incentiveApproved');
      expect(source.indexOf('CommitmentFulfillmentCard')).toBeLessThan(
        source.indexOf('OnchainCommitmentCard')
      );
    }
  });
});
