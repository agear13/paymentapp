import 'server-only';

import { Prisma, type ObligationReportLeadLifecycleStage } from '@prisma/client';

import {
  normalizeLeadListPage,
  parseDateFilter,
  parseLeadScoreRange,
} from '@/lib/agreement-analyzer/dashboard/agreement-analyzer-dashboard-filters';
import type {
  AgreementAnalyzerActivityEvent,
  AgreementAnalyzerLeadDetail,
  AgreementAnalyzerLeadListFilters,
  AgreementAnalyzerLeadListItem,
  AgreementAnalyzerLeadListResult,
  AgreementAnalyzerOperationsKpis,
  AgreementAnalyzerOverviewKpis,
} from '@/lib/agreement-analyzer/dashboard/agreement-analyzer-dashboard-types';
import { AGREEMENT_ANALYZER_DASHBOARD_PAGE_SIZE } from '@/lib/agreement-analyzer/dashboard/agreement-analyzer-dashboard-types';
import type { AgreementAnalyzerDemoBookingSummary } from '@/lib/agreement-analyzer/dashboard/agreement-analyzer-dashboard-types';
import { countDemoBookings } from '@/lib/agreement-analyzer/demo-bookings/demo-bookings.server';
import { parsePublicReportJson } from '@/lib/agreement-analyzer/report-types';
import { prisma } from '@/lib/server/prisma';

const DEMO_CLICKED_STAGES: ObligationReportLeadLifecycleStage[] = [
  'DEMO_BOOKED',
  'QUALIFIED',
  'CUSTOMER',
];

const REPORT_VIEWED_STAGES: ObligationReportLeadLifecycleStage[] = [
  'REPORT_VIEWED',
  'DEMO_BOOKED',
  'QUALIFIED',
  'CUSTOMER',
];

type LeadListRow = {
  id: string;
  created_at: Date;
  first_name: string;
  last_name: string;
  email: string;
  company_name: string | null;
  business_type: string | null;
  lifecycle_stage: ObligationReportLeadLifecycleStage;
  overall_score: number | null;
  priority_band: string | null;
  recommended_use_case: string | null;
  report_viewed: boolean;
  demo_clicked: boolean;
};

function startOfWeek(date = new Date()): Date {
  const start = new Date(date);
  const day = start.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + diff);
  start.setHours(0, 0, 0, 0);
  return start;
}

function buildLeadWhereSql(
  filters: AgreementAnalyzerLeadListFilters
): Prisma.Sql {
  const clauses: Prisma.Sql[] = [];

  if (filters.lifecycleStage) {
    clauses.push(Prisma.sql`l.lifecycle_stage = ${filters.lifecycleStage}`);
  }

  if (filters.businessType) {
    clauses.push(Prisma.sql`l.business_type = ${filters.businessType}`);
  }

  const createdFrom = parseDateFilter(filters.createdFrom);
  if (createdFrom) {
    clauses.push(Prisma.sql`l.created_at >= ${createdFrom}`);
  }

  const createdTo = parseDateFilter(filters.createdTo);
  if (createdTo) {
    const end = new Date(createdTo);
    end.setHours(23, 59, 59, 999);
    clauses.push(Prisma.sql`l.created_at <= ${end}`);
  }

  if (filters.scoreRange) {
    const { min, max } = parseLeadScoreRange(filters.scoreRange);
    clauses.push(
      Prisma.sql`ls.overall_score IS NOT NULL AND ls.overall_score >= ${min} AND ls.overall_score <= ${max}`
    );
  }

  if (filters.priorityBand) {
    clauses.push(Prisma.sql`ls.priority_band = ${filters.priorityBand}`);
  }

  if (filters.recommendedUseCase) {
    clauses.push(Prisma.sql`ls.recommended_use_case = ${filters.recommendedUseCase}`);
  }

  if (clauses.length === 0) {
    return Prisma.sql`TRUE`;
  }

  return Prisma.join(clauses, ' AND ');
}

