/**
 * Demo deliverables library — static PDF reports and campaign ZIP packages.
 *
 * ## Single source of truth
 * Each deliverable defines:
 * - `file` — URL path served from `/public` (must match on-disk filename exactly)
 * - `downloadName` — filename saved to the user's device
 * - `publicPathHint` — shown in missing-file toasts
 *
 * ## Thirsty Turtl files (public/demo-reports/thirsty-turtl/)
 * - Thirsty-Turtl-Campaign-Strategy-Report.pdf  → strategy (before approval)
 * - client-report-1.pdf                           → final client report (after delivery)
 * - ai_team_performance_report.pdf                → AI team performance report
 *
 * ## Campaign package (public/demo-packages/)
 * - thirsty-turtl-campaign-package.zip            → final ZIP only
 *
 * ## Switching demo mode on/off
 * Toggle `DEMO_MODE` in `./demo-mode.ts`.
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

const STRATEGY_REPORT_INCLUDES = [
  'Campaign Objectives',
  'Audience Research',
  'SEO Strategy',
  'Channel Plan',
  'Content Outline',
  'Creative Direction Brief',
] as const;

type DemoFileSpec = {
  fileName: string;
  downloadName: string;
};

function demoReportPath(campaignKey: string, fileName: string): string {
  return `/demo-reports/${campaignKey}/${fileName}`;
}

function demoPublicHint(campaignKey: string, fileName: string): string {
  return `public/demo-reports/${campaignKey}/${fileName}`;
}

function demoPackagePath(fileName: string): string {
  return `/demo-packages/${fileName}`;
}

function buildCampaignEntry(input: {
  key: DemoCampaignKey;
  matchers: readonly string[];
  presentation: DemoCampaignDeliverables['presentation'];
  strategy: DemoFileSpec;
  client: DemoFileSpec;
  aiTeam: DemoFileSpec;
  campaignPackage: DemoFileSpec;
}): DemoCampaignDeliverables {
  return {
    key: input.key,
    matchers: input.matchers,
    presentation: input.presentation,
    reports: {
      strategy: {
        file: demoReportPath(input.key, input.strategy.fileName),
        publicPathHint: demoPublicHint(input.key, input.strategy.fileName),
        downloadName: input.strategy.downloadName,
        title: 'Campaign Strategy Report',
        description:
          'Planning deliverable — research, SEO, channel strategy and creative direction. No creative assets.',
        statusLabel: 'Ready for Approval',
        statusDetail: 'Planning phase only',
        includes: STRATEGY_REPORT_INCLUDES,
      },
      client: {
        file: demoReportPath(input.key, input.client.fileName),
        publicPathHint: demoPublicHint(input.key, input.client.fileName),
        downloadName: input.client.downloadName,
        title: 'Final Client Report',
        description:
          'Complete campaign handover — strategy, content previews, creative assets and recommendations.',
        statusLabel: 'Ready for Client Approval',
        statusDetail: `${input.presentation.clientReportPages} Pages`,
        includes: CLIENT_REPORT_INCLUDES,
      },
      aiTeam: {
        file: demoReportPath(input.key, input.aiTeam.fileName),
        publicPathHint: demoPublicHint(input.key, input.aiTeam.fileName),
        downloadName: input.aiTeam.downloadName,
        title: 'AI Team Performance Report',
        description:
          'Knowledge coverage, specialist execution, workflow analysis and performance metrics.',
        statusLabel: 'Execution Complete',
        statusDetail: `${input.presentation.aiReportPages} Pages`,
        includes: AI_TEAM_REPORT_INCLUDES,
      },
    },
    campaignPackage: {
      file: demoPackagePath(input.campaignPackage.fileName),
      publicPathHint: `public/demo-packages/${input.campaignPackage.fileName}`,
      downloadName: input.campaignPackage.downloadName,
      title: 'Campaign Package',
      subtitle: 'Everything required to review, approve and publish this campaign.',
      description:
        'Complete campaign deliverables — content, creative assets, reports and approval materials.',
    },
  };
}

const THIRSTY_TURTL_PRESENTATION = {
  creativeAssets: 12,
  clientReportPages: 22,
  aiReportPages: 16,
  documents: 8,
  estimatedTimeSavedHours: 11.2,
  marketingOperationsStatus: 'Ready',
  campaignStatusLabel: 'Ready for Marketing Operations',
  packageContents: STANDARD_PACKAGE_CONTENTS,
} as const;

export const DEMO_CAMPAIGN_DELIVERABLES = [
  buildCampaignEntry({
    key: 'thirsty-turtl',
    matchers: ['thirsty turtl', 'gentle-cleanser', 'gentle cleanser'],
    presentation: THIRSTY_TURTL_PRESENTATION,
    strategy: {
      fileName: 'Thirsty-Turtl-Campaign-Strategy-Report.pdf',
      downloadName: 'Thirsty-Turtl-Campaign-Strategy-Report.pdf',
    },
    client: {
      fileName: 'client-report-1.pdf',
      downloadName: 'client-report-1.pdf',
    },
    aiTeam: {
      fileName: 'ai_team_performance_report.pdf',
      downloadName: 'Thirsty-Turtl-AI-Team-Performance-Report.pdf',
    },
    campaignPackage: {
      fileName: 'thirsty-turtl-campaign-package.zip',
      downloadName: 'thirsty-turtl-campaign-package.zip',
    },
  }),
  buildCampaignEntry({
    key: 'rabbit-hole',
    matchers: ['rabbit hole', 'rabbit-hole'],
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
    strategy: {
      fileName: 'Rabbit-Hole-Campaign-Strategy-Report.pdf',
      downloadName: 'Rabbit-Hole-Campaign-Strategy-Report.pdf',
    },
    client: {
      fileName: 'client-report-1.pdf',
      downloadName: 'client-report-1.pdf',
    },
    aiTeam: {
      fileName: 'ai-team-performance-report.pdf',
      downloadName: 'Rabbit-Hole-AI-Team-Performance-Report.pdf',
    },
    campaignPackage: {
      fileName: 'rabbit-hole-campaign-package.zip',
      downloadName: 'rabbit-hole-campaign-package.zip',
    },
  }),
  buildCampaignEntry({
    key: 'tourism-demo',
    matchers: ['tourism demo', 'tourism-demo'],
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
    strategy: {
      fileName: 'Tourism-Demo-Campaign-Strategy-Report.pdf',
      downloadName: 'Tourism-Demo-Campaign-Strategy-Report.pdf',
    },
    client: {
      fileName: 'client-report-1.pdf',
      downloadName: 'client-report-1.pdf',
    },
    aiTeam: {
      fileName: 'ai-team-performance-report.pdf',
      downloadName: 'Tourism-Demo-AI-Team-Performance-Report.pdf',
    },
    campaignPackage: {
      fileName: 'tourism-demo-campaign-package.zip',
      downloadName: 'tourism-demo-campaign-package.zip',
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
