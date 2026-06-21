import type { ProductionDocument, ProductionDocumentStatus } from '@/lib/marketing-jobs/types';
import { AI_MARKETING_TEAM } from '@/lib/marketing-jobs/creative-team';

export type ProductionDocumentDefinition = {
  id: string;
  label: string;
  specialistId: string;
  /** Completes when this specialist offset is reached. */
  offsetMs: number;
};

export const PRODUCTION_DOCUMENT_DEFINITIONS: ProductionDocumentDefinition[] = [
  {
    id: 'company-brain',
    label: 'Company Brain',
    specialistId: 'business-knowledge-engineer',
    offsetMs: AI_MARKETING_TEAM[0]!.offsetMs,
  },
  {
    id: 'campaign-strategy',
    label: 'Campaign Strategy',
    specialistId: 'campaign-strategist',
    offsetMs: AI_MARKETING_TEAM[2]!.offsetMs,
  },
  {
    id: 'seo-strategy',
    label: 'SEO Strategy',
    specialistId: 'seo-strategist',
    offsetMs: AI_MARKETING_TEAM[1]!.offsetMs,
  },
  {
    id: 'blog-article',
    label: 'Blog Article',
    specialistId: 'content-strategist',
    offsetMs: AI_MARKETING_TEAM[3]!.offsetMs,
  },
  {
    id: 'social-copy',
    label: 'Social Copy',
    specialistId: 'content-strategist',
    offsetMs: AI_MARKETING_TEAM[3]!.offsetMs,
  },
  {
    id: 'creative-brief',
    label: 'Creative Brief',
    specialistId: 'creative-director',
    offsetMs: AI_MARKETING_TEAM[4]!.offsetMs,
  },
  {
    id: 'asset-checklist',
    label: 'Asset Checklist',
    specialistId: 'brand-designer',
    offsetMs: AI_MARKETING_TEAM[5]!.offsetMs,
  },
  {
    id: 'readme',
    label: 'README',
    specialistId: 'marketing-lead',
    offsetMs: AI_MARKETING_TEAM[7]!.offsetMs,
  },
];

export const TOTAL_PACKAGE_FILES = 12;

function resolveDocumentStatus(elapsed: number, doc: ProductionDocumentDefinition): ProductionDocumentStatus {
  if (elapsed >= doc.offsetMs) return 'complete';
  const specialistIndex = AI_MARKETING_TEAM.findIndex((s) => s.id === doc.specialistId);
  const prevOffset = specialistIndex > 0 ? AI_MARKETING_TEAM[specialistIndex - 1]!.offsetMs : 0;
  if (elapsed >= prevOffset && elapsed < doc.offsetMs) return 'generating';
  return 'waiting';
}

export function buildProductionDocuments(elapsed: number): ProductionDocument[] {
  return PRODUCTION_DOCUMENT_DEFINITIONS.map((doc) => ({
    id: doc.id,
    label: doc.label,
    specialistId: doc.specialistId,
    status: resolveDocumentStatus(elapsed, doc),
  }));
}

export function countCompleteDocuments(documents: ProductionDocument[]): number {
  return documents.filter((doc) => doc.status === 'complete').length;
}

export function computePackageHealth(documents: ProductionDocument[]): number {
  const complete = countCompleteDocuments(documents);
  return Math.round((complete / PRODUCTION_DOCUMENT_DEFINITIONS.length) * 100);
}
