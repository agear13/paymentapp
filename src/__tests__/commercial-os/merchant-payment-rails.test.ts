import {
  buildMerchantPaymentRailsFromSetup,
  normalizeMerchantPaymentRails,
} from '@/lib/commercial-os/merchant-payment-rails';
import {
  settlementAccountsReady,
  buildMappingFieldStates,
} from '@/lib/commercial-os/xero-invoice-readiness';
import { computePaymentLinkRailSetup, toPaymentLinkRailSnapshot } from '@/lib/payment-links/setup-status';
import type { MerchantPaymentRails } from '@/lib/xero/xero-setup-guidance';

function railSetupFromFlags(flags: {
  stripe?: boolean;
  wise?: boolean;
  hedera?: boolean;
  evm?: boolean;
}) {
  return computePaymentLinkRailSetup(
    toPaymentLinkRailSnapshot({
      stripeAccountId: flags.stripe ? 'acct_stripe' : null,
      hederaAccountId: flags.hedera ? '0.0.123' : null,
      wiseEnabled: flags.wise ?? false,
      wiseProfileId: flags.wise ? 'wise-profile' : null,
      evmWalletEnabled: flags.evm ?? false,
      evmWalletAddress: flags.evm ? '0xabc' : null,
    }),
    { wisePayments: true, evmWalletPayments: true }
  );
}

function rails(flags: {
  stripe?: boolean;
  wise?: boolean;
  hedera?: boolean;
  evm?: boolean;
  manualBank?: boolean;
  manualCrypto?: boolean;
}): MerchantPaymentRails {
  return buildMerchantPaymentRailsFromSetup(railSetupFromFlags(flags), {
    manualBank: flags.manualBank
      ? {
          manualBankRecipientName: 'Acme',
          manualBankCurrency: 'AUD',
          manualBankDestinationType: 'Bank',
        }
      : null,
    crypto: flags.manualCrypto
      ? {
          cryptoNetwork: 'hedera',
          cryptoAddress: '0.0.123',
          cryptoCurrency: 'HBAR',
        }
      : null,
  });
}

const BASE_MAPPINGS = {
  xero_revenue_account_id: '200',
  xero_receivable_account_id: '610',
};

describe('dynamic payment readiness', () => {
  it('stripe only requires stripe holding', () => {
    const merchantRails = rails({ stripe: true });
    const fieldStates = buildMappingFieldStates(
      { ...BASE_MAPPINGS, xero_stripe_clearing_account_id: '1050' },
      true,
      new Set(['200', '610', '1050']),
      merchantRails
    );

    expect(fieldStates.xero_stripe_clearing_account_id).toBe('configured');
    expect(fieldStates.xero_wise_clearing_account_id).toBeUndefined();
    expect(
      settlementAccountsReady(
        { ...BASE_MAPPINGS, xero_stripe_clearing_account_id: '1050' },
        merchantRails
      )
    ).toBe(true);
  });

  it('wise only requires wise holding', () => {
    const merchantRails = rails({ wise: true });
    const fieldStates = buildMappingFieldStates(
      { ...BASE_MAPPINGS, xero_wise_clearing_account_id: '1055' },
      true,
      new Set(['200', '610', '1055']),
      merchantRails
    );

    expect(fieldStates.xero_wise_clearing_account_id).toBe('configured');
    expect(fieldStates.xero_stripe_clearing_account_id).toBeUndefined();
  });

  it('manual bank only requires wise holding', () => {
    const merchantRails = rails({ manualBank: true });
    const fieldStates = buildMappingFieldStates({}, true, new Set(), merchantRails);

    expect(fieldStates.xero_wise_clearing_account_id).toBe('required');
    expect(fieldStates.xero_stripe_clearing_account_id).toBeUndefined();
  });

  it('crypto only requires digital asset holding', () => {
    const merchantRails = rails({ hedera: true });
    const fieldStates = buildMappingFieldStates({}, true, new Set(), merchantRails);

    expect(fieldStates.xero_hbar_clearing_account_id).toBe('required');
    expect(fieldStates.xero_stripe_clearing_account_id).toBeUndefined();
    expect(fieldStates.xero_wise_clearing_account_id).toBeUndefined();
  });

  it('stripe + crypto requires both holdings', () => {
    const merchantRails = rails({ stripe: true, hedera: true });
    const fieldStates = buildMappingFieldStates({}, true, new Set(), merchantRails);

    expect(fieldStates.xero_stripe_clearing_account_id).toBe('required');
    expect(fieldStates.xero_hbar_clearing_account_id).toBe('required');
    expect(fieldStates.xero_wise_clearing_account_id).toBeUndefined();
  });

  it('stripe + wise requires both rail holdings', () => {
    const merchantRails = rails({ stripe: true, wise: true });
    const fieldStates = buildMappingFieldStates({}, true, new Set(), merchantRails);

    expect(fieldStates.xero_stripe_clearing_account_id).toBe('required');
    expect(fieldStates.xero_wise_clearing_account_id).toBe('required');
  });

  it('no rails enabled requires no settlement accounts', () => {
    const merchantRails = normalizeMerchantPaymentRails({
      stripeEnabled: false,
      wiseEnabled: false,
      stablecoinSettlementsEnabled: false,
      manualBankEnabled: false,
    });

    expect(settlementAccountsReady(BASE_MAPPINGS, merchantRails)).toBe(true);
    const fieldStates = buildMappingFieldStates(BASE_MAPPINGS, true, new Set(['200', '610']), merchantRails);
    expect(fieldStates.xero_stripe_clearing_account_id).toBeUndefined();
    expect(fieldStates.xero_wise_clearing_account_id).toBeUndefined();
    expect(fieldStates.xero_hbar_clearing_account_id).toBeUndefined();
  });
});
