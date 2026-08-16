/**
 * Resolve the asset/currency actually received from a PAYMENT_CONFIRMED event.
 * Uses confirmed payment metadata — never the invoice payment_method alone.
 */

export type ConfirmedPaymentAssetInput = {
  provider: string;
  currency: string;
  tokenType?: string | null;
  metadata?: Record<string, unknown> | null;
};

export function resolveConfirmedPaymentAsset(input: ConfirmedPaymentAssetInput): string {
  const metaToken = input.metadata?.token_type;
  if (typeof metaToken === 'string' && metaToken.trim()) {
    return metaToken.trim().toUpperCase();
  }

  if (input.tokenType?.trim()) {
    return input.tokenType.trim().toUpperCase();
  }

  return (input.currency ?? '').trim().toUpperCase();
}

export type ReceiveWalletContext = {
  assetProvider: string;
  walletNetwork: string | null;
  destinationAddress: string | null;
  transactionHash: string | null;
  sourceReference: string | null;
};

type MerchantWalletSettings = {
  evm_wallet_address: string | null;
  hedera_account_id: string | null;
};

export function resolveReceiveWalletContext(
  provider: string,
  metadata: Record<string, unknown> | null | undefined,
  settings: MerchantWalletSettings | null,
  sourceReference?: string | null
): ReceiveWalletContext {
  if (provider === 'evm_wallet') {
    const network =
      typeof metadata?.network === 'string'
        ? metadata.network
        : typeof metadata?.evm_network === 'string'
          ? metadata.evm_network
          : null;
    const merchantFromMeta =
      typeof metadata?.merchant_wallet_address === 'string'
        ? metadata.merchant_wallet_address
        : typeof metadata?.wallet_address === 'string'
          ? metadata.wallet_address
          : null;
    const destinationAddress = settings?.evm_wallet_address ?? merchantFromMeta ?? null;
    const hash =
      typeof metadata?.transaction_hash === 'string'
        ? metadata.transaction_hash.toLowerCase()
        : null;

    return {
      assetProvider: 'blockchain',
      walletNetwork: network,
      destinationAddress,
      transactionHash: hash,
      sourceReference: sourceReference ?? hash,
    };
  }

  if (provider === 'hedera') {
    const merchantFromMeta =
      typeof metadata?.merchant_account_id === 'string'
        ? metadata.merchant_account_id
        : typeof metadata?.recipient === 'string'
          ? metadata.recipient
          : null;
    const txId =
      typeof metadata?.hedera_transaction_id === 'string'
        ? metadata.hedera_transaction_id
        : typeof metadata?.normalized_transaction_id === 'string'
          ? metadata.normalized_transaction_id
          : sourceReference ?? null;

    return {
      assetProvider: 'blockchain',
      walletNetwork: 'hedera',
      destinationAddress: settings?.hedera_account_id ?? merchantFromMeta ?? null,
      transactionHash: txId,
      sourceReference: sourceReference ?? txId,
    };
  }

  if (provider === 'stripe') {
    return {
      assetProvider: 'stripe',
      walletNetwork: null,
      destinationAddress: null,
      transactionHash: null,
      sourceReference: sourceReference ?? null,
    };
  }

  if (provider === 'wise') {
    const wiseAccount =
      typeof metadata?.wise_profile_id === 'string'
        ? metadata.wise_profile_id
        : typeof metadata?.recipient_account === 'string'
          ? metadata.recipient_account
          : null;

    return {
      assetProvider: 'wise',
      walletNetwork: null,
      destinationAddress: wiseAccount,
      transactionHash: null,
      sourceReference: sourceReference ?? null,
    };
  }

  return {
    assetProvider: 'provvy',
    walletNetwork: null,
    destinationAddress: null,
    transactionHash: null,
    sourceReference: sourceReference ?? null,
  };
}
