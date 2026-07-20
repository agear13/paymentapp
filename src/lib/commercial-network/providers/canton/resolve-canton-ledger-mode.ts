/**
 * Resolve Canton ledger backend mode.
 *
 *   simulated  — CantonLedgerRuntime test double (default)
 *   localnet   — Quickstart JSON Ledger API against LocalNet
 *
 * Provvypay Commercial Domain never reads this — only the Canton provider factory.
 */

import type { CantonLedgerMode } from '@/lib/commercial-network/providers/canton/canton-ledger-adapter';

export function resolveCantonLedgerMode(
  env: NodeJS.ProcessEnv = process.env
): CantonLedgerMode {
  const raw = (env.CANTON_LEDGER_MODE ?? 'simulated').toLowerCase().trim();
  if (
    raw === 'localnet' ||
    raw === 'ledger' ||
    raw === 'production' ||
    raw === 'mainnet'
  ) {
    return 'localnet';
  }
  return 'simulated';
}
