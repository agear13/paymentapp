import { destinationKindFromPayoutMethodType } from '@/lib/payouts/destination-kind';
import {
  getPayoutRail,
  listPayoutRails,
  payoutRailSupportsCurrency,
  webhookProviderForPayoutRail,
} from '@/lib/payouts/rails/registry';
import { PAYOUT_RAIL_IDS } from '@/lib/payouts/rails/types';
import { payoutIdempotencyKey } from '@/lib/payouts/payout-idempotency';
import { selectPayoutRail } from '@/lib/payouts/select-payout-rail';
import { buildPayoutRailCreateFields } from '@/lib/payouts/stamp-payout-rail';
import { canTransitionPayoutStatus } from '@/lib/payouts/payout-status-transitions';
import { getPayoutRailAdapter } from '@/lib/payouts/rails/adapters';

describe('PayoutRailRegistry', () => {
  it('is separate from inbound PaymentRailId and names canonical outbound rails', () => {
    expect([...PAYOUT_RAIL_IDS]).toEqual([
      'manual',
      'hedera',
      'cregis',
      'airwallex',
      'stripe_treasury',
    ]);
    expect(listPayoutRails().map((rail) => rail.railId)).toEqual([...PAYOUT_RAIL_IDS]);
    expect(getPayoutRail('manual').implemented).toBe(true);
    expect(getPayoutRail('hedera').implemented).toBe(true);
    expect(getPayoutRail('cregis').implemented).toBe(true);
    expect(getPayoutRail('cregis').supportsQuote).toBe(false);
    expect(getPayoutRail('cregis').supportsCancel).toBe(false);
    expect(getPayoutRail('airwallex').implemented).toBe(true);
    expect(getPayoutRail('airwallex').supportsQuote).toBe(true);
    expect(getPayoutRail('airwallex').supportsCancel).toBe(true);
    expect(getPayoutRail('stripe_treasury').implemented).toBe(false);
  });

  it('maps rails onto webhook providers without reusing inbound STRIPE for Treasury', () => {
    expect(webhookProviderForPayoutRail('manual')).toBe('MANUAL');
    expect(webhookProviderForPayoutRail('hedera')).toBe('HEDERA');
    expect(webhookProviderForPayoutRail('cregis')).toBe('CREGIS');
    expect(webhookProviderForPayoutRail('airwallex')).toBe('AIRWALLEX');
    expect(webhookProviderForPayoutRail('stripe_treasury')).toBe('STRIPE_TREASURY');
  });

  it('treats empty supportedCurrencies as all-currency only for manual', () => {
    expect(payoutRailSupportsCurrency('manual', 'JPY')).toBe(true);
    expect(payoutRailSupportsCurrency('hedera', 'USD')).toBe(true);
    expect(payoutRailSupportsCurrency('hedera', 'EUR')).toBe(false);
    expect(payoutRailSupportsCurrency('cregis', 'USD')).toBe(false);
    expect(payoutRailSupportsCurrency('cregis', 'USDT')).toBe(false);
    expect(payoutRailSupportsCurrency('airwallex', 'SGD')).toBe(true);
    expect(payoutRailSupportsCurrency('airwallex', 'IDR')).toBe(false);
  });
});

