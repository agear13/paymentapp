import { readFile, readdir, writeFile } from 'fs/promises';
import path from 'path';

import {
  AGREEMENT_SAMPLE_IDS,
  ExpectedAgreementEvaluationSchema,
  type AgreementEvaluationResult,
  type EvaluationReport,
} from '@/lib/agreement-analyzer/evaluation/evaluation-types';
import { normalizeActualExtraction } from '@/lib/agreement-analyzer/evaluation/normalize-actual-extraction';
import {
  scoreAgreementEvaluation,
  zeroScoreAgreementEvaluation,
} from '@/lib/agreement-analyzer/evaluation/scoring';

async function readJsonFile(filePath: string): Promise<unknown> {
  const raw = await readFile(filePath, 'utf8');
  return JSON.parse(raw) as unknown;
}

async function listAgreementSampleIds(samplesDirectory: string): Promise<string[]> {
  const entries = await readdir(samplesDirectory, { withFileTypes: true });
  const discovered = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  const ordered = AGREEMENT_SAMPLE_IDS.filter((id) => discovered.includes(id));
  const extras = discovered.filter((id) => !AGREEMENT_SAMPLE_IDS.includes(id as never)).sort();
  return [...ordered, ...extras];
}

function buildSummary(agreements: AgreementEvaluationResult[]): EvaluationReport['summary'] {
  const evaluated = agreements.filter((item) => item.status === 'evaluated');
  const average = (values: number[]) =>
    values.length === 0
      ? 0
      : Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;

  return {
    evaluatedCount: evaluated.length,
    missingActualCount: agreements.filter((item) => item.status === 'missing_actual').length,
    averageRelationshipClassification: average(
      evaluated.map((item) => item.metrics.relationshipClassification.score)
    ),
    averageParties: average(evaluated.map((item) => item.metrics.parties.score)),
    averageRevenueSplits: average(evaluated.map((item) => item.metrics.revenueSplits.score)),
    averageObligations: average(evaluated.map((item) => item.metrics.obligations.score)),
    averageRisks: average(evaluated.map((item) => item.metrics.risks.score)),
    averageMissingClauses: average(evaluated.map((item) => item.metrics.missingClauses.score)),
    averageOverall: average(evaluated.map((item) => item.metrics.overall)),
  };
}

export async function runAgreementExtractionEvaluation(options: {
  samplesDirectory: string;
  outputPath: string;
}): Promise<EvaluationReport> {
  const sampleIds = await listAgreementSampleIds(options.samplesDirectory);
  const agreements: AgreementEvaluationResult[] = [];

  for (const agreementId of sampleIds) {
    const sampleDir = path.join(options.samplesDirectory, agreementId);
    const expectedPath = path.join(sampleDir, 'expected.json');
    const actualPath = path.join(sampleDir, 'actual.json');

    const expectedRaw = await readJsonFile(expectedPath);
    const expected = ExpectedAgreementEvaluationSchema.parse(expectedRaw);

    let actualRaw: unknown;
    try {
      actualRaw = await readJsonFile(actualPath);
    } catch {
      agreements.push(
        zeroScoreAgreementEvaluation(agreementId, expected, 'missing_actual', [
          `Missing ${path.join(agreementId, 'actual.json')}. Add an extraction output fixture to score this sample.`,
        ])
      );
      continue;
    }

    const actual = normalizeActualExtraction(actualRaw);
    if (!actual) {
      agreements.push(
        zeroScoreAgreementEvaluation(agreementId, expected, 'invalid_actual', [
          `Could not parse ${path.join(agreementId, 'actual.json')} as an extraction result.`,
        ])
      );
      continue;
    }

    agreements.push(scoreAgreementEvaluation(agreementId, expected, actual));
  }

  const report: EvaluationReport = {
    generatedAt: new Date().toISOString(),
    samplesDirectory: options.samplesDirectory,
    agreements,
    summary: buildSummary(agreements),
  };

  await writeFile(options.outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return report;
}

export function formatEvaluationTable(report: EvaluationReport): string {
  const header = [
    'Agreement'.padEnd(24),
    'Relationship %'.padStart(14),
    'Parties %'.padStart(10),
    'Revenue Splits %'.padStart(16),
    'Obligations %'.padStart(13),
    'Risks %'.padStart(9),
    'Missing Clauses %'.padStart(17),
    'Overall %'.padStart(10),
  ].join(' ');

  const rows = report.agreements.map((agreement) => {
    const { metrics } = agreement;
    return [
      agreement.agreementId.padEnd(24),
      metrics.relationshipClassification.score.toFixed(1).padStart(14),
      metrics.parties.score.toFixed(1).padStart(10),
      metrics.revenueSplits.score.toFixed(1).padStart(16),
      metrics.obligations.score.toFixed(1).padStart(13),
      metrics.risks.score.toFixed(1).padStart(9),
      metrics.missingClauses.score.toFixed(1).padStart(17),
      metrics.overall.toFixed(1).padStart(10),
    ].join(' ');
  });

  const summary = report.summary;
  const footer = [
    'AVERAGE'.padEnd(24),
    summary.averageRelationshipClassification.toFixed(1).padStart(14),
    summary.averageParties.toFixed(1).padStart(10),
    summary.averageRevenueSplits.toFixed(1).padStart(16),
    summary.averageObligations.toFixed(1).padStart(13),
    summary.averageRisks.toFixed(1).padStart(9),
    summary.averageMissingClauses.toFixed(1).padStart(17),
    summary.averageOverall.toFixed(1).padStart(10),
  ].join(' ');

  return [header, ...rows, footer].join('\n');
}
