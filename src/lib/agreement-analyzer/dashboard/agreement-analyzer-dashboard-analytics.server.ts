import 'server-only';

import { getAgreementAnalyzerAttributionAnalytics } from '@/lib/agreement-analyzer/dashboard/agreement-analyzer-attribution-analytics.server';
import { getAgreementAnalyzerMarketingAttributionAnalytics } from '@/lib/agreement-analyzer/dashboard/marketing-attribution-analytics.server';
import type { AgreementAnalyzerAnalyticsSnapshot } from '@/lib/agreement-analyzer/dashboard/agreement-analyzer-dashboard-types';
import { countDemoBookings } from '@/lib/agreement-analyzer/demo-bookings/demo-bookings.server';
import { prisma } from '@/lib/server/prisma';

const ANALYTICS_WINDOW_DAYS = 30;

function startOfAnalyticsWindow(): Date {
  const start = new Date();
  start.setDate(start.getDate() - (ANALYTICS_WINDOW_DAYS - 1));
  start.setHours(0, 0, 0, 0);
  return start;
}

function formatDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function buildDailySeries(
  rows: Array<{ day: Date; count: bigint | number }>,
  windowStart: Date
): Array<{ date: string; count: number }> {
  const countsByDay = new Map(
    rows.map((row) => [formatDateKey(row.day), Number(row.count)])
  );

  const series: Array<{ date: string; count: number }> = [];
  const cursor = new Date(windowStart);

  for (let index = 0; index < ANALYTICS_WINDOW_DAYS; index += 1) {
    const key = formatDateKey(cursor);
    series.push({
      date: key,
      count: countsByDay.get(key) ?? 0,
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  return series;
}

function calculateRate(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null;
  return Number(((numerator / denominator) * 100).toFixed(1));
}

export async function getAgreementAnalyzerAnalytics(): Promise<AgreementAnalyzerAnalyticsSnapshot> {
  const windowStart = startOfAnalyticsWindow();

  const [
    leadsPerDayRows,
    reportsGeneratedPerDayRows,
    reportsGenerated,
    reportsViewed,
    emailsSent,
    emailsOpened,
    reportsViewedForDemo,
    demoClicks,
    demoBookings,
    averageLeadScoreTrendRows,
    scoredLeads,
    revenueShareLeads,
    attributionAnalytics,
    marketingAttribution,
  ] = await Promise.all([
    prisma.$queryRaw<Array<{ day: Date; count: bigint }>>`
      SELECT DATE_TRUNC('day', created_at) AS day, COUNT(*)::bigint AS count
      FROM obligation_report_leads
      WHERE created_at >= ${windowStart}
      GROUP BY 1
      ORDER BY 1 ASC
    `,
    prisma.$queryRaw<Array<{ day: Date; count: bigint }>>`
      SELECT DATE_TRUNC('day', created_at) AS day, COUNT(*)::bigint AS count
      FROM agreement_obligation_reports
      WHERE status = 'COMPLETED'
        AND created_at >= ${windowStart}
      GROUP BY 1
      ORDER BY 1 ASC
    `,
    prisma.agreement_obligation_reports.count({
      where: { status: 'COMPLETED', created_at: { gte: windowStart } },
    }),
    prisma.agreement_obligation_reports.count({
      where: {
        status: 'COMPLETED',
        created_at: { gte: windowStart },
        viewed_at: { not: null },
      },
    }),
    prisma.obligation_report_email_events.count({
      where: {
        email_type: 'REPORT_READY',
        delivered_at: { not: null, gte: windowStart },
      },
    }),
    prisma.obligation_report_email_events.count({
      where: {
        email_type: 'REPORT_READY',
        opened_at: { not: null, gte: windowStart },
      },
    }),
    prisma.agreement_obligation_reports.count({
      where: {
        status: 'COMPLETED',
        created_at: { gte: windowStart },
        viewed_at: { not: null },
      },
    }),
    prisma.obligation_report_leads.count({
      where: {
        lifecycle_stage: { in: ['DEMO_BOOKED', 'QUALIFIED', 'CUSTOMER'] },
        updated_at: { gte: windowStart },
      },
    }),
    countDemoBookings({ created_at: { gte: windowStart } }),
    prisma.$queryRaw<Array<{ day: Date; count: number }>>`
      SELECT DATE_TRUNC('day', created_at) AS day, AVG(overall_score)::float AS count
      FROM obligation_report_lead_scores
      WHERE created_at >= ${windowStart}
      GROUP BY 1
      ORDER BY 1 ASC
    `,
    prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(DISTINCT lead_id)::bigint AS count
      FROM obligation_report_lead_scores
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
    getAgreementAnalyzerAttributionAnalytics(),
    getAgreementAnalyzerMarketingAttributionAnalytics(),
  ]);

  const scoredLeadCount = Number(scoredLeads[0]?.count ?? 0);
  const revenueShareCount = Number(revenueShareLeads[0]?.count ?? 0);

  return {
    leadsPerDay: buildDailySeries(leadsPerDayRows, windowStart),
    reportsGeneratedPerDay: buildDailySeries(reportsGeneratedPerDayRows, windowStart),
    reportViewRate: calculateRate(reportsViewed, reportsGenerated),
    emailOpenRate: calculateRate(emailsOpened, emailsSent),
    demoClickRate: calculateRate(demoClicks, reportsViewedForDemo),
    demoConversionRate: calculateRate(demoBookings, reportsViewed),
    averageLeadScoreTrend: buildDailySeries(
      averageLeadScoreTrendRows.map((row) => ({
        day: row.day,
        count: row.count ?? 0,
      })),
      windowStart
    ),
    revenueShareDetectionRate: calculateRate(revenueShareCount, scoredLeadCount),
    topConvertingUseCases: attributionAnalytics.topConvertingUseCases,
    topConvertingBusinessTypes: attributionAnalytics.topConvertingBusinessTypes,
    topConvertingPriorityBands: attributionAnalytics.topConvertingPriorityBands,
    marketingAttribution,
  };
}
