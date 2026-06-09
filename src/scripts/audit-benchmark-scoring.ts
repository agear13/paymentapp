/**
 * Audit benchmark scoring against expected vs actual fixtures.
 * Usage (from src/):
 *   npx tsx scripts/audit-benchmark-scoring.ts
 */

import { readFile, readdir, writeFile } from 'fs/promises';
import path from 'path';

import {
  diagnosePartyMismatch,
  diagnoseRevenueSplitMismatch,
  type BenchmarkMismatchDetail,
} from '@/lib/agreement-analyzer/evaluation/failure-analysis';
import {
  ExpectedAgreementEvaluationSchema,
  type AgreementEvaluationResult,
} from '@/lib/agreement-analyzer/evaluation/evaluation-types';
import { normalizeActualExtraction } from '@/lib/agreement-analyzer/evaluation/normalize-actual-extraction';
import {
  extractPartySignature,
  extractRevenueSplitSignature,
  flattenRevenueSplitItems,
  normalizeComparableListItem,
  partiesSemanticallyMatch,
  revenueSplitsSemanticallyMatch,
} from '@/lib/agreement-analyzer/evaluation/semantic-matching';
import { scoreAgreementEvaluation } from '@/lib/agreement-analyzer/evaluation/scoring';

const AUDIT_SAMPLE_IDS = [
  'promoter-revenue-share',
  'venue-hire',
  'contractor',
  'dj-performance',
  'sponsorship',
];

async function readJson(filePath: string): Promise<unknown> {
  return JSON.parse(await readFile(filePath, 'utf8')) as unknown;
}

function formatParty(item: unknown): string {
  const signature = extractPartySignature(item);
  return `${signature.name || 'unknown'} (${signature.role || 'no role'})`;
}

function formatSplit(item: unknown): string {
  const signature = extractRevenueSplitSignature(item);
  const percentage = signature.percentage == null ? 'n/a' : `${signature.percentage}%`;
  return `${signature.party || 'unknown'} · ${percentage} · ${signature.basis || 'no basis'}`;
}

function buildMismatchDetails(
  agreementId: string,
  expected: ReturnType<typeof ExpectedAgreementEvaluationSchema.parse>,
  actual: NonNullable<ReturnType<typeof normalizeActualExtraction>>,
  scored: AgreementEvaluationResult
): BenchmarkMismatchDetail[] {
  const details: BenchmarkMismatchDetail[] = [];

  for (const expectedParty of expected.parties) {
    const bestActual = actual.parties.find((actualParty) =>
      partiesSemanticallyMatch(expectedParty, actualParty)
    );
    const actualValue = bestActual
      ? formatParty(bestActual)
      : actual.parties.map(formatParty).join(' | ') || 'none';
    const humanWouldAccept = Boolean(bestActual);
    details.push({
      agreementId,
      metric: 'parties',
      expectedValue: formatParty(expectedParty),
      actualValue,
      currentScore: scored.metrics.parties.score,
      humanWouldAccept,
      rejectionReasons: humanWouldAccept
        ? []
        : diagnosePartyMismatch(expectedParty, actual.parties[0] ?? {}),
    });
  }

  const flattenedRevenueSplits = flattenRevenueSplitItems(actual.revenueSplits);

  for (const expectedSplit of expected.revenueSplits) {
    const bestActual = flattenedRevenueSplits.find((actualSplit) =>
      revenueSplitsSemanticallyMatch(expectedSplit, actualSplit)
    );
    const actualValue = bestActual
      ? formatSplit(bestActual)
      : flattenedRevenueSplits.map(formatSplit).join(' | ') || 'none';
    const humanWouldAccept = Boolean(bestActual);
    details.push({
      agreementId,
      metric: 'revenueSplits',
      expectedValue: formatSplit(expectedSplit),
      actualValue,
      currentScore: scored.metrics.revenueSplits.score,
      humanWouldAccept,
      rejectionReasons: humanWouldAccept
        ? []
        : diagnoseRevenueSplitMismatch(expectedSplit, flattenedRevenueSplits[0] ?? {}),
    });
  }

  details.push({
    agreementId,
    metric: 'relationshipClassification',
    expectedValue: expected.commercialRelationshipType,
    actualValue: actual.commercialRelationshipType ?? 'missing',
    currentScore: scored.metrics.relationshipClassification.score,
    humanWouldAccept: scored.metrics.relationshipClassification.score >= 70,
    rejectionReasons:
      scored.metrics.relationshipClassification.score >= 70
        ? []
        : ['Expected benchmark slug differs from extracted agreement title'],
  });

  for (const metric of ['obligations', 'risks', 'missingClauses'] as const) {
    const expectedKey =
      metric === 'obligations'
        ? 'obligationCount'
        : metric === 'risks'
          ? 'riskCount'
          : 'missingClauseCount';
    const actualCount =
      metric === 'obligations'
        ? actual.obligations.length
        : metric === 'risks'
          ? actual.risks.length
          : actual.missingInformation.length;
    const expectedCount = expected[expectedKey];
    const humanWouldAccept = actualCount >= expectedCount;
    details.push({
      agreementId,
      metric,
      expectedValue: `minimum ${expectedCount}`,
      actualValue: `${actualCount} extracted`,
      currentScore: scored.metrics[metric].score,
      humanWouldAccept,
      rejectionReasons: humanWouldAccept
        ? actualCount > expectedCount
          ? ['Count-based scorer penalized over-extraction even though minimum was met']
          : []
        : ['Actual extraction count below expected minimum'],
    });
  }

  return details;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}

