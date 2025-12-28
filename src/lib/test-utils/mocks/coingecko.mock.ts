/**
 * CoinGecko API Mock
 */

export function createMockCoinGeckoRateResponse(
  tokenSymbol: string,
  quoteCurrency: string
) {
  const rates: Record<string, Record<string, number>> = {
    HBAR: {
      USD: 0.081,
      AUD: 0.123,
    },
    USDC: {
      USD: 1.0,
      AUD: 1.52,
    },
    USDT: {
      USD: 1.0,
      AUD: 1.52,
    },
    AUDD: {
      AUD: 1.0, // 1:1 with AUD
      USD: 0.658, // ~1/1.52
    },
  }
  
  const rate = rates[tokenSymbol]?.[quoteCurrency] || 1.0
  
  return {
    [tokenSymbol.toLowerCase()]: {
      [quoteCurrency.toLowerCase()]: rate,
    },
  }
}

export function createMockAuddRateResponse(quoteCurrency: string = 'AUD') {
  return createMockCoinGeckoRateResponse('AUDD', quoteCurrency)
}

export function mockCoinGeckoFetch() {
  return jest.fn((url: string) => {
    // Parse URL to extract token and currency
    const tokenMatch = url.match(/ids=([^&]+)/)
    const currencyMatch = url.match(/vs_currencies=([^&]+)/)
    
    if (!tokenMatch || !currencyMatch) {
      return Promise.reject(new Error('Invalid CoinGecko URL'))
    }
    
    const tokenSymbol = tokenMatch[1].toUpperCase()
    const quoteCurrency = currencyMatch[1].toUpperCase()
    
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve(createMockCoinGeckoRateResponse(tokenSymbol, quoteCurrency)),
    })
  })
}







