/**
 * Custom Test Assertions
 */

export function expectLedgerBalanced(
  entries: Array<{ entryType: string; amount: string }>
): void {
  const debits = entries
    .filter((e) => e.entryType === 'DEBIT')
    .reduce((sum, e) => sum + parseFloat(e.amount), 0)

  const credits = entries
    .filter((e) => e.entryType === 'CREDIT')
    .reduce((sum, e) => sum + parseFloat(e.amount), 0)

  const diff = Math.abs(debits - credits)

  expect(diff).toBeLessThan(0.01) // Allow for floating point precision
  expect(debits).toBeGreaterThan(0)
  expect(credits).toBeGreaterThan(0)
}

export function expectTokenToleranceValid(
  expectedAmount: string,
  actualAmount: string,
  tokenType: 'HBAR' | 'USDC' | 'USDT' | 'AUDD'
): boolean {
  const expected = parseFloat(expectedAmount)
  const actual = parseFloat(actualAmount)
  const diff = actual - expected
  const percentDiff = (diff / expected) * 100

  const tolerances = {
    HBAR: 0.5, // 0.5%
    USDC: 0.1, // 0.1%
    USDT: 0.1, // 0.1%
    AUDD: 0.1, // 0.1%
  }

  const tolerance = tolerances[tokenType]
  return percentDiff >= -tolerance && percentDiff <= tolerance
}

export function expectAuddClearingAccount(accountCode: string): void {
  expect(accountCode).toBe('1054')
  expect(accountCode).not.toBe('1051') // Not HBAR
  expect(accountCode).not.toBe('1052') // Not USDC
  expect(accountCode).not.toBe('1053') // Not USDT
}

export function expectFourTokenSnapshots(
  snapshots: Array<{ tokenType: string }>
): void {
  expect(snapshots).toHaveLength(4)
  
  const tokenTypes = snapshots.map((s) => s.tokenType)
  expect(tokenTypes).toContain('HBAR')
  expect(tokenTypes).toContain('USDC')
  expect(tokenTypes).toContain('USDT')
  expect(tokenTypes).toContain('AUDD')
  
  // All should be unique
  const uniqueTokens = new Set(tokenTypes)
  expect(uniqueTokens.size).toBe(4)
}

export function expectSameTimestamp(
  items: Array<{ capturedAt: Date | string }>,
  toleranceMs: number = 1000
): void {
  if (items.length < 2) return

  const timestamps = items.map((item) =>
    typeof item.capturedAt === 'string'
      ? new Date(item.capturedAt).getTime()
      : item.capturedAt.getTime()
  )

  const first = timestamps[0]
  timestamps.forEach((ts) => {
    const diff = Math.abs(ts - first)
    expect(diff).toBeLessThan(toleranceMs)
  })
}







