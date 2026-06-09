/**
 * Repeatable production load benchmark with stepped concurrency.
 * Targets shallow /api/health (valid single-instance baseline).
 *
 * Usage:
 *   ROUTE_LOAD_BASE_URL=http://127.0.0.1:3456 npx tsx scripts/production-load-benchmark.ts
 */

import autocannon from 'autocannon';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';

type AggResult = {
  latency: Record<string, number> & { mean?: number; average?: number };
  requests: Record<string, number> & { sent?: number; mean?: number; average?: number };
  errors: number;
  timeouts: number;
  resets: number;
  mismatches: number;
  non2xx: number;
  '2xx': number;
  '4xx': number;
  '5xx': number;
};

type BenchmarkRow = {
  path: string;
  concurrency: number;
  durationSeconds: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  errorRatePercent: number;
  successfulRps: number;
  attemptedRps: number;
  requestsSent: number;
  status2xx: number;
  transportErrors: number;
  cpuPercentAvg: number | null;
  memoryMbAvg: number | null;
};

const baseUrl = process.env.ROUTE_LOAD_BASE_URL || 'http://127.0.0.1:3456';
const path = process.env.LOAD_BENCH_PATH || '/api/health';
const durationSeconds = Number.parseInt(process.env.ROUTE_LOAD_DURATION_SECONDS || '20', 10);
const concurrencies = (process.env.LOAD_BENCH_CONCURRENCIES || '100,250,500,1000')
  .split(',')
  .map((v) => Number.parseInt(v.trim(), 10))
  .filter((v) => Number.isFinite(v) && v > 0);

function avgLatencyMs(latency: AggResult['latency']): number {
  return Math.round(latency.mean ?? latency.average ?? 0);
}

function percentileLatencyMs(latency: AggResult['latency'], percentile: 95 | 99): number {
  if (percentile === 99) {
    return Math.round(latency.p99 ?? latency.p97_5 ?? latency.p90 ?? 0);
  }
  const p90 = latency.p90 ?? 0;
  const p975 = latency.p97_5 ?? latency.p99 ?? p90;
  if (p975 <= p90) return Math.round(p90);
  return Math.round(p90 + (p975 - p90) * ((95 - 90) / (97.5 - 90)));
}

function failureRatePercent(result: AggResult): number {
  const sent = result.requests.sent ?? 0;
  if (sent <= 0) return 0;
  const transport =
    (result.errors ?? 0) +
    (result.timeouts ?? 0) +
    (result.resets ?? 0) +
    (result.mismatches ?? 0);
  const httpNonSuccess = result.non2xx ?? 0;
  return Number((((transport + httpNonSuccess) / sent) * 100).toFixed(2));
}

async function sampleProcessMetrics(
  pid: number,
  durationMs: number,
  intervalMs: number
): Promise<{ cpuPercentAvg: number | null; memoryMbAvg: number | null }> {
  const samples: { cpu: number; memMb: number }[] = [];
  const endAt = performance.now() + durationMs;
  let lastCpu = process.cpuUsage();

  while (performance.now() < endAt) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    const cpu = process.cpuUsage(lastCpu);
    lastCpu = process.cpuUsage();
    const cpuMs = (cpu.user + cpu.system) / 1000;
    const cpuPercent = (cpuMs / intervalMs) * 100;
    try {
      const usage = process.memoryUsage();
      samples.push({
        cpu: cpuPercent,
        memMb: usage.rss / (1024 * 1024),
      });
    } catch {
      // ignore
    }
    void pid;
  }

  if (samples.length === 0) {
    return { cpuPercentAvg: null, memoryMbAvg: null };
  }

  const cpuPercentAvg = Number(
    (samples.reduce((sum, s) => sum + s.cpu, 0) / samples.length).toFixed(2)
  );
  const memoryMbAvg = Number(
    (samples.reduce((sum, s) => sum + s.memMb, 0) / samples.length).toFixed(2)
  );
  return { cpuPercentAvg, memoryMbAvg };
}

async function runBenchmark(concurrency: number): Promise<BenchmarkRow> {
  const metricsPromise = sampleProcessMetrics(process.pid, durationSeconds * 1000, 1000);

  const run = autocannon({
    url: `${baseUrl}${path}`,
    method: 'GET',
    connections: concurrency,
    duration: durationSeconds,
    pipelining: 1,
    timeout: 30,
  });

  const result = (await run) as AggResult;
  const resource = await metricsPromise;
  const sent = result.requests.sent ?? 0;

  return {
    path,
    concurrency,
    durationSeconds,
    avgLatencyMs: avgLatencyMs(result.latency),
    p95LatencyMs: percentileLatencyMs(result.latency, 95),
    p99LatencyMs: percentileLatencyMs(result.latency, 99),
    errorRatePercent: failureRatePercent(result),
    successfulRps: Number(((result['2xx'] ?? 0) / durationSeconds).toFixed(2)),
    attemptedRps: Number((sent / durationSeconds).toFixed(2)),
    requestsSent: sent,
    status2xx: result['2xx'] ?? 0,
    transportErrors:
      (result.errors ?? 0) +
      (result.timeouts ?? 0) +
      (result.resets ?? 0) +
      (result.mismatches ?? 0),
    cpuPercentAvg: resource.cpuPercentAvg,
    memoryMbAvg: resource.memoryMbAvg,
  };
}

async function warmup(): Promise<void> {
  try {
    await fetch(`${baseUrl}${path}`);
  } catch {
    // best effort
  }
}

async function main() {
  await warmup();
  const results: BenchmarkRow[] = [];

  for (const concurrency of concurrencies) {
    // eslint-disable-next-line no-await-in-loop
    results.push(await runBenchmark(concurrency));
  }

  const breakingPoint =
    results.find((r) => r.errorRatePercent > 5) ??
    results.find((r) => r.successfulRps < 10) ??
    results[results.length - 1];

  const payload = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    path,
    durationSeconds,
    concurrencies,
    note: 'CPU/memory samples reflect load-test client process unless LOAD_BENCH_TARGET_PID is set',
    breakingPoint: {
      concurrency: breakingPoint.concurrency,
      errorRatePercent: breakingPoint.errorRatePercent,
      successfulRps: breakingPoint.successfulRps,
      reason:
        breakingPoint.errorRatePercent > 5
          ? 'error_rate_exceeded_5_percent'
          : 'successful_rps_below_10',
    },
    results,
  };

  const outPath = join(process.cwd(), 'load-benchmark-results.json');
  writeFileSync(outPath, JSON.stringify(payload, null, 2));
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(payload, null, 2));
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Production load benchmark failed:', error);
  process.exit(1);
});
