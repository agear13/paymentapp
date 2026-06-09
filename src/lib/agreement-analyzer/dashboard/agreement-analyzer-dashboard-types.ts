import type { ObligationReportLeadLifecycleStage } from '@prisma/client';

import {
  LEAD_PRIORITY_BANDS,
  LEAD_RECOMMENDED_USE_CASES,
} from '@/lib/agreement-analyzer/scoring/lead-scoring-types';
import { AGREEMENT_BUSINESS_TYPES } from '@/lib/agreement-analyzer/validation';

export const AGREEMENT_ANALYZER_LEAD_SCORE_RANGES = [
  '0-39',
  '40-69',
  '70-89',
  '90-100',
] as const;

export type AgreementAnalyzerLeadScoreRange =
  (typeof AGREEMENT_ANALYZER_LEAD_SCORE_RANGES)[number];

export const AGREEMENT_ANALYZER_LIFECYCLE_STAGES = [
  'NEW',
  'REPORT_GENERATED',
  'REPORT_VIEWED',
  'QUALIFIED',
  'DEMO_BOOKED',
  'CUSTOMER',
] as const satisfies readonly ObligationReportLeadLifecycleStage[];

export const AGREEMENT_ANALYZER_DASHBOARD_PAGE_SIZE = 25;

export type AgreementAnalyzerLeadListFilters = {
  scoreRange?: AgreementAnalyzerLeadScoreRange;
  priorityBand?: (typeof LEAD_PRIORITY_BANDS)[number];
  recommendedUseCase?: (typeof LEAD_RECOMMENDED_USE_CASES)[number];
  lifecycleStage?: ObligationReportLeadLifecycleStage;
  businessType?: (typeof AGREEMENT_BUSINESS_TYPES)[number];
  createdFrom?: string;
  createdTo?: string;
  page?: number;
};

export type AgreementAnalyzerLeadListItem = {
  id: string;
  createdAt: string;
  firstName: string;
  lastName: string;
  email: string;
  companyName: string | null;
  businessType: string | null;
  overallScore: number | null;
  priorityBand: string | null;
  recommendedUseCase: string | null;
  lifecycleStage: ObligationReportLeadLifecycleStage;
  reportViewed: boolean;
  demoClicked: boolean;
};

export type AgreementAnalyzerLeadListResult = {
  items: AgreementAnalyzerLeadListItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type AgreementAnalyzerOverviewKpis = {
  totalLeads: number;
  leadsThisWeek: number;
  reportsGenerated: number;
  reportsViewed: number;
  demoClicks: number;
  demoBookings: number;
  demoConversionRate: number | null;
  averageLeadScore: number | null;
  revenueShareOpportunities: number;
  hospitalityOpportunities: number;
  eventOpportunities: number;
};

export type AgreementAnalyzerAttributionBreakdown = {
  label: string;
  count: number;
  percentage: number;
};

export type AgreementAnalyzerDemoBookingSummary = {
  id: string;
  calendlyEventId: string;
  meetingTime: string;
  inviteeName: string;
  inviteeEmail: string;
  bookingSource: string;
};

export type AgreementAnalyzerActivityEvent = {
  type:
    | 'UPLOADED'
    | 'REPORT_GENERATED'
    | 'REPORT_VIEWED'
    | 'EMAIL_SENT'
    | 'EMAIL_OPENED'
    | 'EMAIL_CLICKED'
    | 'DEMO_CLICKED'
    | 'DEMO_BOOKED';
  label: string;
  occurredAt: string;
};

export type AgreementAnalyzerLeadProcessingStatus = {
  extractionStatus: string;
  jobStatus: string | null;
  processingAttempts: number;
  lastError: string | null;
};

export type AgreementAnalyzerOperationsKpis = {
  pendingJobs: number;
  processingJobs: number;
  failedJobs: number;
  completedToday: number;
  averageProcessingTimeMs: number | null;
  retryCount: number;
};

export type AgreementAnalyzerLeadDetail = {
  id: string;
  createdAt: string;
  firstName: string;
  lastName: string;
  email: string;
  companyName: string | null;
  businessType: string | null;
  lifecycleStage: ObligationReportLeadLifecycleStage;
  processing: AgreementAnalyzerLeadProcessingStatus | null;
  score: {
    overallScore: number | null;
    priorityBand: string | null;
    recommendedUseCase: string | null;
    complexityScore: number | null;
    revenueShareDetected: boolean;
    hospitalityDetected: boolean;
    eventDetected: boolean;
    accountantDetected: boolean;
    multiPartyDetected: boolean;
    partyCount: number | null;
  } | null;
  report: {
    parties: unknown[];
    revenueSplits: unknown[];
    paymentConditions: unknown[];
    risks: unknown[];
    missingInformation: unknown[];
    settlementReadinessScore: number | null;
  } | null;
  activity: AgreementAnalyzerActivityEvent[];
  demoBookings: {
    upcoming: AgreementAnalyzerDemoBookingSummary[];
    past: AgreementAnalyzerDemoBookingSummary[];
  };
};

export type AgreementAnalyzerDailyCount = {
  date: string;
  count: number;
};

export type AgreementAnalyzerMarketingFunnelRow = {
  label: string;
  uploads: number;
  reportsViewed: number;
  demoBooked: number;
  customers: number;
  uploadToReportViewedRate: number | null;
  reportViewedToDemoBookedRate: number | null;
  demoBookedToCustomerRate: number | null;
};

export type AgreementAnalyzerMarketingAttributionSnapshot = {
  topSources: {
    uploads: AgreementAnalyzerAttributionBreakdown[];
    reportsViewed: AgreementAnalyzerAttributionBreakdown[];
    demoBookings: AgreementAnalyzerAttributionBreakdown[];
  };
  topCampaigns: {
    uploads: AgreementAnalyzerAttributionBreakdown[];
    demoBookings: AgreementAnalyzerAttributionBreakdown[];
  };
  topReferrers: {
    uploads: AgreementAnalyzerAttributionBreakdown[];
    demoBookings: AgreementAnalyzerAttributionBreakdown[];
  };
  funnelBySource: AgreementAnalyzerMarketingFunnelRow[];
  funnelByCampaign: AgreementAnalyzerMarketingFunnelRow[];
  funnelByMedium: AgreementAnalyzerMarketingFunnelRow[];
};

export type AgreementAnalyzerAnalyticsSnapshot = {
  leadsPerDay: AgreementAnalyzerDailyCount[];
  reportsGeneratedPerDay: AgreementAnalyzerDailyCount[];
  reportViewRate: number | null;
  emailOpenRate: number | null;
  demoClickRate: number | null;
  demoConversionRate: number | null;
  averageLeadScoreTrend: AgreementAnalyzerDailyCount[];
  revenueShareDetectionRate: number | null;
  topConvertingUseCases: AgreementAnalyzerAttributionBreakdown[];
  topConvertingBusinessTypes: AgreementAnalyzerAttributionBreakdown[];
  topConvertingPriorityBands: AgreementAnalyzerAttributionBreakdown[];
  marketingAttribution: AgreementAnalyzerMarketingAttributionSnapshot;
};

export { LEAD_PRIORITY_BANDS, LEAD_RECOMMENDED_USE_CASES, AGREEMENT_BUSINESS_TYPES };
