import { NextRequest, NextResponse } from 'next/server';

import { requireAgreementAnalyzerDashboardForApi } from '@/lib/agreement-analyzer/dashboard/agreement-analyzer-dashboard-auth.server';
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
import { listAgreementAnalyzerLeads } from '@/lib/agreement-analyzer/dashboard/agreement-analyzer-dashboard-queries.server';
import { AGREEMENT_BUSINESS_TYPES } from '@/lib/agreement-analyzer/validation';

export const dynamic = 'force-dynamic';

function parseLeadListFilters(request: NextRequest): AgreementAnalyzerLeadListFilters {
  const params = request.nextUrl.searchParams;
  const scoreRange = params.get('scoreRange');
  const priorityBand = params.get('priorityBand');
  const recommendedUseCase = params.get('recommendedUseCase');
  const lifecycleStage = params.get('lifecycleStage');
  const businessType = params.get('businessType');
  const page = Number.parseInt(params.get('page') ?? '1', 10);

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
    createdFrom: params.get('createdFrom') ?? undefined,
    createdTo: params.get('createdTo') ?? undefined,
    page: Number.isNaN(page) ? 1 : page,
  };
}

export async function GET(request: NextRequest) {
  const auth = await requireAgreementAnalyzerDashboardForApi(request);
  if (auth.response) return auth.response;

  const result = await listAgreementAnalyzerLeads(parseLeadListFilters(request));
  return NextResponse.json(result);
}
