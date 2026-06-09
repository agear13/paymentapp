import type { AgreementAnalyzerLeadScoreRange } from '@/lib/agreement-analyzer/dashboard/agreement-analyzer-dashboard-types';

export function parseLeadScoreRange(
  range: AgreementAnalyzerLeadScoreRange
): { min: number; max: number } {
  const [min, max] = range.split('-').map((value) => Number.parseInt(value, 10));
  return { min, max };
}

export function normalizeLeadListPage(page: number | undefined): number {
  if (!page || Number.isNaN(page) || page < 1) return 1;
  return Math.floor(page);
}

export function parseDateFilter(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed;
}