describe('destination kind + PolicyRailSelector', () => {
  it('maps existing payout methods onto canonical destination kinds', () => {
    expect(destinationKindFromPayoutMethodType('HEDERA')).toBe('WALLET');
    expect(destinationKindFromPayoutMethodType('CRYPTO')).toBe('WALLET');
    expect(destinationKindFromPayoutMethodType('BANK_TRANSFER')).toBe('BANK_ACCOUNT');
    expect(destinationKindFromPayoutMethodType('WISE')).toBe('BANK_ACCOUNT');
    expect(destinationKindFromPayoutMethodType('PAYPAL')).toBe('PLATFORM_HANDLE');
    expect(destinationKindFromPayoutMethodType('MANUAL_NOTE')).toBe('PLATFORM_HANDLE');
  });

  it('selects hedera only for Hedera wallets when merchant is ready', () => {
    expect(
      selectPayoutRail({
        currency: 'USD',
        methodType: 'HEDERA',
        merchantHederaReady: true,
      })
    ).toBe('hedera');
    expect(
      selectPayoutRail({
        currency: 'USD',
        methodType: 'HEDERA',
        merchantHederaReady: false,
      })
    ).toBe('manual');
    expect(
      selectPayoutRail({
        currency: 'USD',
        methodType: 'BANK_TRANSFER',
        merchantHederaReady: true,
      })
    ).toBe('manual');
    expect(
      selectPayoutRail({
        currency: 'EUR',
        methodType: 'HEDERA',
        merchantHederaReady: true,
      })
    ).toBe('manual');
  });

  it('never returns unimplemented rails', () => {
    expect(
      selectPayoutRail({
        currency: 'USD',
        destinationKind: 'WALLET',
        merchantHederaReady: false,
      })
    ).toBe('manual');
    expect(
      selectPayoutRail({
        currency: 'USD',
        destinationKind: 'BANK_ACCOUNT',
        merchantHederaReady: true,
      })
    ).toBe('manual');
    expect(
      selectPayoutRail({
        currency: 'SGD',
        methodType: 'BANK_TRANSFER',
        merchantHederaReady: true,
        merchantCregisReady: true,
      })
    ).toBe('manual');
  });

  it('selects Cregis only for ready merchants with a documented wallet destination', () => {
    const usdtTron = {
      currency: 'USD',
      methodType: 'CRYPTO' as const,
      merchantHederaReady: true,
      merchantCregisReady: true,
      destinationHandle: 'TXsmKpEuW7qWnXzJLGP9eDLvWPR2GRn1FS',
      destinationDetails: { asset: 'USDT', network: 'tron' },
      payoutAmount: '25',
    };
    expect(selectPayoutRail(usdtTron)).toBe('cregis');
    expect(selectPayoutRail({ ...usdtTron, merchantCregisReady: false })).toBe('manual');
    expect(
      selectPayoutRail({
        ...usdtTron,
        methodType: 'HEDERA',
        merchantHederaReady: true,
      })
    ).toBe('hedera');
    expect(
      selectPayoutRail({
        ...usdtTron,
        destinationDetails: { asset: 'BTC', network: 'bitcoin' },
      })
    ).toBe('manual');
    expect(
      selectPayoutRail({
        ...usdtTron,
        currency: 'AUD',
      })
    ).toBe('manual');
  });

  it('stamps rail_id, destination_kind, and idempotency_key without provider fields', () => {
    const fields = buildPayoutRailCreateFields({
      organizationId: 'org-1',
      currency: 'AUD',
      methodType: 'HEDERA',
      merchantHederaReady: true,
      payoutId: 'payout-1',
    });
    expect(fields).toEqual({
      id: 'payout-1',
      rail_id: 'hedera',
      destination_kind: 'WALLET',
      idempotency_key: payoutIdempotencyKey('org-1', 'payout-1'),
    });
    expect(JSON.stringify(fields)).not.toMatch(/cregis|stripe_treasury|financial_account/i);
  });
});

describe('payout status transitions', () => {
  it('allows PROCESSING as a real persisted state between submit and PAID/FAILED', () => {
    expect(canTransitionPayoutStatus('DRAFT', 'SUBMITTED')).toBe(true);
    expect(canTransitionPayoutStatus('SUBMITTED', 'PROCESSING')).toBe(true);
    expect(canTransitionPayoutStatus('PROCESSING', 'PAID')).toBe(true);
    expect(canTransitionPayoutStatus('PROCESSING', 'FAILED')).toBe(true);
    expect(canTransitionPayoutStatus('PAID', 'FAILED')).toBe(false);
    expect(canTransitionPayoutStatus('PAID', 'PAID')).toBe(true);
  });
});

describe('payout rail adapters', () => {
  it('returns implemented adapters and rejects unimplemented rails', () => {
    expect(getPayoutRailAdapter('manual').railId).toBe('manual');
    expect(getPayoutRailAdapter('hedera').railId).toBe('hedera');
    expect(getPayoutRailAdapter('cregis').railId).toBe('cregis');
    expect(getPayoutRailAdapter('cregis').quote).toBeUndefined();
    expect(getPayoutRailAdapter('airwallex').railId).toBe('airwallex');
    expect(getPayoutRailAdapter('airwallex').quote).toBeDefined();
    expect(() => getPayoutRailAdapter('stripe_treasury')).toThrow(/not implemented/);
  });

  it('manual adapter does not accept inbound webhooks', () => {
    expect(getPayoutRailAdapter('manual').verifyWebhook).toBeUndefined();
    expect(getPayoutRailAdapter('manual').normalizeWebhook({})).toBeNull();
    expect(getPayoutRailAdapter('hedera').normalizeWebhook({})).toBeNull();
  });
});
