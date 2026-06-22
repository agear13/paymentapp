export type DemoCampaignKey = 'thirsty-turtl' | 'rabbit-hole' | 'tourism-demo';

export type DemoDeliverableDownloadTarget = 'client' | 'aiTeam' | 'package' | 'strategy';

export type DemoReportDefinition = {
  file: string;
  /** Filesystem path shown in missing-file toasts (e.g. public/demo-reports/...). */
  publicPathHint: string;
  downloadName: string;
  title: string;
  description: string;
  statusLabel: string;
  statusDetail: string;
  includes: readonly string[];
};

export type DemoCampaignPackageDefinition = {
  file: string;
  publicPathHint: string;
  downloadName: string;
  title: string;
  subtitle: string;
  description: string;
};

/** Presentation-only metrics — update per demo campaign in demo-reports.ts. */
export type DemoCampaignPresentation = {
  creativeAssets: number;
  clientReportPages: number;
  aiReportPages: number;
  documents: number;
  estimatedTimeSavedHours: number;
  marketingOperationsStatus: string;
  campaignStatusLabel: string;
  packageContents: readonly string[];
};

export type DemoCampaignDeliverables = {
  key: DemoCampaignKey;
  matchers: readonly string[];
  presentation: DemoCampaignPresentation;
  reports: {
    client: DemoReportDefinition;
    aiTeam: DemoReportDefinition;
    strategy: DemoReportDefinition;
  };
  campaignPackage: DemoCampaignPackageDefinition;
};
