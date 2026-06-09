import { Suspense } from 'react';

import { AgreementAnalyzerKpiGrid } from '@/components/agreement-analyzer/dashboard/agreement-analyzer-kpi-grid';
import { AgreementAnalyzerLeadsTable } from '@/components/agreement-analyzer/dashboard/agreement-analyzer-leads-table';
import type {
  AgreementAnalyzerLeadListFilters,
  AgreementAnalyzerLeadScoreRange,
} from '@/lib/agreement-analyzer/dashboard/agreement-analyzer-dashboard-types';
import {
  AGREEMENT_ANALYZER_LEAD_SCORE_RANGES,
  AGREEMENT_ANALYZER_LIFECYCLE_STAGES,
  LEAD_PRIORITY_BANDS,
  LEAD_RECOMMENDED_USE_CASES,
} from '@/lib/agreement-analyzer/dashboard/agreement-analyzer-dashboard-types';
import { normalizeLeadListPage } from '@/lib/agreement-analyzer/dashboard/agreement-analyzer-dashboard-filters';
import {
  getAgreementAnalyzerOverviewKpis,
  listAgreementAnalyzerLeads,
} from '@/lib/agreement-analyzer/dashboard/agreement-analyzer-dashboard-queries.server';
import { AGREEMENT_BUSINESS_TYPES } from '@/lib/agreement-analyzer/validation';

export const dynamic = 'force-dynamic';

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function getParam(
  params: Record<string, string | string[] | undefined>,
  key: string
): string | undefined {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

function parseSearchParams(
  params: Record<string, string | string[] | undefined>
): AgreementAnalyzerLeadListFilters {
  const scoreRange = getParam(params, 'scoreRange');
  const priorityBand = getParam(params, 'priorityBand');
  const recommendedUseCase = getParam(params, 'recommendedUseCase');
  const lifecycleStage = getParam(params, 'lifecycleStage');
  const businessType = getParam(params, 'businessType');
  const page = Number.parseInt(getParam(params, 'page') ?? '1', 10);

  return {
    scoreRange:
      scoreRange &&
      (AGREEMENT_ANALYZER_LEAD_SCORE_RANGES as readonly string[]).includes(scoreRange)
        ? (scoreRange as AgreementAnalyzerLeadScoreRange)
        : undefined,
    priorityBand:
      priorityBand && (LEAD_PRIORITY_BANDS as readonly string[]).includes(priorityBand)
        ? (priorityBand as AgreementAnalyzerLeadListFilters['priorityBand'])
        : undefined,
    recommendedUseCase:
      recommendedUseCase &&
      (LEAD_RECOMMENDED_USE_CASES as readonly string[]).includes(recommendedUseCase)
        ? (recommendedUseCase as AgreementAnalyzerLeadListFilters['recommendedUseCase'])
        : undefined,
    lifecycleStage:
      lifecycleStage &&
      (AGREEMENT_ANALYZER_LIFECYCLE_STAGES as readonly string[]).includes(lifecycleStage)
        ? (lifecycleStage as AgreementAnalyzerLeadListFilters['lifecycleStage'])
        : undefined,
    businessType:
      businessType && (AGREEMENT_BUSINESS_TYPES as readonly string[]).includes(businessType)
        ? (businessType as AgreementAnalyzerLeadListFilters['businessType'])
        : undefined,
    createdFrom: getParam(params, 'createdFrom'),
    createdTo: getParam(params, 'createdTo'),
    page: normalizeLeadListPage(page),
  };
}

export default async function AgreementAnalyzerDashboardPage({ searchParams }: PageProps) {
  const resolvedSearchParams = await searchParams;
  const filters = parseSearchParams(resolvedSearchParams);

  const [kpis, leads] = await Promise.all([
    getAgreementAnalyzerOverviewKpis(),
    listAgreementAnalyzerLeads(filters),
  ]);

  return (
    <div className="space-y-6">
      <AgreementAnalyzerKpiGrid kpis={kpis} />
      <Suspense fallback={<div className="text-sm text-muted-foreground">Loading leads…</div>}>
        <AgreementAnalyzerLeadsTable initialData={leads} />
      </Suspense>
    </div>
  );
}
