/**
 * CLI: run production extraction on all sample agreements and score benchmark quality.
 * Usage (from src/):
 *   npm run benchmark:agreements
 *   npm run benchmark:agreements -- --provider=claude
 *   npm run benchmark:agreements -- --provider=openai
 */

import { config as loadEnv } from 'dotenv';
import path from 'path';

import {
  getAgreementExtractionProvider,
  getAgreementExtractionProviderApiKeyError,
} from '@/lib/agreement-analyzer/ai/get-agreement-extraction-provider';
import {
  getProviderApiKeyEnvName,
  resolveAgreementExtractionProviderId,
} from '@/lib/agreement-analyzer/ai/provider-config';
import { runAgreementBenchmark } from '@/lib/agreement-analyzer/evaluation/run-benchmark';

loadEnv({ path: path.join(process.cwd(), '.env') });

function parseArgs(argv: string[]) {
  let samplesDir = path.join(process.cwd(), 'sample-agreements');
  let jsonOutputPath = path.join(process.cwd(), 'benchmark-report.json');
  let mdOutputPath = path.join(process.cwd(), 'benchmark-report.md');
  let providerOverride: string | null = null;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--samples-dir' && argv[index + 1]) {
      samplesDir = path.resolve(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg === '--json-output' && argv[index + 1]) {
      jsonOutputPath = path.resolve(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg === '--md-output' && argv[index + 1]) {
      mdOutputPath = path.resolve(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg.startsWith('--provider=')) {
      providerOverride = arg.slice('--provider='.length);
      continue;
    }
    if (arg === '--provider' && argv[index + 1]) {
      providerOverride = argv[index + 1];
      index += 1;
    }
  }

  const providerId = resolveAgreementExtractionProviderId(providerOverride);
  const usedDefaultOutputPaths =
    jsonOutputPath === path.join(process.cwd(), 'benchmark-report.json') &&
    mdOutputPath === path.join(process.cwd(), 'benchmark-report.md');

  if (providerOverride && usedDefaultOutputPaths) {
    jsonOutputPath = path.join(process.cwd(), `benchmark-report-${providerId}.json`);
    mdOutputPath = path.join(process.cwd(), `benchmark-report-${providerId}.md`);
  }

  return { samplesDir, jsonOutputPath, mdOutputPath, providerId };
}

async function main() {
  const { samplesDir, jsonOutputPath, mdOutputPath, providerId } = parseArgs(process.argv.slice(2));
  const provider = getAgreementExtractionProvider(providerId);

  if (!provider.isConfigured()) {
    const envName = getProviderApiKeyEnvName(providerId);
    console.error(`${getAgreementExtractionProviderApiKeyError(providerId)} (${envName})`);
    process.exit(1);
  }

  console.log(`Running agreement benchmark on ${samplesDir} using ${providerId} (${provider.modelName})...`);
  const report = await runAgreementBenchmark({
    samplesDirectory: samplesDir,
    jsonOutputPath,
    mdOutputPath,
    providerId,
  });

  console.log('');
  console.log('Benchmark complete.');
  console.log(`Provider: ${report.provider.provider} (${report.provider.model})`);
  console.log(
    `Extraction: ${report.extraction.succeeded}/${report.extraction.processed} succeeded (${report.extraction.failed} failed).`
  );
  console.log(`Overall accuracy: ${report.overallMetrics.overall.toFixed(1)}%`);
  console.log(`JSON report: ${jsonOutputPath}`);
  console.log(`Markdown report: ${mdOutputPath}`);
}

main().catch((error) => {
  console.error('Agreement benchmark failed:', error);
  process.exit(1);
});
