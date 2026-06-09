/**
 * CLI: evaluate agreement extraction quality against sample-agreements fixtures.
 * Usage (from src/):
 *   npx tsx scripts/evaluate-agreement-extractions.ts
 *   npx tsx scripts/evaluate-agreement-extractions.ts --samples-dir sample-agreements --output evaluation-report.json
 */

import path from 'path';

import {
  formatEvaluationTable,
  runAgreementExtractionEvaluation,
} from '@/lib/agreement-analyzer/evaluation/run-evaluation';

function parseArgs(argv: string[]) {
  let samplesDir = path.join(process.cwd(), 'sample-agreements');
  let outputPath = path.join(process.cwd(), 'evaluation-report.json');

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--samples-dir' && argv[index + 1]) {
      samplesDir = path.resolve(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg === '--output' && argv[index + 1]) {
      outputPath = path.resolve(argv[index + 1]);
      index += 1;
    }
  }

  return { samplesDir, outputPath };
}

async function main() {
  const { samplesDir, outputPath } = parseArgs(process.argv.slice(2));

  const report = await runAgreementExtractionEvaluation({
    samplesDirectory: samplesDir,
    outputPath,
  });

  console.log(formatEvaluationTable(report));
  console.log('');
  console.log(`Evaluation report written to ${outputPath}`);
  console.log(
    `Evaluated ${report.summary.evaluatedCount} sample(s); ${report.summary.missingActualCount} missing actual.json fixture(s).`
  );
}

main().catch((error) => {
  console.error('Agreement extraction evaluation failed:', error);
  process.exit(1);
});
