/**
 * Demo deliverables library — static PDF reports and campaign ZIP packages.
 *
 * ## Replacing reports for the current demo campaign
 * Drop new files into `public/demo-reports/{campaign-key}/`:
 *   - client-report.pdf
 *   - ai-team-performance-report.pdf
 *
 * ## Replacing the campaign package ZIP
 * Drop a new archive into `public/demo-packages/` using the filename configured
 * below (e.g. `thirsty-turtl-campaign-package.zip`).
 *
 * ## Adding a new demo campaign
 * 1. Add PDFs under `public/demo-reports/{new-campaign-key}/`
 * 2. Add a ZIP under `public/demo-packages/` (optional)
 * 3. Append a `DemoCampaignDeliverables` entry to `DEMO_CAMPAIGN_DELIVERABLES`
 *    with unique `matchers`, `presentation` metrics, and `packageContents`.
 *
 * ## Switching demo mode on/off
 * Toggle `DEMO_MODE` in `./demo-mode.ts` — production report generation is unchanged.
 */
import type { DemoCampaignDeliverables, DemoCampaignKey } from '@/lib/demo/demo-reports.types';

export type {
  DemoCampaignKey,
  DemoReportDefinition,
  DemoCampaignDeliverables,
  DemoCampaignPresentation,
  DemoDeliverableDownloadTarget,
} from '@/lib/demo/demo-reports.types';

export const DEFAULT_DEMO_CAMPAIGN_KEY: DemoCampaignKey = 'thirsty-turtl';

const STANDARD_PACKAGE_CONTENTS = [
  'Client Report',
  'AI Team Performance Report',
  'Blog Article',
  'Newsletter',
  'Facebook Post',
  'Instagram Carousel',
  'Instagram Stories',
  'Pinterest Pins',
  'LinkedIn Post',
  'Google Business Post',
  'Landing Page Recommendations',
  'FAQ Content',
  'Creative Assets',
  'Campaign Assets Library',
] as const;

const CLIENT_REPORT_INCLUDES = [
  'Campaign Strategy',
  'Content Calendar',
  'Content Preview',
  'Creative Assets',
  'Recommendations',
] as const;

const AI_TEAM_REPORT_INCLUDES = [
  'Knowledge Coverage',
  'AI Specialist Performance',
  'Workflow Analysis',
  'Automation Metrics',
  'Brand Compliance',
  'Time Saved',
] as const;

function buildCampaignEntry(input: {
  key: DemoCampaignKey;
  matchers: readonly string[];
  reportPrefix: string;
  packageFileName: string;
  presentation: DemoCampaignDeliverables['presentation'];
}): DemoCampaignDeliverables {
  return {
    key: input.key,
    matchers: input.matchers,
    presentation: input.presentation,
    reports: {
      client: {
        file: `/demo-reports/${input.key}/client-report.pdf`,
        publicPathHint: `public/demo-reports/${input.key}/client-report.pdf`,
        downloadName: `${input.reportPrefix}-Client-Report.pdf`,
        title: 'Client Report',
        description: 'Campaign strategy, content previews, approval pack and recommendations.',
        statusLabel: 'Ready for Client Approval',
        statusDetail: `${input.presentation.clientReportPages} Pages`,
        includes: CLIENT_REPORT_INCLUDES,
      },
      aiTeam: {
        file: `/demo-reports/${input.key}/ai-team-performance-report.pdf`,
        publicPathHint: `public/demo-reports/${input.key}/ai-team-performance-report.pdf`,
        downloadName: `${input.reportPrefix}-AI-Team-Performance-Report.pdf`,
        title: 'AI Team Performance Report',
        description:
          'Knowledge coverage, specialist execution, workflow analysis and performance metrics.',
        statusLabel: 'Execution Complete',
        statusDetail: `${input.presentation.aiReportPages} Pages`,
        includes: AI_TEAM_REPORT_INCLUDES,
      },
    },
    campaignPackage: {
      file: `/demo-packages/${input.packageFileName}`,
      publicPathHint: `public/demo-packages/${input.packageFileName}`,
      downloadName: `${input.reportPrefix}-Campaign-Package.zip`,
      title: 'Campaign Package',
      subtitle: 'Everything required to review, approve and publish this campaign.',
      description:
        'Complete campaign deliverables — content, creative assets, reports and approval materials.',
    },
  };
}

export const DEMO_CAMPAIGN_DELIVERABLES = [
  buildCampaignEntry({
    key: 'thirsty-turtl',
    matchers: ['thirsty turtl', 'gentle-cleanser', 'gentle cleanser'],
    reportPrefix: 'Thirsty-Turtl',
    packageFileName: 'thirsty-turtl-campaign-package.zip',
    presentation: {
      creativeAssets: 12,
      clientReportPages: 22,
      aiReportPages: 16,
      documents: 8,
      estimatedTimeSavedHours: 11.2,
      marketingOperationsStatus: 'Ready',
      campaignStatusLabel: 'Ready for Marketing Operations',
      packageContents: STANDARD_PACKAGE_CONTENTS,
    },
  }),
  buildCampaignEntry({
    key: 'rabbit-hole',
    matchers: ['rabbit hole', 'rabbit-hole'],
    reportPrefix: 'Rabbit-Hole',
    packageFileName: 'rabbit-hole-campaign-package.zip',
    presentation: {
      creativeAssets: 10,
      clientReportPages: 20,
      aiReportPages: 14,
      documents: 8,
      estimatedTimeSavedHours: 9.5,
      marketingOperationsStatus: 'Ready',
      campaignStatusLabel: 'Ready for Marketing Operations',
      packageContents: STANDARD_PACKAGE_CONTENTS,
    },
  }),
  buildCampaignEntry({
    key: 'tourism-demo',
    matchers: ['tourism demo', 'tourism-demo'],
    reportPrefix: 'Tourism-Demo',
    packageFileName: 'tourism-demo-campaign-package.zip',
    presentation: {
      creativeAssets: 11,
      clientReportPages: 18,
      aiReportPages: 15,
      documents: 7,
      estimatedTimeSavedHours: 10.4,
      marketingOperationsStatus: 'Ready',
      campaignStatusLabel: 'Ready for Marketing Operations',
      packageContents: STANDARD_PACKAGE_CONTENTS,
    },
  }),
] as const satisfies readonly DemoCampaignDeliverables[];

export type ResolvedDemoCampaignDeliverables = (typeof DEMO_CAMPAIGN_DELIVERABLES)[number];

export function resolveDemoCampaignKey(input: {
  campaignId?: string;
  companyName?: string;
  campaignTitle?: string;
}): DemoCampaignKey {
  const haystack = [input.campaignId, input.companyName, input.campaignTitle]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  for (const campaign of DEMO_CAMPAIGN_DELIVERABLES) {
    if (campaign.matchers.some((matcher) => haystack.includes(matcher.toLowerCase()))) {
      return campaign.key;
    }
  }

  return DEFAULT_DEMO_CAMPAIGN_KEY;
}

export function getDemoCampaignDeliverables(input: {
  campaignId?: string;
  companyName?: string;
  campaignTitle?: string;
}): ResolvedDemoCampaignDeliverables {
  const key = resolveDemoCampaignKey(input);
  const match = DEMO_CAMPAIGN_DELIVERABLES.find((campaign) => campaign.key === key);
  return match ?? DEMO_CAMPAIGN_DELIVERABLES[0];
}

/** @deprecated Prefer getDemoCampaignDeliverables — retained for simple imports. */
export const demoReports = DEMO_CAMPAIGN_DELIVERABLES[0].reports;
