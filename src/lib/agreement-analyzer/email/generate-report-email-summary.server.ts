import { parsePublicReportJson } from '@/lib/agreement-analyzer/report-types';

const MAX_SUMMARY_WORDS = 120;

function countRevenueSplitItems(items: unknown[]): number {
  let count = 0;

  for (const item of items) {
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      const record = item as Record<string, unknown>;
      if (Array.isArray(record.splits)) {
        count += record.splits.length;
        continue;
      }
    }
    count += 1;
  }

  return count;
}

function pluralize(count: number, singular: string, plural?: string): string {
  if (count === 1) {
    return `1 ${singular}`;
  }
  return `${count} ${plural ?? `${singular}s`}`;
}

function trimToWordLimit(text: string, maxWords: number): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) {
    return text.trim();
  }
  return `${words.slice(0, maxWords).join(' ')}.`;
}

/**
 * Builds a short, plain-language summary for report-ready emails.
 */
export function generateReportEmailSummary(reportJson: unknown): string {
  const report = parsePublicReportJson(reportJson);
  if (!report) {
    return 'Your agreement report is ready to review.';
  }

  const partyCount = report.parties.length;
  const obligationCount = report.obligations.length;
  const revenueSplitCount = countRevenueSplitItems(report.revenueSplits);
  const riskCount = report.risks.length;

  const segments: string[] = [`Your agreement contains ${pluralize(partyCount, 'party', 'parties')}`];

  if (obligationCount > 0) {
    segments.push(pluralize(obligationCount, 'obligation'));
  }

  if (revenueSplitCount > 0) {
    segments.push(
      `${pluralize(revenueSplitCount, 'revenue sharing arrangement', 'revenue sharing arrangements')}`
    );
  }

  if (riskCount > 0) {
    segments.push(`${pluralize(riskCount, 'potential risk', 'potential risks')}`);
  }

  const summary =
    segments.length === 1
      ? `${segments[0]}.`
      : `${segments.slice(0, -1).join(', ')} and ${segments[segments.length - 1]}.`;

  return trimToWordLimit(summary, MAX_SUMMARY_WORDS);
}
