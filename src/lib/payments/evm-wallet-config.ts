/**
 * Client-safe EVM wallet rail configuration helpers.
 * Server routes may also apply env fallbacks via evm-wallet-rail.server.ts.
 */

const EVM_ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;

export function isEvmWalletAddressConfigured(value: string | null | undefined): boolean {
  const trimmed = value?.trim();
  return !!trimmed && EVM_ADDRESS_PATTERN.test(trimmed);
}

export function evmWalletConfiguredFromMerchantSnapshot(
  merchant: { evm_wallet_address?: string | null } | null | undefined
): boolean {
  return isEvmWalletAddressConfigured(merchant?.evm_wallet_address);
}