function mapLeadListRow(row: LeadListRow): AgreementAnalyzerLeadListItem {
  return {
    id: row.id,
    createdAt: row.created_at.toISOString(),
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    companyName: row.company_name,
    businessType: row.business_type,
    overallScore: row.overall_score,
    priorityBand: row.priority_band,
    recommendedUseCase: row.recommended_use_case,
    lifecycleStage: row.lifecycle_stage,
    reportViewed: row.report_viewed,
    demoClicked: row.demo_clicked,
  };
}

function startOfToday(date = new Date()): Date {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
}

export async function getAgreementAnalyzerOperationsKpis(): Promise<AgreementAnalyzerOperationsKpis> {
  const todayStart = startOfToday();

  const [
    pendingJobs,
    processingJobs,
    failedJobs,
    completedToday,
    averageProcessingTimeRow,
    retryCountRow,
  ] = await Promise.all([
    prisma.agreement_processing_jobs.count({ where: { status: 'PENDING' } }),
    prisma.agreement_processing_jobs.count({ where: { status: 'PROCESSING' } }),
    prisma.agreement_processing_jobs.count({ where: { status: 'FAILED' } }),
    prisma.agreement_processing_jobs.count({
      where: {
        status: 'COMPLETED',
        completed_at: { gte: todayStart },
      },
    }),
    prisma.$queryRaw<Array<{ average_ms: number | null }>>`
      SELECT AVG(EXTRACT(EPOCH FROM (completed_at - created_at)) * 1000)::float AS average_ms
      FROM agreement_processing_jobs
      WHERE status = 'COMPLETED'
        AND completed_at IS NOT NULL
    `,
    prisma.agreement_processing_jobs.aggregate({
      _sum: { attempt_count: true },
      where: { attempt_count: { gt: 0 } },
    }),
  ]);

  return {
    pendingJobs,
    processingJobs,
    failedJobs,
    completedToday,
    averageProcessingTimeMs: averageProcessingTimeRow[0]?.average_ms ?? null,
    retryCount: retryCountRow._sum.attempt_count ?? 0,
  };
}

