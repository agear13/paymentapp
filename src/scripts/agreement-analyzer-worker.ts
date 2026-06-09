/**
 * Long-running worker for agreement extraction jobs.
 * Usage (from src/):
 *   npm run agreement-analyzer:worker
 */

import { randomUUID } from 'crypto';

import { config as loadEnv } from 'dotenv';
import path from 'path';

import { processNextAgreementProcessingJob } from '@/lib/agreement-analyzer/jobs/process-jobs.server';
import { loggers } from '@/lib/logger';

loadEnv({ path: path.join(process.cwd(), '.env') });

const IDLE_SLEEP_MS = 5_000;
const workerId = `worker-${process.pid}-${randomUUID()}`;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function runWorkerLoop(): Promise<never> {
  loggers.api.info('Agreement analyzer worker started', { workerId });

  while (true) {
    try {
      const outcome = await processNextAgreementProcessingJob(workerId);
      if (outcome === 'idle') {
        await sleep(IDLE_SLEEP_MS);
      }
    } catch (error) {
      loggers.api.error('Agreement analyzer worker iteration failed', error, { workerId });
      await sleep(IDLE_SLEEP_MS);
    }
  }
}

void runWorkerLoop();
