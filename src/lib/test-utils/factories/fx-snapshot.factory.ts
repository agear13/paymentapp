/**
 * FX Snapshot Test Factory
 */

import type { FxSnapshot, PaymentToken } from '@prisma/client'

export function createMockFxSnapshot(
  overrides?: Partial<FxSnapshot>
): FxSnapshot {
  return {
    id: overrides?.id || `snapshot-${Date.now()}`,
    paymentLinkId: overrides?.paymentLinkId || 'test-link-123',
    tokenType: overrides?.tokenType || 'USDC',
    baseCurrency: overrides?.baseCurrency || 'USD',
    rate: overrides?.rate || '1.00000000',
    provider: overrides?.provider || 'COINGECKO',
    snapshotType: overrides?.snapshotType || 'CREATION',
    capturedAt: overrides?.capturedAt || new Date(),
    metadata: overrides?.metadata || null,
  } as FxSnapshot
}

export function createMockFourTokenSnapshots(
  paymentLinkId: string,
  snapshotType: 'CREATION' | 'SETTLEMENT' = 'CREATION',
  baseCurrency: string = 'AUD'
): FxSnapshot[] {
  const timestamp = new Date()
  
  return [
    createMockFxSnapshot({
      paymentLinkId,
      tokenType: 'HBAR',
      baseCurrency,
      rate: '0.08100000', // Example HBAR/AUD rate
      snapshotType,
      capturedAt: timestamp,
    }),
    createMockFxSnapshot({
      paymentLinkId,
      tokenType: 'USDC',
      baseCurrency,
      rate: baseCurrency === 'USD' ? '1.00000000' : '1.52000000', // USDC/USD = 1.0, USDC/AUD = 1.52
      snapshotType,
      capturedAt: timestamp,
    }),
    createMockFxSnapshot({
      paymentLinkId,
      tokenType: 'USDT',
      baseCurrency,
      rate: baseCurrency === 'USD' ? '1.00000000' : '1.52000000', // USDT/USD = 1.0, USDT/AUD = 1.52
      snapshotType,
      capturedAt: timestamp,
    }),
    createMockFxSnapshot({
      paymentLinkId,
      tokenType: 'AUDD',
      baseCurrency,
      rate: baseCurrency === 'AUD' ? '1.00000000' : '0.65800000', // AUDD/AUD = 1.0, AUDD/USD = 0.658
      snapshotType,
      capturedAt: timestamp,
    }),
  ]
}

export function createMockAuddSnapshot(
  overrides?: Partial<FxSnapshot>
): FxSnapshot {
  return createMockFxSnapshot({
    tokenType: 'AUDD',
    baseCurrency: 'AUD',
    rate: '1.00000000', // AUDD is 1:1 with AUD
    ...overrides,
  })
}

export function createMockAuddSnapshotUsd(
  overrides?: Partial<FxSnapshot>
): FxSnapshot {
  return createMockFxSnapshot({
    tokenType: 'AUDD',
    baseCurrency: 'USD',
    rate: '0.65800000', // Example AUD/USD rate
    ...overrides,
  })
}

// Helper to verify snapshot count
export function verifyFourTokenSnapshots(snapshots: FxSnapshot[]): boolean {
  const tokenTypes = new Set(snapshots.map(s => s.tokenType))
  return (
    snapshots.length === 4 &&
    tokenTypes.has('HBAR') &&
    tokenTypes.has('USDC') &&
    tokenTypes.has('USDT') &&
    tokenTypes.has('AUDD')
  )
}

// Helper to get AUDD snapshot from array
export function getAuddSnapshot(snapshots: FxSnapshot[]): FxSnapshot | undefined {
  return snapshots.find(s => s.tokenType === 'AUDD')
}







