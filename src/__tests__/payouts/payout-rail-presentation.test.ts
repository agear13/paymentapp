import fs from 'node:fs';
import path from 'node:path';
import {
  NOT_YET_ESTIMATED,
  buildPayoutRailComparison,
  payoutFxImplication,
  payoutRailLabel,
  recommendPayoutRail,
} from '@/lib/payouts/payout-rail-presentation';
import { listPayoutRails } from '@/lib/payouts/rails/registry';
import { selectPayoutRail } from '@/lib/payouts/select-payout-rail';

const USDT_TRON = {
  currency: 'USD',
  methodType: 'CRYPTO' as const,
  destinationHandle: 'TXsmKpEuW7qWnXzJLGP9eDLvWPR2GRn1FS',
  destinationDetails: {
    address: 'TXsmKpEuW7qWnXzJLGP9eDLvWPR2GRn1FS',
    asset: 'USDT',
    network: 'tron',
  },
  payoutAmount: '25',
  merchantHederaReady: false,
  merchantCregisReady: true,
};

describe('payout rail presentation', () => {
  it('uses the canonical selector for Provvy recommendations', () => {
    const recommendation = recommendPayoutRail(USDT_TRON);
    expect(recommendation.railId).toBe(selectPayoutRail(USDT_TRON));
    expect(recommendation.railId).toBe('cregis');
    expect(recommendation.label).toBe(payoutRailLabel('cregis'));
    expect(recommendation.destinationSummary).toBe('USDT → TRON');
    expect(recommendation.reasons.map((reason) => reason.label)).toEqual([
      'Compatible destination',
      'Supported currency/network',
      'Estimated cost',
      'Estimated settlement speed',
      'Availability',
    ]);
    expect(recommendation.reasons.find((reason) => reason.label === 'Estimated cost')?.detail).toBe(
      NOT_YET_ESTIMATED
    );
    expect(
      recommendation.reasons.find((reason) => reason.label === 'Estimated settlement speed')?.detail
    ).toBe(NOT_YET_ESTIMATED);
  });

  it('does not invent a recommended rail when the stamped rail is already selected', () => {
    const recommendation = recommendPayoutRail({
      ...USDT_TRON,
      selectedRailId: 'manual',
    });
    expect(recommendation.railId).toBe('manual');
  });

  it('falls back to Manual when the stamped rail is not configured or eligible', () => {
    const recommendation = recommendPayoutRail({
      ...USDT_TRON,
      merchantCregisReady: false,
      selectedRailId: 'cregis',
    });
    expect(recommendation.railId).toBe('manual');
    expect(
      recommendation.reasons.find((reason) => reason.label === 'Availability')?.detail
    ).toMatch(/Available/i);
  });

  it('does not recommend Airwallex even when it is configured and eligible', () => {
    const bank = {
      currency: 'USD',
      methodType: 'BANK_TRANSFER' as const,
      destinationHandle: 'acct-1',
      merchantAirwallexReady: true,
      merchantCregisReady: false,
      merchantHederaReady: false,
    };
    const recommendation = recommendPayoutRail(bank);
    expect(recommendation.railId).toBe('manual');
    const rows = buildPayoutRailComparison(bank);
    const airwallex = rows.find((row) => row.railId === 'airwallex');
    expect(airwallex?.available).toBe(true);
    expect(airwallex?.recommended).toBe(false);
    expect(rows.filter((row) => row.recommended).map((row) => row.railId)).toEqual(['manual']);
  });

  it('does not mark unconfigured automated rails available or recommended', () => {
    const rows = buildPayoutRailComparison({
      ...USDT_TRON,
      merchantCregisReady: false,
    });
    expect(rows.find((row) => row.railId === 'cregis')?.available).toBe(false);
    expect(rows.find((row) => row.railId === 'cregis')?.availabilityLabel).toBe('Coming soon');
    expect(rows.find((row) => row.railId === 'cregis')?.connectHint).toBe('Connect Cregis');
    expect(rows.find((row) => row.railId === 'airwallex')?.availabilityLabel).toBe(
      'Not available yet'
    );
    expect(rows.find((row) => row.recommended)?.railId).toBe('manual');
  });

  it('compares every registered rail without hardcoding a provider', () => {
    const rows = buildPayoutRailComparison(USDT_TRON);
    expect(rows.map((row) => row.railId)).toEqual(listPayoutRails().map((rail) => rail.railId));
    expect(rows).toHaveLength(listPayoutRails().length);
    const recommended = rows.filter((row) => row.recommended);
    expect(recommended).toHaveLength(1);
    expect(recommended[0]?.railId).toBe('cregis');
    expect(recommended[0]?.reasonCodes).toContain('RECOMMENDED');
    expect(rows.every((row) => row.estimatedCost === NOT_YET_ESTIMATED)).toBe(true);
    expect(rows.every((row) => row.estimatedCostKnown === false)).toBe(true);
    expect(rows.every((row) => row.estimatedSettlementKnown === false)).toBe(true);
    expect(rows.find((row) => row.railId === 'stripe_treasury')?.available).toBe(false);
    expect(rows.find((row) => row.railId === 'manual')?.compatible).toBe(true);
  });

  it('can hide recommendation when destinations are not yet known', () => {
    const rows = buildPayoutRailComparison({
      currency: 'USD',
      hideRecommendation: true,
    });
    expect(rows.every((row) => row.recommended === false)).toBe(true);
    expect(rows.every((row) => !row.reasonCodes.includes('RECOMMENDED'))).toBe(true);
    expect(rows.find((row) => row.railId === 'cregis')?.availabilityLabel).toBe('Coming soon');
    expect(rows.find((row) => row.railId === 'airwallex')?.availabilityLabel).toBe('Coming soon');
    expect(rows.find((row) => row.railId === 'airwallex')?.connectHint).toBe('Connect Airwallex');
    expect(rows.find((row) => row.railId === 'manual')?.available).toBe(true);
    expect(rows.every((row) => row.compatibilityLabel === 'Pending')).toBe(true);
  });

  it('states FX honestly from destination metadata', () => {
    expect(
      payoutFxImplication({
        railId: 'cregis',
        currency: 'USD',
        methodType: 'CRYPTO',
        details: USDT_TRON.destinationDetails,
        payoutAmount: '25',
      })
    ).toMatch(/without FX/i);
    expect(
      payoutFxImplication({
        railId: 'cregis',
        currency: 'AUD',
        methodType: 'CRYPTO',
        details: USDT_TRON.destinationDetails,
        payoutAmount: '25',
      })
    ).toMatch(/not eligible/i);
    expect(payoutFxImplication({ railId: 'manual', currency: 'USD' })).toMatch(/not estimated/i);
    expect(payoutFxImplication({ railId: 'airwallex', currency: 'SGD' })).toMatch(/does not invent/i);
  });

  it('does not introduce provider API calls in payout UX presentation', () => {
    const files = [
      'lib/payouts/payout-rail-presentation.ts',
      'lib/payouts/payout-rail-availability.ts',
      'lib/payouts/payout-rail-readiness.ts',
      'lib/payouts/payout-status-presentation.ts',
      'components/payouts/payout-rail-comparison.tsx',
      'components/payouts/payout-rail-recommendation.tsx',
      'components/payouts/payout-review-summary.tsx',
      'app/api/payouts/route.ts',
      'app/api/payouts/rails/readiness/route.ts',
    ];
    for (const file of files) {
      const contents = fs.readFileSync(path.join(process.cwd(), file), 'utf8');
      expect(contents).not.toContain('/api/v2/payout');
      expect(contents).not.toContain('https://api.stripe.com');
      expect(contents).not.toContain('api.sandbox.airwallex.com');
      expect(contents).not.toContain('https://api.airwallex.com');
    }
  });
});
