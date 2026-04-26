import autocannon from 'autocannon';

type Scenario = {
  name: string;
  path: string;
  method: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: string;
};

/** Autocannon v8 aggregate result (subset). */
type AggResult = {
  latency: Record<string, number> & { mean?: number; average?: number };
  requests: Record<string, number> & { sent?: number; mean?: number; average?: number };
  errors: number;
  timeouts: number;
  mismatches: number;
  non2xx: number;
  resets: number;
  '1xx': number;
  '2xx': number;
  '3xx': number;
  '4xx': number;
  '5xx': number;
};

function approxP95Ms(latency: AggResult['latency']): number {
  const p90 = latency.p90 ?? 0;
  const p975 = latency.p97_5 ?? latency.p99 ?? p90;
  if (p975 <= p90) return Math.round(p90);
  // Linear interpolation between p90 and p97.5 for a conventional "p95" readout.
  return Math.round(p90 + (p975 - p90) * ((95 - 90) / (97.5 - 90)));
}

function meanLatencyMs(latency: AggResult['latency']): number {
  return Math.round(latency.mean ?? latency.average ?? 0);
}

function requestsPerSec(requests: AggResult['requests']): number {
  return Number((requests.mean ?? requests.average ?? 0).toFixed(2));
}

function attemptedThroughputRps(sent: number): number {
  return Number((sent / durationSeconds).toFixed(2));
}

function failureRatePercent(result: AggResult): number {
  const sent = result.requests.sent ?? 0;
  if (sent <= 0) return 0;
  const transport =
    (result.errors ?? 0) +
    (result.timeouts ?? 0) +
    (result.mismatches ?? 0) +
    (result.resets ?? 0);
  // autocannon `non2xx` counts 1xx + 3xx + 4xx + 5xx; do not add `5xx` again.
  const httpNonSuccess = result.non2xx ?? 0;
  return Number((((transport + httpNonSuccess) / sent) * 100).toFixed(2));
}

const baseUrl = process.env.LOAD_TEST_BASE_URL || 'http://127.0.0.1:3000';
const durationSeconds = Number.parseInt(process.env.LOAD_TEST_DURATION_SECONDS || '30', 10);
const concurrency = Number.parseInt(process.env.LOAD_TEST_CONCURRENCY || '1000', 10);
const shortCode = process.env.LOAD_TEST_SHORT_CODE || 'INVALID01';

const scenarios: Scenario[] = [
  {
    name: 'public checkout fetch',
    method: 'GET',
    path: `/api/public/pay/${shortCode}`,
  },
  {
    name: 'public merchant fetch',
    method: 'GET',
    path: `/api/public/merchant/${shortCode}`,
  },
  {
    name: 'webhook simulation endpoint health',
    method: 'GET',
    path: '/api/health',
  },
];

async function runScenario(s: Scenario) {
  const instance = autocannon({
    url: `${baseUrl}${s.path}`,
    method: s.method,
    headers: s.headers,
    body: s.body,
    duration: durationSeconds,
    connections: concurrency,
    pipelining: 1,
    timeout: 30,
  });

  if (process.env.LOAD_TEST_SHOW_PROGRESS === '1') {
    autocannon.track(instance, { renderProgressBar: true });
  }
  const result = (await instance) as AggResult;

  const statusTotal =
    (result['1xx'] ?? 0) +
    (result['2xx'] ?? 0) +
    (result['3xx'] ?? 0) +
    (result['4xx'] ?? 0) +
    (result['5xx'] ?? 0);

  const sent = result.requests.sent ?? 0;
  const meanLatency = meanLatencyMs(result.latency);
  const p95Approx = approxP95Ms(result.latency);

  return {
    scenario: s.name,
    path: s.path,
    avgLatencyMs: statusTotal > 0 ? meanLatency : null,
    p95ApproxLatencyMs: statusTotal > 0 ? p95Approx : null,
    p90LatencyMs: Math.round(result.latency.p90 ?? 0),
    p975LatencyMs: Math.round(result.latency.p97_5 ?? 0),
    requestsPerSec: requestsPerSec(result.requests),
    attemptedThroughputRps: attemptedThroughputRps(sent),
    requestsSent: sent,
    statusResponsesTotal: statusTotal,
    errors: result.errors,
    timeouts: result.timeouts,
    non2xx: result.non2xx,
    errors5xx: result['5xx'],
    failureRatePercent: failureRatePercent(result),
  };
}

async function main() {
  // eslint-disable-next-line no-console
  console.error(
    'Tip: start the app with RELAX_ENV_VALIDATION=1 in development if you lack a full .env (never in production).',
  );

  const output = [];
  for (const scenario of scenarios) {
    // Keep scenarios serial to avoid mixed metrics.
    // eslint-disable-next-line no-await-in-loop
    const result = await runScenario(scenario);
    output.push(result);
  }

  const totalSent = output.reduce((s, r) => s + r.requestsSent, 0);
  const weighted = (pick: (r: (typeof output)[0]) => number | null) => {
    const numer = output.reduce((sum, r) => {
      const value = pick(r);
      return value == null ? sum : sum + value * r.requestsSent;
    }, 0);
    const denom = output.reduce((sum, r) => {
      const value = pick(r);
      return value == null ? sum : sum + r.requestsSent;
    }, 0);
    return denom > 0 ? Number((numer / denom).toFixed(2)) : null;
  };

  const summary = {
    aggregateWeightedAvgLatencyMs: weighted((r) => r.avgLatencyMs),
    aggregateWeightedP95ApproxLatencyMs: weighted((r) => r.p95ApproxLatencyMs),
    aggregateWeightedFailureRatePercent: weighted((r) => r.failureRatePercent),
    aggregateTotalThroughputRps: Number(
      output.reduce((s, r) => s + r.requestsPerSec, 0).toFixed(2),
    ),
    aggregateAttemptedThroughputRps: Number(
      output.reduce((s, r) => s + r.attemptedThroughputRps, 0).toFixed(2),
    ),
    totalRequestsSent: totalSent,
    note:
      'Weighted metrics use requestsSent per scenario; throughput is sum of per-scenario mean RPS (serial scenarios).',
  };

  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify({ baseUrl, durationSeconds, concurrency, summary, results: output }, null, 2),
  );
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Load test failed:', error);
  process.exit(1);
});
