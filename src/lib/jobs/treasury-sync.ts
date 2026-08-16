import { syncTreasuryForAllConnectedOrganizations } from '@/lib/treasury/observers/sync-digital-surge';
import { loggers } from '@/lib/logger';

const log = loggers.jobs;

export async function runTreasurySyncJob(): Promise<{
  success: boolean;
  message: string;
  data: unknown;
}> {
  const results = await syncTreasuryForAllConnectedOrganizations();
  const failures = results.filter((r) => r.error);

  log.info('Treasury sync job finished', {
    organizations: results.length,
    failures: failures.length,
  });

  return {
    success: failures.length === 0,
    message:
      failures.length === 0
        ? `Synced ${results.length} organization(s)`
        : `Synced with ${failures.length} failure(s)`,
    data: { results },
  };
}
