import type { ExtractionResult } from '@/lib/ai-extractor/extraction-types';
import {
  buildExtractionSummary,
  type ExtractionSummaryStats,
} from '@/lib/ai-extractor/extraction-summary';

export type ExtractionExportDocument = {
  exportedAt: string;
  source: 'agreement-intelligence';
  title: string | null;
  summary: ExtractionSummaryStats;
  extraction: ExtractionResult;
};

export function extractionContactEmails(result: ExtractionResult): string[] {
  const emails = new Set<string>();
  for (const party of result.parties) {
    const email = party.email.value?.trim().toLowerCase();
    if (email && email.includes('@')) emails.add(email);
  }
  return [...emails];
}

export function buildExtractionExportDocument(input: {
  result: ExtractionResult;
  title?: string | null;
  exportedAt?: string;
}): ExtractionExportDocument {
  const summary = buildExtractionSummary(input.result);
  return {
    exportedAt: input.exportedAt ?? new Date().toISOString(),
    source: 'agreement-intelligence',
    title: input.title?.trim() || input.result.projectName.value || summary.oneLiner || null,
    summary,
    extraction: input.result,
  };
}

export function serializeExtractionExport(document: ExtractionExportDocument): string {
  return `${JSON.stringify(document, null, 2)}\n`;
}

export function extractionExportFilename(title: string | null | undefined, at = new Date()): string {
  const slug = (title ?? 'agreement')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  const date = at.toISOString().slice(0, 10);
  return `provvy-extraction-${slug || 'agreement'}-${date}.json`;
}

export function downloadExtractionExport(document: ExtractionExportDocument): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;
  const blob = new Blob([serializeExtractionExport(document)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = window.document.createElement('a');
  anchor.href = url;
  anchor.download = extractionExportFilename(document.title);
  window.document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
