/**
 * CLI: compare Claude vs OpenAI benchmark reports.
 * Usage (from src/):
 *   npm run benchmark:compare-providers
 *   npx tsx scripts/compare-benchmark-providers.ts --claude-report benchmark-report-claude.json --openai-report benchmark-report-openai.json
 */

import path from 'path';

import { compareBenchmarkProviders } from '@/lib/agreement-analyzer/evaluation/compare-benchmark-providers';

function parseArgs(argv: string[]) {
  let claudeReportPath = path.join(process.cwd(), 'benchmark-report-claude.json');
  let openaiReportPath = path.join(process.cwd(), 'benchmark-report-openai.json');
  let outputPath = path.join(process.cwd(), 'benchmark-comparison.md');

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--claude-report' && argv[index + 1]) {
      claudeReportPath = path.resolve(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg === '--openai-report' && argv[index + 1]) {
      openaiReportPath = path.resolve(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg === '--output' && argv[index + 1]) {
      outputPath = path.resolve(argv[index + 1]);
      index += 1;
    }
  }

  return { claudeReportPath, openaiReportPath, outputPath };
}

async function main() {
  const { claudeReportPath, openaiReportPath, outputPath } = parseArgs(process.argv.slice(2));
  const markdown = await compareBenchmarkProviders({
    claudeReportPath,
    openaiReportPath,
    outputPath,
  });

  console.log(markdown);
  console.log(`Comparison report written to ${outputPath}`);
}

main().catch((error) => {
  console.error('Benchmark provider comparison failed:', error);
  process.exit(1);
});
