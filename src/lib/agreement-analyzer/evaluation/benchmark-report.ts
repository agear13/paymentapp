import { analyzeAgreementFailures } from '@/lib/agreement-analyzer/evaluation/failure-analysis';
import type {
  AgreementBenchmarkCategory,
  AgreementBenchmarkDifficulty,
  BenchmarkCategorySummary,
  BenchmarkPerAgreementResult,
  BenchmarkProviderMetadata,
  BenchmarkReport,
  ExpectedAgreementEvaluation,
} from '@/lib/agreement-analyzer/evaluation/evaluation-types';
import { normalizeActualExtraction } from '@/lib/agreement-analyzer/evaluation/normalize-actual-extraction';

const BENCHMARK_CATEGORIES: AgreementBenchmarkCategory[] = [
  'revenueShare',
  'event',
  'service',
  'partnership',
];

const BENCHMARK_DIFFICULTIES: AgreementBenchmarkDifficulty[] = ['simple', 'medium', 'complex'];

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}

function emptySummary(): BenchmarkCategorySummary {
  return {
    count: 0,
    relationshipClassification: 0,
    parties: 0,
    revenueSplits: 0,
    obligations: 0,
    risks: 0,
    missingClauses: 0,
    overall: 0,
  };
}

function buildGroupSummary(items: BenchmarkPerAgreementResult[]): BenchmarkCategorySummary {
  if (items.length === 0) {
    return emptySummary();
  }

  return {
    count: items.length,
    relationshipClassification: average(
      items.map((item) => item.metrics.relationshipClassification.score)
    ),
    parties: average(items.map((item) => item.metrics.parties.score)),
    revenueSplits: average(items.map((item) => item.metrics.revenueSplits.score)),
    obligations: average(items.map((item) => item.metrics.obligations.score)),
    risks: average(items.map((item) => item.metrics.risks.score)),
    missingClauses: average(items.map((item) => item.metrics.missingClauses.score)),
    overall: average(items.map((item) => item.metrics.overall)),
  };
}

function buildOverallMetrics(items: BenchmarkPerAgreementResult[]): BenchmarkReport['overallMetrics'] {
  const summary = buildGroupSummary(items);
  return {
    relationshipClassification: summary.relationshipClassification,
    parties: summary.parties,
    revenueSplits: summary.revenueSplits,
    obligations: summary.obligations,
    risks: summary.risks,
    missingClauses: summary.missingClauses,
    overall: summary.overall,
  };
}

function sortByOverall(items: BenchmarkPerAgreementResult[]): BenchmarkPerAgreementResult[] {
  return [...items].sort((left, right) => right.metrics.overall - left.metrics.overall);
}