export async function getAgreementAnalyzerOverviewKpis(): Promise<AgreementAnalyzerOverviewKpis> {
  const weekStart = startOfWeek();

  const [
    totalLeads,
    leadsThisWeek,
    reportsGenerated,
    reportsViewed,
    demoClicks,
    demoBookings,
    averageLeadScoreRow,
    revenueShareOpportunities,
    hospitalityOpportunities,
    eventOpportunities,
  ] = await Promise.all([
    prisma.obligation_report_leads.count(),
    prisma.obligation_report_leads.count({
      where: { created_at: { gte: weekStart } },
    }),
    prisma.agreement_obligation_reports.count({
      where: { status: 'COMPLETED' },
    }),
    prisma.agreement_obligation_reports.count({
      where: { status: 'COMPLETED', viewed_at: { not: null } },
    }),
    prisma.obligation_report_leads.count({
      where: { lifecycle_stage: { in: DEMO_CLICKED_STAGES } },
    }),
    countDemoBookings(),
    prisma.$queryRaw<Array<{ average_score: number | null }>>`
      SELECT AVG(ls.overall_score)::float AS average_score
      FROM (
        SELECT DISTINCT ON (lead_id) overall_score
        FROM obligation_report_lead_scores
        ORDER BY lead_id, created_at DESC
      ) ls
    `,
    prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count
      FROM (
        SELECT DISTINCT ON (lead_id) revenue_share_detected
        FROM obligation_report_lead_scores
        ORDER BY lead_id, created_at DESC
      ) ls
      WHERE ls.revenue_share_detected = true
    `,
    prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count
      FROM (
        SELECT DISTINCT ON (lead_id) hospitality_detected
        FROM obligation_report_lead_scores
        ORDER BY lead_id, created_at DESC
      ) ls
      WHERE ls.hospitality_detected = true
    `,
    prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count
      FROM (
        SELECT DISTINCT ON (lead_id) event_detected
        FROM obligation_report_lead_scores
        ORDER BY lead_id, created_at DESC
      ) ls
      WHERE ls.event_detected = true
    `,
  ]);

  return {
    totalLeads,
    leadsThisWeek,
    reportsGenerated,
    reportsViewed,
    demoClicks,
    demoBookings,
    demoConversionRate:
      reportsViewed > 0 ? Number(((demoBookings / reportsViewed) * 100).toFixed(1)) : null,
    averageLeadScore: averageLeadScoreRow[0]?.average_score ?? null,
    revenueShareOpportunities: Number(revenueShareOpportunities[0]?.count ?? 0),
    hospitalityOpportunities: Number(hospitalityOpportunities[0]?.count ?? 0),
    eventOpportunities: Number(eventOpportunities[0]?.count ?? 0),
  };
}

export async function listAgreementAnalyzerLeads(
  filters: AgreementAnalyzerLeadListFilters = {}
): Promise<AgreementAnalyzerLeadListResult> {
  const page = normalizeLeadListPage(filters.page);
  const pageSize = AGREEMENT_ANALYZER_DASHBOARD_PAGE_SIZE;
  const offset = (page - 1) * pageSize;
  const whereSql = buildLeadWhereSql(filters);

  const [rows, countRows] = await Promise.all([
    prisma.$queryRaw<LeadListRow[]>`
      WITH latest_scores AS (
        SELECT DISTINCT ON (lead_id)
          lead_id,
          overall_score,
          priority_band,
          recommended_use_case
        FROM obligation_report_lead_scores
        ORDER BY lead_id, created_at DESC
      )
      SELECT
        l.id,
        l.created_at,
        l.first_name,
        l.last_name,
        l.email,
        l.company_name,
        l.business_type,
        l.lifecycle_stage,
        ls.overall_score,
        ls.priority_band,
        ls.recommended_use_case,
        (
          l.lifecycle_stage IN (${Prisma.join(REPORT_VIEWED_STAGES)})
          OR EXISTS (
            SELECT 1
            FROM agreement_uploads u
            INNER JOIN agreement_obligation_reports r ON r.upload_id = u.id
            WHERE u.lead_id = l.id
              AND r.status = 'COMPLETED'
              AND r.viewed_at IS NOT NULL
          )
        ) AS report_viewed,
        (
          l.lifecycle_stage IN (${Prisma.join(DEMO_CLICKED_STAGES)})
          OR EXISTS (
            SELECT 1
            FROM obligation_report_email_events e
            WHERE e.lead_id = l.id
              AND e.clicked_at IS NOT NULL
          )
        ) AS demo_clicked
      FROM obligation_report_leads l
      LEFT JOIN latest_scores ls ON ls.lead_id = l.id
      WHERE ${whereSql}
      ORDER BY ls.overall_score DESC NULLS LAST, l.created_at DESC
      LIMIT ${pageSize}
      OFFSET ${offset}
    `,
    prisma.$queryRaw<Array<{ count: bigint }>>`
      WITH latest_scores AS (
        SELECT DISTINCT ON (lead_id)
          lead_id,
          overall_score,
          priority_band,
          recommended_use_case
        FROM obligation_report_lead_scores
        ORDER BY lead_id, created_at DESC
      )
      SELECT COUNT(*)::bigint AS count
      FROM obligation_report_leads l
      LEFT JOIN latest_scores ls ON ls.lead_id = l.id
      WHERE ${whereSql}
    `,
  ]);

  const total = Number(countRows[0]?.count ?? 0);

  return {
    items: rows.map(mapLeadListRow),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

function mapDemoBookingSummary(
  booking: {
    id: string;
    calendly_event_id: string;
    meeting_time: Date;
    invitee_name: string;
    invitee_email: string;
    booking_source: string;
  }
): AgreementAnalyzerDemoBookingSummary {
  return {
    id: booking.id,
    calendlyEventId: booking.calendly_event_id,
    meetingTime: booking.meeting_time.toISOString(),
    inviteeName: booking.invitee_name,
    inviteeEmail: booking.invitee_email,
    bookingSource: booking.booking_source,
  };
}

function buildActivityTimeline(input: {
  leadCreatedAt: Date;
  uploads: Array<{ uploaded_at: Date | null; created_at: Date }>;
  reports: Array<{ created_at: Date; viewed_at: Date | null }>;
  emailEvents: Array<{
    delivered_at: Date | null;
    opened_at: Date | null;
    clicked_at: Date | null;
  }>;
  demoBookings: Array<{ meeting_time: Date; created_at: Date }>;
  lifecycleStage: ObligationReportLeadLifecycleStage;
  lifecycleUpdatedAt: Date;
}): AgreementAnalyzerActivityEvent[] {
  const events: AgreementAnalyzerActivityEvent[] = [];

  const earliestUpload = input.uploads
    .map((upload) => upload.uploaded_at ?? upload.created_at)
    .sort((a, b) => a.getTime() - b.getTime())[0];

  if (earliestUpload) {
    events.push({
      type: 'UPLOADED',
      label: 'Uploaded Agreement',
      occurredAt: earliestUpload.toISOString(),
    });
  }

  const generatedReport = input.reports
    .map((report) => report.created_at)
    .sort((a, b) => a.getTime() - b.getTime())[0];

  if (generatedReport) {
    events.push({
      type: 'REPORT_GENERATED',
      label: 'Report Generated',
      occurredAt: generatedReport.toISOString(),
    });
  }

  const viewedReport = input.reports
    .map((report) => report.viewed_at)
    .filter((value): value is Date => value != null)
    .sort((a, b) => a.getTime() - b.getTime())[0];

  if (viewedReport) {
    events.push({
      type: 'REPORT_VIEWED',
      label: 'Report Viewed',
      occurredAt: viewedReport.toISOString(),
    });
  }

  const reportReadyEmail = input.emailEvents[0];
  if (reportReadyEmail?.delivered_at) {
    events.push({
      type: 'EMAIL_SENT',
      label: 'Email Sent',
      occurredAt: reportReadyEmail.delivered_at.toISOString(),
    });
  }

  if (reportReadyEmail?.opened_at) {
    events.push({
      type: 'EMAIL_OPENED',
      label: 'Email Opened',
      occurredAt: reportReadyEmail.opened_at.toISOString(),
    });
  }

  if (reportReadyEmail?.clicked_at) {
    events.push({
      type: 'EMAIL_CLICKED',
      label: 'Email Clicked',
      occurredAt: reportReadyEmail.clicked_at.toISOString(),
    });
  }

  if (DEMO_CLICKED_STAGES.includes(input.lifecycleStage)) {
    events.push({
      type: 'DEMO_CLICKED',
      label: 'Demo Clicked',
      occurredAt: input.lifecycleUpdatedAt.toISOString(),
    });
  }

  for (const booking of input.demoBookings) {
    events.push({
      type: 'DEMO_BOOKED',
      label: 'Demo Booked',
      occurredAt: booking.created_at.toISOString(),
    });
  }

  return events.sort(
    (left, right) => new Date(left.occurredAt).getTime() - new Date(right.occurredAt).getTime()
  );
}

export async function getAgreementAnalyzerLeadDetail(
  leadId: string
): Promise<AgreementAnalyzerLeadDetail | null> {
  const lead = await prisma.obligation_report_leads.findUnique({
    where: { id: leadId },
    include: {
      obligation_report_lead_scores: {
        orderBy: { created_at: 'desc' },
        take: 1,
      },
      agreement_uploads: {
        orderBy: { created_at: 'asc' },
        select: {
          uploaded_at: true,
          created_at: true,
          agreement_obligation_reports: {
            where: { status: 'COMPLETED' },
            orderBy: { created_at: 'desc' },
            take: 1,
            select: {
              created_at: true,
              viewed_at: true,
              report_json: true,
              settlement_readiness_score: true,
            },
          },
        },
      },
      obligation_report_email_events: {
        where: { email_type: 'REPORT_READY' },
        orderBy: { created_at: 'desc' },
        take: 1,
        select: {
          delivered_at: true,
          opened_at: true,
          clicked_at: true,
        },
      },
      agreement_analyzer_demo_bookings: {
        orderBy: { meeting_time: 'desc' },
      },
    },
  });

  if (!lead) return null;

  const latestJob = await prisma.agreement_processing_jobs.findFirst({
    where: { upload: { lead_id: leadId } },
    orderBy: { created_at: 'desc' },
    include: {
      report: {
        select: { status: true },
      },
    },
  });

  const latestScore = lead.obligation_report_lead_scores[0] ?? null;
  const latestReport = lead.agreement_uploads
    .flatMap((upload) => upload.agreement_obligation_reports)
    .sort((left, right) => right.created_at.getTime() - left.created_at.getTime())[0];

  const parsedReport = latestReport?.report_json
    ? parsePublicReportJson(latestReport.report_json)
    : null;

  const now = Date.now();
  const demoBookingSummaries = lead.agreement_analyzer_demo_bookings.map(mapDemoBookingSummary);
  const upcomingDemoBookings = demoBookingSummaries.filter(
    (booking) => new Date(booking.meetingTime).getTime() >= now
  );
  const pastDemoBookings = demoBookingSummaries.filter(
    (booking) => new Date(booking.meetingTime).getTime() < now
  );

  return {
    id: lead.id,
    createdAt: lead.created_at.toISOString(),
    firstName: lead.first_name,
    lastName: lead.last_name,
    email: lead.email,
    companyName: lead.company_name,
    businessType: lead.business_type,
    lifecycleStage: lead.lifecycle_stage,
    processing: latestJob
      ? {
          extractionStatus: latestJob.report.status,
          jobStatus: latestJob.status,
          processingAttempts: latestJob.attempt_count,
          lastError: latestJob.last_error,
        }
      : null,
    score: latestScore
      ? {
          overallScore: latestScore.overall_score,
          priorityBand: latestScore.priority_band,
          recommendedUseCase: latestScore.recommended_use_case,
          complexityScore: latestScore.complexity_score,
          revenueShareDetected: latestScore.revenue_share_detected,
          hospitalityDetected: latestScore.hospitality_detected,
          eventDetected: latestScore.event_detected,
          accountantDetected: latestScore.accountant_detected,
          multiPartyDetected: latestScore.multi_party_detected,
          partyCount: latestScore.party_count,
        }
      : null,
    report: parsedReport
      ? {
          parties: parsedReport.parties,
          revenueSplits: parsedReport.revenueSplits,
          paymentConditions: parsedReport.paymentConditions,
          risks: parsedReport.risks,
          missingInformation: parsedReport.missingInformation,
          settlementReadinessScore: latestReport?.settlement_readiness_score ?? null,
        }
      : null,
    activity: buildActivityTimeline({
      leadCreatedAt: lead.created_at,
      uploads: lead.agreement_uploads,
      reports: lead.agreement_uploads.flatMap((upload) => upload.agreement_obligation_reports),
      emailEvents: lead.obligation_report_email_events,
      demoBookings: lead.agreement_analyzer_demo_bookings,
      lifecycleStage: lead.lifecycle_stage,
      lifecycleUpdatedAt: lead.updated_at,
    }),
    demoBookings: {
      upcoming: upcomingDemoBookings,
      past: pastDemoBookings,
    },
  };
}