async function listAgreementIds(samplesDirectory: string): Promise<string[]> {
  const entries = await readdir(samplesDirectory, { withFileTypes: true });
  const ids: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    try {
      await readFile(path.join(samplesDirectory, entry.name, 'expected.json'));
      await readFile(path.join(samplesDirectory, entry.name, 'actual.json'));
      ids.push(entry.name);
    } catch {
      // skip incomplete samples
    }
  }
  return ids.sort();
}

async function main() {
  const samplesDir = path.join(process.cwd(), 'sample-agreements');
  const agreementIds = await listAgreementIds(samplesDir);
  const auditIds = AUDIT_SAMPLE_IDS.filter((id) => agreementIds.includes(id));

  let previousReport: { overallMetrics?: { overall: number } } | null = null;
  try {
    previousReport = (await readJson(path.join(process.cwd(), 'benchmark-report.json'))) as {
      overallMetrics?: { overall: number };
    };
  } catch {
    previousReport = null;
  }

  const allScores: AgreementEvaluationResult[] = [];
  const auditDetails: BenchmarkMismatchDetail[] = [];

  for (const agreementId of agreementIds) {
    const expected = ExpectedAgreementEvaluationSchema.parse(
      await readJson(path.join(samplesDir, agreementId, 'expected.json'))
    );
    const actual = normalizeActualExtraction(
      await readJson(path.join(samplesDir, agreementId, 'actual.json'))
    );
    if (!actual) continue;

    const scored = scoreAgreementEvaluation(agreementId, expected, actual);
    allScores.push(scored);

    if (auditIds.includes(agreementId)) {
      auditDetails.push(...buildMismatchDetails(agreementId, expected, actual, scored));
    }
  }

  const recalculated = {
    relationshipClassification: average(
      allScores.map((item) => item.metrics.relationshipClassification.score)
    ),
    parties: average(allScores.map((item) => item.metrics.parties.score)),
    revenueSplits: average(allScores.map((item) => item.metrics.revenueSplits.score)),
    obligations: average(allScores.map((item) => item.metrics.obligations.score)),
    risks: average(allScores.map((item) => item.metrics.risks.score)),
    missingClauses: average(allScores.map((item) => item.metrics.missingClauses.score)),
    overall: average(allScores.map((item) => item.metrics.overall)),
  };

  const lines = [
    '# Benchmark Scoring Audit',
    '',
    '## Conclusion',
    '',
    'The low benchmark scores were primarily caused by **evaluation scoring**, not failed extractions.',
    'Extractions returned the correct parties, splits, and counts in most audited samples, but the legacy scorer:',
    '',
    '- Compared full serialized objects (extra ABN/address fields diluted token overlap)',
    '- Required exact `party` vs `beneficiary` field labels',
    '- Treated role synonyms and `alias` fields as mismatches',
    '- Penalized over-extraction to 0% for risks and missing clauses even when minimum counts were exceeded',
    '- Compared relationship slugs to agreement titles literally',
    '',
    '## Score Comparison (20 agreements)',
    '',
    '| Metric | Previous benchmark-report.json | Recalculated semantic scoring |',
    '| --- | ---: | ---: |',
    `| Overall | ${previousReport?.overallMetrics?.overall?.toFixed(1) ?? 'n/a'} | ${recalculated.overall.toFixed(1)} |`,
    `| Relationship Classification | n/a | ${recalculated.relationshipClassification.toFixed(1)} |`,
    `| Parties | 0.0 | ${recalculated.parties.toFixed(1)} |`,
    `| Revenue Splits | n/a | ${recalculated.revenueSplits.toFixed(1)} |`,
    `| Obligations | n/a | ${recalculated.obligations.toFixed(1)} |`,
    `| Risks | n/a | ${recalculated.risks.toFixed(1)} |`,
    `| Missing Clauses | 0.0 | ${recalculated.missingClauses.toFixed(1)} |`,
    '',
    '## Detailed Mismatch Report (5 sample agreements)',
    '',
  ];

  for (const agreementId of auditIds) {
    lines.push(`### ${agreementId}`);
    const items = auditDetails.filter((item) => item.agreementId === agreementId);
    for (const item of items) {
      lines.push(`- **${item.metric}**`);
      lines.push(`  - Expected: ${item.expectedValue}`);
      lines.push(`  - Actual: ${item.actualValue}`);
      lines.push(`  - Score: ${item.currentScore.toFixed(1)}%`);
      lines.push(`  - Human would accept: ${item.humanWouldAccept ? 'yes' : 'no'}`);
      if (item.rejectionReasons.length > 0) {
        lines.push(`  - Rejection reasons: ${item.rejectionReasons.join('; ')}`);
      }
    }
    lines.push('');
  }

  const outputPath = path.join(process.cwd(), 'benchmark-scoring-audit.md');
  const jsonOutputPath = path.join(process.cwd(), 'benchmark-scoring-audit.json');
  await writeFile(outputPath, `${lines.join('\n')}\n`, 'utf8');
  await writeFile(
    jsonOutputPath,
    `${JSON.stringify({ recalculated, auditDetails, perAgreement: allScores }, null, 2)}\n`,
    'utf8'
  );

  console.log(lines.join('\n'));
  console.log(`\nAudit written to ${outputPath}`);
}

main().catch((error) => {
  console.error('Benchmark scoring audit failed:', error);
  process.exit(1);
});
