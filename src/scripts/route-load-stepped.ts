import autocannon from 'autocannon';

type RouteSpec = {
  name: string;
  path: string;
  method: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: string;
};

type AggResult = {
  latency: Record<string, number> & { mean?: number; average?: number };
  requests: Record<string, number> & { sent?: number; mean?: number; average?: number };
  errors: number;
  timeouts: number;
  resets: number;
  mismatches: number;
  non2xx: number;
  '1xx': number;
  '2xx': number;
  '3xx': number;
  '4xx': number;
  '5xx': number;
};

const baseUrl = process.env.ROUTE_LOAD_BASE_URL || 'http://127.0.0.1:3000';
const durationSeconds = Number.parseInt(process.env.ROUTE_LOAD_DURATION_SECONDS || '20', 10);
const shortCode = process.env.ROUTE_LOAD_SHORT_CODE || 'INVALID01';
const concurrencies = [100, 250, 500, 1000];

const routes: RouteSpec[] = [
  { name: 'public merchant fetch', method: 'GET', path: `/api/public/merchant/${shortCode}` },
  { name: 'public pay fetch', method: 'GET', path: `/api/public/pay/${shortCode}` },
  { name: 'payment links list', method: 'GET', path: '/api/payment-links' },
  { name: 'health check', method: 'GET', path: '/api/health' },
  { name: 'public wise quote', method: 'GET', path: `/api/public/pay/${shortCode}/wise` },
];

function avgLatencyMs(latency: AggResult['latency']): number {
  return Math.round(latency.mean ?? latency.average ?? 0);
}

function p95LatencyMs(latency: AggResult['latency']): number {
  const p90 = latency.p90 ?? 0;
  const p975 = latency.p97_5 ?? latency.p99 ?? p90;
  if (p975 <= p90) return Math.round(p90);
  return Math.round(p90 + (p975 - p90) * ((95 - 90) / (97.5 - 90)));
}

function failureRatePercent(result: AggResult): number {
  const sent = result.requests.sent ?? 0;
  if (sent <= 0) return 0;
  const transport = (result.errors ?? 0) + (result.timeouts ?? 0) + (result.resets ?? 0) + (result.mismatches ?? 0);
  const httpNonSuccess = result.non2xx ?? 0;
  return Number((((transport + httpNonSuccess) / sent) * 100).toFixed(2));
}

function successfulRps(result: AggResult): number {
  return Number(((result['2xx'] ?? 0) / durationSeconds).toFixed(2));
}

async function runOne(route: RouteSpec, connections: number) {
  const run = autocannon({
    url: `${baseUrl}${route.path}`,
    method: route.method,
    headers: route.headers,
    body: route.body,
    connections,
    duration: durationSeconds,
    pipelining: 1,
    timeout: 30,
  });
  const result = (await run) as AggResult;
  return {
    route: route.path,
    routeName: route.name,
    concurrency: connections,
    avgLatencyMs: avgLatencyMs(result.latency),
    p95LatencyMs: p95LatencyMs(result.latency),
    errorRatePercent: failureRatePercent(result),
    successfulRps: successfulRps(result),
    requestsSent: result.requests.sent ?? 0,
    status2xx: result['2xx'] ?? 0,
    status4xx: result['4xx'] ?? 0,
    status5xx: result['5xx'] ?? 0,
    non2xx: result.non2xx ?? 0,
    errors: result.errors ?? 0,
    timeouts: result.timeouts ?? 0,
    resets: result.resets ?? 0,
    mismatches: result.mismatches ?? 0,
  };
}

async function warmup(route: RouteSpec) {
  try {
    await fetch(`${baseUrl}${route.path}`, {
      method: route.method,
      headers: route.headers,
      body: route.body,
    });
  } catch {
    // best effort warmup only
  }
}

async function main() {
  const results: Awaited<ReturnType<typeof runOne>>[] = [];
  for (const route of routes) {
    // eslint-disable-next-line no-await-in-loop
    await warmup(route);
    for (const concurrency of concurrencies) {
      // eslint-disable-next-line no-await-in-loop
      results.push(await runOne(route, concurrency));
    }
  }

  const byRoute = routes.map((r) => {
    const subset = results.filter((x) => x.route === r.path);
    const worst = subset.reduce((acc, cur) => (cur.errorRatePercent > acc.errorRatePercent ? cur : acc));
    return {
      route: r.path,
      routeName: r.name,
      worstErrorRatePercent: worst.errorRatePercent,
      worstP95LatencyMs: Math.max(...subset.map((x) => x.p95LatencyMs)),
      minSuccessfulRps: Math.min(...subset.map((x) => x.successfulRps)),
      totalErrors: subset.reduce((sum, x) => sum + x.errors + x.timeouts + x.resets, 0),
    };
  });

  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        baseUrl,
        durationSeconds,
        concurrencies,
        summaryByRoute: byRoute,
        results,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Stepped route load test failed:', error);
  process.exit(1);
});

