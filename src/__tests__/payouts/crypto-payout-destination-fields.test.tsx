/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import {
  CryptoPayoutDestinationFields,
  cryptoDestinationDetailsPayload,
  cryptoDestinationFormErrors,
} from '@/components/payouts/crypto-payout-destination-fields';

describe('Crypto payout destination fields', () => {
  it('collects canonical wallet destination fields without Cregis-specific labels', () => {
    render(
      <CryptoPayoutDestinationFields
        value={{
          address: 'TXsmKpEuW7qWnXzJLGP9eDLvWPR2GRn1FS',
          asset: 'USDT',
          network: 'tron',
          memo: '',
        }}
        onChange={() => undefined}
      />
    );

    expect((screen.getByLabelText('Wallet address') as HTMLInputElement).value).toBe(
      'TXsmKpEuW7qWnXzJLGP9eDLvWPR2GRn1FS'
    );
    expect(screen.getByLabelText('Asset')).toBeTruthy();
    expect(screen.getByLabelText('Network')).toBeTruthy();
    expect(screen.queryByText(/cregis/i)).toBeNull();
    expect(screen.queryByText(/wallet_id/i)).toBeNull();
    expect(screen.queryByText(/from_address/i)).toBeNull();
    expect(screen.getByText(/Provvy determines which payout rail/i)).toBeTruthy();
    expect(screen.getByText(/Crypto wallet/i)).toBeTruthy();
  });

  it('validates required crypto destination fields', () => {
    expect(
      cryptoDestinationFormErrors({
        address: '',
        asset: '',
        network: '',
        memo: '',
      })
    ).toEqual(expect.arrayContaining(['Wallet address is required', 'Asset is required', 'Network is required']));
  });

  it('builds persistable details from the form values', () => {
    expect(
      cryptoDestinationDetailsPayload({
        address: 'TXsmKpEuW7qWnXzJLGP9eDLvWPR2GRn1FS',
        asset: 'USDT',
        network: 'tron',
        memo: '',
      })
    ).toEqual({
      address: 'TXsmKpEuW7qWnXzJLGP9eDLvWPR2GRn1FS',
      asset: 'USDT',
      network: 'tron',
      memo: undefined,
    });
  });
});
