import {
  persistablePayoutMethodDetails,
  publicPayoutMethodDetails,
  sanitizePayoutMethodDetails,
  validateCryptoPayoutMethodDetails,
} from '@/lib/payouts/crypto-payout-destination';
import { selectPayoutRail } from '@/lib/payouts/select-payout-rail';
import { isCregisDestinationExecutable } from '@/lib/payouts/rails/cregis-currency';

describe('payout method details sanitization', () => {
  it('allows existing methods without details', () => {
    expect(persistablePayoutMethodDetails({ methodType: 'BANK_TRANSFER' })).toEqual({
      ok: true,
      details: null,
    });
    expect(persistablePayoutMethodDetails({ methodType: 'PAYPAL', handle: 'a@b.com' })).toEqual({
      ok: true,
      details: null,
    });
    expect(persistablePayoutMethodDetails({ methodType: 'CRYPTO', handle: 'TXsmaddress1' })).toEqual({
      ok: true,
      details: null,
    });
  });

  it('rejects secrets and unknown fields', () => {
    expect(
      sanitizePayoutMethodDetails({ address: 'TXsmaddress1', apiKey: 'secret' })
    ).toMatchObject({ ok: false });
    expect(
      sanitizePayoutMethodDetails({ address: 'TXsmaddress1', sign: 'abc' })
    ).toMatchObject({ ok: false });
    expect(
      sanitizePayoutMethodDetails({ address: 'TXsmaddress1', private_key: 'abc' })
    ).toMatchObject({ ok: false });
    expect(sanitizePayoutMethodDetails({ gatewayUrl: 'https://evil' })).toMatchObject({
      ok: false,
    });
    expect(publicPayoutMethodDetails({ address: 'TXsmaddress1', apiKey: 'secret' })).toBeNull();
  });
});

describe('CRYPTO destination validation', () => {
  it('accepts valid asset/network/address details', () => {
    const result = persistablePayoutMethodDetails({
      methodType: 'CRYPTO',
      details: {
        address: 'TXsmKpEuW7qWnXzJLGP9eDLvWPR2GRn1FS',
        asset: 'USDT',
        network: 'tron',
      },
    });
    expect(result).toEqual({
      ok: true,
      details: {
        address: 'TXsmKpEuW7qWnXzJLGP9eDLvWPR2GRn1FS',
        asset: 'USDT',
        network: 'tron',
      },
    });
  });

  it('copies handle into persisted address when details omit it', () => {
    const result = persistablePayoutMethodDetails({
      methodType: 'CRYPTO',
      handle: 'TXsmKpEuW7qWnXzJLGP9eDLvWPR2GRn1FS',
      details: { asset: 'USDT', network: 'trc20' },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.details).toMatchObject({
        address: 'TXsmKpEuW7qWnXzJLGP9eDLvWPR2GRn1FS',
        asset: 'USDT',
        network: 'trc20',
      });
    }
  });

  it('rejects malformed crypto details', () => {
    expect(
      validateCryptoPayoutMethodDetails({
        details: { asset: 'USDT' },
      })
    ).toMatchObject({ ok: false });
    expect(
      validateCryptoPayoutMethodDetails({
        details: { address: 'short' },
      })
    ).toMatchObject({ ok: false });
    expect(
      validateCryptoPayoutMethodDetails({
        details: { address: 'TXsmKpEuW7qWnXzJLGP9eDLvWPR2GRn1FS', asset: 'USDT', network: 'bitcoin' },
      })
    ).toMatchObject({ ok: false });
    expect(
      validateCryptoPayoutMethodDetails({
        details: { tokenAmount: -1, asset: 'USDT', network: 'tron' },
      })
    ).toMatchObject({ ok: false });
  });
});

describe('persisted details and rail selection', () => {
  it('does not select Cregis for a CRYPTO handle without destination details', () => {
    expect(
      isCregisDestinationExecutable({
        handle: 'TXsmKpEuW7qWnXzJLGP9eDLvWPR2GRn1FS',
        methodType: 'CRYPTO',
        payoutAmount: '25',
        payoutCurrency: 'USD',
      })
    ).toBe(false);
    expect(
      selectPayoutRail({
        currency: 'USD',
        methodType: 'CRYPTO',
        merchantHederaReady: false,
        merchantCregisReady: true,
        destinationHandle: 'TXsmKpEuW7qWnXzJLGP9eDLvWPR2GRn1FS',
        payoutAmount: '25',
      })
    ).toBe('manual');
  });

  it('selects Cregis when persisted CRYPTO details are eligible', () => {
    const details = {
      address: 'TXsmKpEuW7qWnXzJLGP9eDLvWPR2GRn1FS',
      asset: 'USDT',
      network: 'tron',
    };
    expect(
      isCregisDestinationExecutable({
        handle: details.address,
        details,
        methodType: 'CRYPTO',
        payoutAmount: '25',
        payoutCurrency: 'USD',
      })
    ).toBe(true);
    expect(
      selectPayoutRail({
        currency: 'USD',
        methodType: 'CRYPTO',
        merchantHederaReady: true,
        merchantCregisReady: true,
        destinationHandle: details.address,
        destinationDetails: details,
        payoutAmount: '25',
      })
    ).toBe('cregis');
  });

  it('preserves Hedera selection over CRYPTO-style details', () => {
    expect(
      selectPayoutRail({
        currency: 'USD',
        methodType: 'HEDERA',
        merchantHederaReady: true,
        merchantCregisReady: true,
        destinationHandle: '0.0.1234',
        destinationDetails: { asset: 'USDT', network: 'tron' },
        payoutAmount: '25',
      })
    ).toBe('hedera');
  });
});
