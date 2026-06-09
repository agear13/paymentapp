import 'server-only';

import type {
  AgreementAnalyzerAttributionBreakdown,
  AgreementAnalyzerMarketingAttributionSnapshot,
  AgreementAnalyzerMarketingFunnelRow,
} from '@/lib/agreement-analyzer/dashboard/agreement-analyzer-dashboard-types';
import { prisma } from '@/lib/server/prisma';

const ANALYTICS_WINDOW_DAYS = 30;
const UNKNOWN_LABEL = 'Unknown';

type AttributionDimension = 'source' | 'campaign' | 'medium';

type LeadAttributionRow = {
  id: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  referrer: string | null;
  lifecycle_stage: string;
  has_viewed_report: boolean;
  has_demo_booking: boolean;
};

function startOfAnalyticsWindow(): Date {
  const start = new Date();
  start.setDate(start.getDate() - (ANALYTICS_WINDOW_DAYS - 1));
  start.setHours(0, 0, 0, 0);
  return start;
}

function calculateRate(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null;
  return Number(((numerator / denominator) * 100).toFixed(1));
}

function buildBreakdown(
  counts: Map<string, number>,
  total?: number
): AgreementAnalyzerAttributionBreakdown[] {
  const resolvedTotal = total ?? [...counts.values()].reduce((sum, count) => sum + count, 0);
  if (resolvedTotal === 0) return [];

  return [...counts.entries()]
    .map(([label, count]) => ({
      label,
      count,
      percentage: Number(((count / resolvedTotal) * 100).toFixed(1)),
    }))
    .sort((left, right) => right.count - left.count);
}

function resolveDimensionValue(
  lead: LeadAttributionRow,
  dimension: AttributionDimension
): string {
  switch (dimension) {
    case 'source':
      return lead.utm_source?.trim() || UNKNOWN_LABEL;
    case 'campaign':
      return lead.utm_campaign?.trim() || UNKNOWN_LABEL;
    case 'medium':
      return lead.utm_medium?.trim() || UNKNOWN_LABEL;
    default:
      return UNKNOWN_LABEL;
  }
}

function normalizeReferrerLabel(referrer: string | null): string {
  if (!referrer?.trim()) return UNKNOWN_LABEL;

  try {
    const url = new URL(referrer);
    return url.hostname.replace(/^www\./, '') || UNKNOWN_LABEL;
  } catch {
    return referrer.trim().slice(0, 120) || UNKNOWN_LABEL;
  }
}

function buildFunnelRows(
  leads: LeadAttributionRow[],
  dimension: AttributionDimension
): AgreementAnalyzerMarketingFunnelRow[] {
  const grouped = new Map<
    string,
    {
      uploads: number;
      reportsViewed: number;
      demoBooked: number;
      customers: number;
    }
  >();

  for (const lead of leads) {
    const label = resolveDimensionValue(lead, dimension);
    const bucket = grouped.get(label) ?? {
      uploads: 0,
      reportsViewed: 0,
      demoBooked: 0,
      customers: 0,
    };

    bucket.uploads += 1;
    if (lead.has_viewed_report) bucket.reportsViewed += 1;
    if (lead.has_demo_booking || lead.lifecycle_stage === 'DEMO_BOOKED') {
      bucket.demoBooked += 1;
    }
    if (lead.lifecycle_stage === 'CUSTOMER') bucket.customers += 1;

    grouped.set(label, bucket);
  }

  return [...grouped.entries()]
    .map(([label, counts]) => ({
      label,
      uploads: counts.uploads,
      reportsViewed: counts.reportsViewed,
      demoBooked: counts.demoBooked,
      customers: counts.customers,
      uploadToReportViewedRate: calculateRate(counts.reportsViewed, counts.uploads),
      reportViewedToDemoBookedRate: calculateRate(counts.demoBooked, counts.reportsViewed),
      demoBookedToCustomerRate: calculateRate(counts.customers, counts.demoBooked),
    }))
    .sort((left, right) => right.uploads - left.uploads);
}

async function loadLeadAttributionRows(windowStart: Date): Promise<LeadAttributionRow[]> {
  const rows = await prisma.obligation_report_leads.findMany({
    where: { created_at: { gte: windowStart } },
    select: {
      id: true,
      utm_source: true,
      utm_medium: true,
      utm_campaign: true,
      referrer: true,
      lifecycle_stage: true,
      agreement_uploads: {
        select: {
          agreement_obligation_reports: {
            select: { viewed_at: true },
          },
        },
      },
      agreement_analyzer_demo_bookings: {
        select: { id: true },
        take: 1,
      },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    utm_source: row.utm_source,
    utm_medium: row.utm_medium,
    utm_campaign: row.utm_campaign,
    referrer: row.referrer,
    lifecycle_stage: row.lifecycle_stage,
    has_viewed_report: row.agreement_uploads.some((upload) =>
      upload.agreement_obligation_reports.some((report) => report.viewed_at != null)
    ),
    has_demo_booking: row.agreement_analyzer_demo_bookings.length > 0,
  }));
}

export async function getAgreementAnalyzerMarketingAttributionAnalytics(): Promise<AgreementAnalyzerMarketingAttributionSnapshot> {
  const windowStart = startOfAnalyticsWindow();
  const leads = await loadLeadAttributionRows(windowStart);

  const sourceUploads = new Map<string, number>();
  const sourceReportsViewed = new Map<string, number>();
  const sourceDemoBookings = new Map<string, number>();
  const campaignUploads = new Map<string, number>();
  const campaignDemoBookings = new Map<string, number>();
  const referrerUploads = new Map<string, number>();
  const referrerDemoBookings = new Map<string, number>();

  for (const lead of leads) {
    const source = resolveDimensionValue(lead, 'source');
    const campaign = resolveDimensionValue(lead, 'campaign');
    const referrer = normalizeReferrerLabel(lead.referrer);
    const demoBooked =
      lead.has_demo_booking || lead.lifecycle_stage === 'DEMO_BOOKED';

    sourceUploads.set(source, (sourceUploads.get(source) ?? 0) + 1);
    campaignUploads.set(campaign, (campaignUploads.get(campaign) ?? 0) + 1);
    referrerUploads.set(referrer, (referrerUploads.get(referrer) ?? 0) + 1);

    if (lead.has_viewed_report) {
      sourceReportsViewed.set(source, (sourceReportsViewed.get(source) ?? 0) + 1);
    }

    if (demoBooked) {
      sourceDemoBookings.set(source, (sourceDemoBookings.get(source) ?? 0) + 1);
      campaignDemoBookings.set(campaign, (campaignDemoBookings.get(campaign) ?? 0) + 1);
      referrerDemoBookings.set(referrer, (referrerDemoBookings.get(referrer) ?? 0) + 1);
    }
  }

  return {
    topSources: {
      uploads: buildBreakdown(sourceUploads),
      reportsViewed: buildBreakdown(sourceReportsViewed),
      demoBookings: buildBreakdown(sourceDemoBookings),
    },
    topCampaigns: {
      uploads: buildBreakdown(campaignUploads),
      demoBookings: buildBreakdown(campaignDemoBookings),
    },
    topReferrers: {
      uploads: buildBreakdown(referrerUploads),
      demoBookings: buildBreakdown(referrerDemoBookings),
    },
    funnelBySource: buildFunnelRows(leads, 'source'),
    funnelByCampaign: buildFunnelRows(leads, 'campaign'),
    funnelByMedium: buildFunnelRows(leads, 'medium'),
  };
}
