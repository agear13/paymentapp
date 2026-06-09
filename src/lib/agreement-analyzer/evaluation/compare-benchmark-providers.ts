import { readFile, writeFile } from 'fs/promises';

import type { BenchmarkReport } from '@/lib/agreement-analyzer/evaluation/evaluation-types';

async function readBenchmarkReport(filePath: string): Promise<BenchmarkReport> {
  const raw = await readFile(filePath, 'utf8');
  return JSON.parse(raw) as BenchmarkReport;
}

function formatDelta(left: number, right: number): string {
  const delta = Math.round((left - right) * 10) / 10;
  if (delta === 0) return '0.0';
  return delta > 0 ? `+${delta.toFixed(1)}` : delta.toFixed(1);
}

export function formatBenchmarkComparisonMarkdown(
  claudeReport: BenchmarkReport,
  openaiReport: BenchmarkReport
): string {
  const rows = [
    ['Overall Accuracy', claudeReport.overallMetrics.overall, openaiReport.overallMetrics.overall],
    [
      'Relationship Classification',
      claudeReport.overallMetrics.relationshipClassification,
      openaiReport.overallMetrics.relationshipClassification,
    ],
    ['Parties', claudeReport.overallMetrics.parties, openaiReport.overallMetrics.parties],
    [
      'Revenue Splits',
      claudeReport.overallMetrics.revenueSplits,
      openaiReport.overallMetrics.revenueSplits,
    ],
    ['Obligations', claudeReport.overallMetrics.obligations, openaiReport.overallMetrics.obligations],
    ['Risks', claudeReport.overallMetrics.risks, openaiReport.overallMetrics.risks],
    [
      'Missing Clauses',
      claudeReport.overallMetrics.missingClauses,
      openaiReport.overallMetrics.missingClauses,
    ],
  ] as const;

  const lines = [
    '# Agreement Benchmark Provider Comparison',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Provider Metadata',
    `- Claude: ${claudeReport.provider.provider} / ${claudeReport.provider.model}`,
    `- OpenAI: ${openaiReport.provider.provider} / ${openaiReport.provider.model}`,
    '',
    '## Metric Comparison',
    '| Metric | Claude % | OpenAI % | Claude - OpenAI |',
    '| --- | ---: | ---: | ---: |',
    ...rows.map(([label, claudeValue, openaiValue]) =>
      `| ${label} | ${claudeValue.toFixed(1)} | ${openaiValue.toFixed(1)} | ${formatDelta(claudeValue, openaiValue)} |`
    ),
    '',
    '## Extraction Success',
    `- Claude: ${claudeReport.extraction.succeeded}/${claudeReport.extraction.processed} succeeded`,
    `- OpenAI: ${openaiReport.extraction.succeeded}/${openaiReport.extraction.processed} succeeded`,
  ];

  return `${lines.join('\n')}\n`;
}

export async function compareBenchmarkProviders(options: {
  claudeReportPath: string;
  openaiReportPath: string;
  outputPath: string;
}): Promise<string> {
  const [claudeReport, openaiReport] = await Promise.all([
    readBenchmarkReport(options.claudeReportPath),
    readBenchmarkReport(options.openaiReportPath),
  ]);

  const markdown = formatBenchmarkComparisonMarkdown(claudeReport, openaiReport);
  await writeFile(options.outputPath, markdown, 'utf8');
  return markdown;
}