export function buildBenchmarkReport(input: {
  samplesDirectory: string;
  provider: BenchmarkProviderMetadata;
  extraction: BenchmarkReport['extraction'];
  perAgreement: BenchmarkPerAgreementResult[];
  actualByAgreementId: Record<string, unknown>;
  expectedByAgreementId: Record<string, ExpectedAgreementEvaluation>;
}): BenchmarkReport {
  const perAgreement = sortByOverall(input.perAgreement);

  const failureAnalysis = perAgreement
    .filter((item) => item.metrics.overall < 80)
    .map((item) => {
      const expected = input.expectedByAgreementId[item.agreementId];
      const actualRaw = input.actualByAgreementId[item.agreementId];
      const actual = normalizeActualExtraction(actualRaw);
      if (!expected || !actual) return null;
      return analyzeAgreementFailures(item.agreementId, item.metrics.overall, expected, actual);
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const categorySummaries = Object.fromEntries(
    BENCHMARK_CATEGORIES.map((category) => [
      category,
      buildGroupSummary(perAgreement.filter((item) => item.category === category)),
    ])
  ) as Record<AgreementBenchmarkCategory, BenchmarkCategorySummary>;

  const difficultySummaries = Object.fromEntries(
    BENCHMARK_DIFFICULTIES.map((difficulty) => [
      difficulty,
      buildGroupSummary(perAgreement.filter((item) => item.difficulty === difficulty)),
    ])
  ) as Record<AgreementBenchmarkDifficulty, BenchmarkCategorySummary>;

  return {
    generatedAt: new Date().toISOString(),
    samplesDirectory: input.samplesDirectory,
    provider: input.provider,
    extraction: input.extraction,
    overallMetrics: buildOverallMetrics(perAgreement),
    perAgreement,
    topPerformers: perAgreement.slice(0, 5),
    bottomPerformers: [...perAgreement]
      .sort((a, b) => a.metrics.overall - b.metrics.overall)
      .slice(0, 5),
    failureAnalysis,
    categorySummaries,
    difficultySummaries,
  };
}

function formatMetricLine(label: string, value: number): string {
  return `- ${label}: ${value.toFixed(1)}%`;
}

function formatAgreementRow(item: BenchmarkPerAgreementResult): string {
  const { metrics } = item;
  return [
    `### ${item.agreementId}`,
    `- Category: ${item.category ?? 'unknown'}`,
    `- Difficulty: ${item.difficulty ?? 'unknown'}`,
    `- Relationship Classification: ${metrics.relationshipClassification.score.toFixed(1)}%`,
    `- Parties: ${metrics.parties.score.toFixed(1)}%`,
    `- Revenue Splits: ${metrics.revenueSplits.score.toFixed(1)}%`,
    `- Obligations: ${metrics.obligations.score.toFixed(1)}%`,
    `- Risks: ${metrics.risks.score.toFixed(1)}%`,
    `- Missing Clauses: ${metrics.missingClauses.score.toFixed(1)}%`,
    `- Overall: ${metrics.overall.toFixed(1)}%`,
  ].join('\n');
}

function formatGroupSummary(title: string, summary: BenchmarkCategorySummary): string {
  return [
    `### ${title}`,
    `- Agreements: ${summary.count}`,
    formatMetricLine('Relationship Classification', summary.relationshipClassification),
    formatMetricLine('Parties', summary.parties),
    formatMetricLine('Revenue Splits', summary.revenueSplits),
    formatMetricLine('Obligations', summary.obligations),
    formatMetricLine('Risks', summary.risks),
    formatMetricLine('Missing Clauses', summary.missingClauses),
    formatMetricLine('Overall', summary.overall),
  ].join('\n');
}

export function formatBenchmarkMarkdown(report: BenchmarkReport): string {
  const { overallMetrics, extraction } = report;
  const sections = [
    '# Agreement Extraction Benchmark Report',
    '',
    `Generated: ${report.generatedAt}`,
    `Samples directory: ${report.samplesDirectory}`,
    `Provider: ${report.provider.provider}`,
    `Model: ${report.provider.model}`,
    '',
    '## Extraction Run',
    `- Processed: ${extraction.processed}`,
    `- Succeeded: ${extraction.succeeded}`,
    `- Failed: ${extraction.failed}`,
    '',
    '## Overall Metrics',
    formatMetricLine('Relationship Classification Accuracy', overallMetrics.relationshipClassification),
    formatMetricLine('Parties Accuracy', overallMetrics.parties),
    formatMetricLine('Revenue Split Accuracy', overallMetrics.revenueSplits),
    formatMetricLine('Obligation Accuracy', overallMetrics.obligations),
    formatMetricLine('Risk Accuracy', overallMetrics.risks),
    formatMetricLine('Missing Clause Accuracy', overallMetrics.missingClauses),
    formatMetricLine('Overall Accuracy', overallMetrics.overall),
    '',
    '## Per Agreement Metrics',
    ...report.perAgreement.map((item) => formatAgreementRow(item)),
    '',
    '## Top 5 Highest Scoring Agreements',
    ...report.topPerformers.map(
      (item) =>
        `- ${item.agreementId} (${item.category ?? 'unknown'}, ${item.difficulty ?? 'unknown'}): ${item.metrics.overall.toFixed(1)}%`
    ),
    '',
    '## Bottom 5 Lowest Scoring Agreements',
    ...report.bottomPerformers.map(
      (item) =>
        `- ${item.agreementId} (${item.category ?? 'unknown'}, ${item.difficulty ?? 'unknown'}): ${item.metrics.overall.toFixed(1)}%`
    ),
    '',
    '## Failure Analysis (<80% Overall)',
    report.failureAnalysis.length === 0
      ? 'No agreements scored below 80% overall.'
      : report.failureAnalysis
          .map((item) =>
            [
              `### ${item.agreementId} (${item.overallScore.toFixed(1)}%)`,
              item.missingParties.length > 0
                ? `- Missing parties: ${item.missingParties.join('; ')}`
                : '- Missing parties: none identified',
              item.missingRevenueSplits.length > 0
                ? `- Missing revenue splits: ${item.missingRevenueSplits.join('; ')}`
                : '- Missing revenue splits: none identified',
              `- Missing obligations: ${item.missingObligations}`,
              `- Missing risks: ${item.missingRisks}`,
              `- Missing clauses: ${item.missingClauses}`,
            ].join('\n')
          )
          .join('\n\n'),
    '',
    '## Category Summaries',
    formatGroupSummary('Revenue Share Average', report.categorySummaries.revenueShare),
    '',
    formatGroupSummary('Event Average', report.categorySummaries.event),
    '',
    formatGroupSummary('Service Average', report.categorySummaries.service),
    '',
    formatGroupSummary('Partnership Average', report.categorySummaries.partnership),
    '',
    '## Difficulty Summaries',
    formatGroupSummary('Simple Average', report.difficultySummaries.simple),
    '',
    formatGroupSummary('Medium Average', report.difficultySummaries.medium),
    '',
    formatGroupSummary('Complex Average', report.difficultySummaries.complex),
  ];

  return `${sections.join('\n')}\n`;
}
