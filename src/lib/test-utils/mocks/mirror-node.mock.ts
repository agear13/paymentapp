/**
 * Hedera Mirror Node API Mock
 */

export function createMockMirrorNodeBalanceResponse(accountId: string, tokenBalances?: Array<{ token_id: string; balance: number }>) {
  return {
    account: accountId,
    balance: {
      balance: 10000000000, // 100 HBAR in tinybars
      timestamp: '0.000000000',
      tokens: tokenBalances || [
        {
          token_id: '0.0.456858', // USDC
          balance: 100000000, // 100 USDC (6 decimals)
        },
        {
          token_id: '0.0.8322281', // USDT
          balance: 50000000, // 50 USDT (6 decimals)
        },
        {
          token_id: '0.0.1394325', // AUDD mainnet
          balance: 75000000, // 75 AUDD (6 decimals)
        },
      ],
    },
    links: {},
  }
}

export function createMockMirrorNodeTransactionResponse(
  accountId: string,
  tokenId: string | null,
  amount: string,
  timestamp: Date = new Date()
) {
  const timestampNanos = Math.floor(timestamp.getTime() * 1000000)
  const transactionId = `0.0.123@${timestampNanos}.000000000`
  
  return {
    transactions: [
      {
        transaction_id: transactionId,
        consensus_timestamp: `${Math.floor(timestamp.getTime() / 1000)}.${timestampNanos % 1000000000}`,
        valid_start_timestamp: `${Math.floor(timestamp.getTime() / 1000) - 10}.000000000`,
        charged_tx_fee: 100000,
        memo_base64: '',
        result: 'SUCCESS',
        name: tokenId ? 'CRYPTOTRANSFER' : 'CRYPTOTRANSFER',
        transfers: tokenId
          ? []
          : [
              {
                account: accountId,
                amount: parseInt(amount) * 100000000, // Convert to tinybars
              },
            ],
        token_transfers: tokenId
          ? [
              {
                token_id: tokenId,
                account: accountId,
                amount: parseInt(amount.replace('.', '')), // Remove decimal point
              },
            ]
          : [],
      },
    ],
    links: {
      next: null,
    },
  }
}

export function createMockAuddBalanceResponse(accountId: string, balance: number = 100) {
  return createMockMirrorNodeBalanceResponse(accountId, [
    {
      token_id: '0.0.1394325', // AUDD mainnet
      balance: balance * 1000000, // Convert to 6 decimals
    },
  ])
}

export function createMockAuddTransactionResponse(
  accountId: string,
  amount: string = '100.000000',
  timestamp?: Date
) {
  return createMockMirrorNodeTransactionResponse(
    accountId,
    '0.0.1394325', // AUDD mainnet token ID
    amount,
    timestamp
  )
}

export function mockMirrorNodeFetch() {
  return jest.fn((url: string) => {
    if (url.includes('/balances')) {
      const accountId = url.split('/balances/')[1].split('?')[0]
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(createMockMirrorNodeBalanceResponse(accountId)),
      })
    }
    
    if (url.includes('/transactions')) {
      const accountId = url.match(/account\.id=([0-9.]+)/)?.[1] || '0.0.123456'
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(createMockMirrorNodeTransactionResponse(accountId, null, '100.00000000')),
      })
    }
    
    return Promise.reject(new Error('Unknown endpoint'))
  })
}







