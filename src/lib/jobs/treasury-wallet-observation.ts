import { observeWalletTransfersForAllOrganizations } from '@/lib/treasury/observers/wallet-transfer/observe-wallet-transfers';
import { loggers } from '@/lib/logger';

const log = loggers.jobs;

export async function runTreasuryWalletObservationJob(): Promise<{
  success: boolean;
  message: string;
  data: unknown;
}> {
  const results = await observeWalletTransfersForAllOrganizations();
  const failures = results.filter((r) => r.errors.length > 0);

  log.info('Treasury wallet observation job finished', {
    organizations: results.length,
    failures: failures.length,
  });

  return {
    success: failures.length === 0,
    message:
      failures.length === 0
        ? `Observed wallets for ${results.length} organization(s)`
        : `Completed with ${failures.length} organization error(s)`,
    data: { results },
  };
}
