/**
 * Verified Digital Surge API capabilities (official docs + OpenAPI v2.0).
 * https://digitalsurge.com.au/docs — fetched 2026-08-16.
 *
 * Items marked UNKNOWN were not present in the published OpenAPI schema;
 * runtime responses may include additional fields (e.g. blockchain tx hash in json format).
 */

export const DIGITAL_SURGE_API = {
  baseUrl: 'https://app.digitalsurge.com.au',
  authentication: 'Bearer API key (Read Only or Read & Write)',
  webhooks: false as const,
  pollingRequired: true as const,
  endpoints: {
    profileBrief: '/api/private/profile/brief/',
    listAllTransactions: '/api/private/wallet/all-transactions/',
    getTransaction: '/api/private/wallet/all-transactions/{id}/',
    listWalletTransactions: '/api/private/v2/wallet/{asset}/wallet-transactions/',
    getWalletTransaction: '/api/private/v2/wallet/{asset}/wallet-transactions/{id}/',
    listDepositAddresses: '/api/private/wallet/{asset}/deposit-addresses/',
    listBalances: '/api/private/balances/',
    listWithdrawals: '/api/private/v2/wallet/{asset}/withdrawals/',
  },
  transactionTypes: [
    'buy',
    'sell',
    'swap',
    'deposit',
    'withdrawal',
    'commission',
    'airdrop',
    'stake',
    'unstake',
    'reward',
  ] as const,
  correlationFields: {
    verified: [
      'summary_id',
      'id',
      'object_id',
      'transaction_type',
      'transaction_subtype',
      'status',
      'src_asset',
      'dst_asset',
      'src_amount',
      'dst_amount',
      'exchange_rate',
      'fee',
      'aud_fee',
      'aud_value',
      'created',
      'deposit_address.raw_address (deposit-addresses endpoint)',
    ],
    unknown: [
      'blockchain_tx_hash on list responses (not in OpenAPI; may appear in format=json detail)',
      'explicit parent deposit id on swap records',
      'bank account details on AUD withdrawals',
      'webhook delivery',
    ],
  },
  audWithdrawalInHistory:
    'AUD withdrawals appear as transaction_type=withdrawal in all-transactions; mapped to FIAT_CREDIT aud_withdrawal — never BANK_SETTLEMENT without explicit bank-arrival evidence',
} as const;
