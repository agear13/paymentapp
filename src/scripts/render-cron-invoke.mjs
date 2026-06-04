#!/usr/bin/env node
/**
 * Render cron entrypoint — HTTP-invokes secured job routes on provvypay-api (B3).
 * Usage: node scripts/render-cron-invoke.mjs <target>
 *
 * Requires: CRON_SECRET, CRON_BASE_URL or NEXT_PUBLIC_APP_URL
 */
import { pathToFileURL } from 'node:url';

/** @type {Record<string, { method: string; path: string; auth: 'x-cron-secret' | 'bearer'; body?: string }>} */
export const CRON_TARGETS = {
  'expired-links': {
    method: 'POST',
    path: '/api/jobs/expired-links',
    auth: 'x-cron-secret',
  },
  'recurring-templates': {
    method: 'POST',
    path: '/api/jobs/recurring-templates',
    auth: 'x-cron-secret',
  },
  'stuck-payments': {
    method: 'POST',
    path: '/api/jobs/stuck-payments',
    auth: 'x-cron-secret',
  },
  'stripe-reconciliation': {
    method: 'POST',
    path: '/api/jobs/stripe-reconciliation',
    auth: 'x-cron-secret',
  },
  'ledger-integrity': {
    method: 'POST',
    path: '/api/jobs/ledger-integrity',
    auth: 'x-cron-secret',
  },
  'xero-queue': {
    method: 'POST',
    path: '/api/xero/queue/process?batchSize=10',
    auth: 'bearer',
  },
  'system-integrity': {
    method: 'GET',
    path: '/api/internal/system-integrity',
    auth: 'bearer',
  },
  'monitoring-alerts': {
    method: 'POST',
    path: '/api/monitoring/alerts',
    auth: 'bearer',
    body: '{}',
  },
};

function buildHeaders(target, secret) {
  const headers = { Accept: 'application/json' };
  if (target.auth === 'x-cron-secret') {
    headers['X-Cron-Secret'] = secret;
  } else {
    headers.Authorization = `Bearer ${secret}`;
  }
  if (target.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  return headers;
}

export async function invokeCronTarget(targetName, env = process.env) {
  const target = CRON_TARGETS[targetName];
  if (!target) {
    throw new Error(
      `Unknown cron target "${targetName}". Valid: ${Object.keys(CRON_TARGETS).join(', ')}`
    );
  }

  const secret = env.CRON_SECRET?.trim();
  const base = (env.CRON_BASE_URL || env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '');

  if (!secret) {
    throw new Error('CRON_SECRET is not set');
  }
  if (!base) {
    throw new Error('CRON_BASE_URL or NEXT_PUBLIC_APP_URL is not set');
  }

  const url = `${base}${target.path}`;
  const response = await fetch(url, {
    method: target.method,
    headers: buildHeaders(target, secret),
    body: target.body,
  });

  const text = await response.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = { raw: text.slice(0, 500) };
  }

  return {
    target: targetName,
    url,
    status: response.status,
    ok: response.ok,
    payload,
  };
}

async function main() {
  const targetName = process.argv[2];
  if (!targetName || targetName === '--help') {
    console.error(
      `Usage: node scripts/render-cron-invoke.mjs <target>\nTargets: ${Object.keys(CRON_TARGETS).join(', ')}`
    );
    process.exit(targetName ? 0 : 1);
  }

  try {
    const result = await invokeCronTarget(targetName);
    console.log(JSON.stringify(result, null, 2));
    if (!result.ok) {
      process.exit(1);
    }
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

const isMain =
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  main();
}
