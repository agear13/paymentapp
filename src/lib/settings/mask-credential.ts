/** Partial masking for operator-facing payment rail identifiers. */

export function maskMiddle(value: string, visibleStart = 4, visibleEnd = 0): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (trimmed.length <= visibleStart + visibleEnd + 2) {
    return '••••••';
  }
  const start = trimmed.slice(0, visibleStart);
  const end = visibleEnd > 0 ? trimmed.slice(-visibleEnd) : '';
  return `${start}••••••${end}`;
}

export function maskStripeAccountId(accountId: string): string {
  if (!accountId.trim()) return '';
  if (accountId.startsWith('acct_')) {
    const prefix = accountId.slice(0, 10);
    return `${prefix}••••••`;
  }
  return maskMiddle(accountId, 4, 0);
}

export function maskHederaAccountId(accountId: string): string {
  if (!accountId.trim()) return '';
  if (/^0\.0\./.test(accountId)) {
    return `0.0.••••••`;
  }
  return maskMiddle(accountId, 4, 4);
}

export function maskWiseProfileId(profileId: string): string {
  if (!profileId.trim()) return '';
  return maskMiddle(profileId, 4, 0);
}

export function maskEvmWalletAddress(address: string): string {
  if (!address.trim()) return '';
  return maskMiddle(address, 6, 4);
}

export function isStripeTestAccountId(accountId: string | undefined | null): boolean {
  if (!accountId?.trim()) return false;
  return accountId.includes('acct_test');
}
