'use client';

import * as React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  CRYPTO_DESTINATION_ASSETS,
  CRYPTO_DESTINATION_NETWORKS,
  cryptoDestinationNeedsMemo,
  cryptoNetworksForAsset,
  validateCryptoPayoutMethodDetails,
} from '@/lib/payouts/crypto-payout-destination';

export type CryptoPayoutDestinationForm = {
  address: string;
  asset: string;
  network: string;
  memo: string;
};

export const EMPTY_CRYPTO_PAYOUT_DESTINATION: CryptoPayoutDestinationForm = {
  address: '',
  asset: '',
  network: '',
  memo: '',
};

const UNIQUE_ASSETS = [...new Set(CRYPTO_DESTINATION_ASSETS.map((row) => row.asset))];

export function cryptoDestinationFormErrors(form: CryptoPayoutDestinationForm): string[] {
  const errors: string[] = [];
  if (!form.address.trim()) errors.push('Wallet address is required');
  if (!form.asset.trim()) errors.push('Asset is required');
  if (!form.network.trim()) errors.push('Network is required');
  if (cryptoDestinationNeedsMemo(form.network) && !form.memo.trim()) {
    errors.push('Memo / tag is required for this network');
  }
  const validated = validateCryptoPayoutMethodDetails({
    handle: form.address,
    details: cryptoDestinationDetailsPayload(form),
  });
  if (!validated.ok) errors.push(validated.error);
  return [...new Set(errors)];
}

export function cryptoDestinationDetailsPayload(form: CryptoPayoutDestinationForm) {
  const address = form.address.trim();
  const asset = form.asset.trim();
  const network = form.network.trim();
  const memo = form.memo.trim();
  if (!address && !asset && !network && !memo) return undefined;
  return {
    address: address || undefined,
    asset: asset || undefined,
    network: network || undefined,
    memo: memo || undefined,
  };
}

export function CryptoPayoutDestinationFields({
  value,
  onChange,
  showErrors = false,
}: {
  value: CryptoPayoutDestinationForm;
  onChange: (next: CryptoPayoutDestinationForm) => void;
  showErrors?: boolean;
}) {
  const networks = value.asset
    ? cryptoNetworksForAsset(value.asset)
    : [...CRYPTO_DESTINATION_NETWORKS];
  const showMemo = cryptoDestinationNeedsMemo(value.network);
  const errors = showErrors ? cryptoDestinationFormErrors(value) : [];

  return (
    <div className="space-y-4">
      <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        Destination type: <span className="font-medium text-foreground">Crypto wallet</span>. Provvy
        determines which payout rail can service this destination. Do not enter provider wallet IDs
        or source addresses.
      </div>
      <div className="space-y-2">
        <Label htmlFor="crypto-wallet-address">Wallet address</Label>
        <Input
          id="crypto-wallet-address"
          value={value.address}
          onChange={(event) => onChange({ ...value, address: event.target.value })}
          placeholder="Destination wallet address"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="crypto-asset">Asset</Label>
        <Select
          value={value.asset || undefined}
          onValueChange={(asset) => {
            const available = cryptoNetworksForAsset(asset);
            const network =
              value.network && available.some((row) => row.id === value.network)
                ? value.network
                : available[0]?.id ?? '';
            onChange({
              ...value,
              asset,
              network,
              memo: cryptoDestinationNeedsMemo(network) ? value.memo : '',
            });
          }}
        >
          <SelectTrigger id="crypto-asset">
            <SelectValue placeholder="Select asset" />
          </SelectTrigger>
          <SelectContent>
            {UNIQUE_ASSETS.map((asset) => (
              <SelectItem key={asset} value={asset}>
                {asset}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="crypto-network">Network</Label>
        <Select
          value={value.network || undefined}
          onValueChange={(network) =>
            onChange({
              ...value,
              network,
              memo: cryptoDestinationNeedsMemo(network) ? value.memo : '',
            })
          }
        >
          <SelectTrigger id="crypto-network">
            <SelectValue placeholder="Select network" />
          </SelectTrigger>
          <SelectContent>
            {networks.map((network) => (
              <SelectItem key={network.id} value={network.id}>
                {network.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {showMemo ? (
        <div className="space-y-2">
          <Label htmlFor="crypto-memo">Memo / tag</Label>
          <Input
            id="crypto-memo"
            value={value.memo}
            onChange={(event) => onChange({ ...value, memo: event.target.value })}
            placeholder="Required for TON and XRP destinations"
          />
        </div>
      ) : null}
      {errors.length > 0 ? (
        <ul className="space-y-1 text-xs text-destructive">
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
