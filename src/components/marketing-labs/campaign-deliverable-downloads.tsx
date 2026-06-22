'use client';

import * as React from 'react';
import type { ComponentType } from 'react';
import {
  BarChart3,
  CheckCircle2,
  Clock3,
  Download,
  FileText,
  ImageIcon,
  Package,
  Settings2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { DEMO_MODE } from '@/lib/demo/demo-mode';
import { runDemoDownloadPreparation } from '@/lib/demo/demo-download';
import {
  checkDemoDeliverableExists,
  downloadDemoDeliverableFile,
  showDemoAssetMissingToast,
} from '@/lib/demo/demo-deliverable-download';
import { getDemoCampaignDeliverables } from '@/lib/demo/demo-reports';
import type { DemoDeliverableDownloadTarget } from '@/lib/demo/demo-reports.types';
import { DemoDownloadPreparationDialog } from '@/components/marketing-labs/demo-download-preparation-dialog';
import type { MarketingJobEngine } from '@/lib/marketing-jobs/job-engine';
import type { MarketingWorkspaceState } from '@/lib/marketing-jobs/types';

type CampaignDeliverableDownloadsProps = {
  state: MarketingWorkspaceState;
  engine: MarketingJobEngine;
  className?: string;
  showReportCards?: boolean;
  showPackagePreview?: boolean;
};

function PackageStatCard({
  value,
  label,
  icon: Icon,
}: {
  value: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-lg border border-primary/15 bg-primary/[0.03] p-3 text-center shadow-sm">
      <Icon className="mx-auto mb-1 size-4 text-primary" />
      <p className="text-xl font-semibold tabular-nums tracking-tight">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

function ReportReadyCard({
  icon: Icon,
  title,
  statusLabel,
  includes,
  className,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  statusLabel: string;
  includes: readonly string[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-xl border border-primary/20 bg-gradient-to-br from-primary/[0.06] to-background p-4 shadow-sm',
        'animate-in fade-in slide-in-from-bottom-1 duration-500',
        className
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary shadow-sm">
          <Icon className="size-4" />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <p className="text-sm font-semibold">{title}</p>
            <p className="text-xs font-medium text-primary">{statusLabel}</p>
          </div>
          <ul className="grid gap-1 sm:grid-cols-2">
            {includes.map((item) => (
              <li key={item} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <CheckCircle2 className="size-3 shrink-0 text-primary/70" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export function CampaignDeliverableDownloads({
  state,
  engine,
  className,
  showReportCards = true,
  showPackagePreview = true,
}: CampaignDeliverableDownloadsProps) {
  const deliverables = getDemoCampaignDeliverables({
    campaignId: state.campaignContext.campaign.id,
    companyName: state.campaignContext.company.name,
    campaignTitle: state.campaignContext.campaign.title,
  });

  const { presentation, reports, campaignPackage } = deliverables;
  const [prepOpen, setPrepOpen] = React.useState(false);
  const [prepStep, setPrepStep] = React.useState(0);
  const [prepTarget, setPrepTarget] = React.useState<DemoDeliverableDownloadTarget | null>(null);
  const [downloading, setDownloading] = React.useState(false);

  const runDemoDownload = React.useCallback(
    async (target: DemoDeliverableDownloadTarget) => {
      if (downloading) return;

      const exists = await checkDemoDeliverableExists(deliverables, target);
      if (!exists) {
        const asset =
          target === 'client'
            ? deliverables.reports.client
            : target === 'aiTeam'
              ? deliverables.reports.aiTeam
              : deliverables.campaignPackage;
        showDemoAssetMissingToast(target, asset.publicPathHint);
        return;
      }

      setDownloading(true);
      setPrepTarget(target);
      setPrepStep(0);
      setPrepOpen(true);

      try {
        await runDemoDownloadPreparation(setPrepStep);
        await downloadDemoDeliverableFile(deliverables, target);
      } finally {
        setPrepOpen(false);
        setPrepTarget(null);
        setPrepStep(0);
        setDownloading(false);
      }
    },
    [deliverables, downloading]
  );

  const handleClientReport = () => {
    if (DEMO_MODE) void runDemoDownload('client');
    else engine.downloadClientReport();
  };

  const handleAiTeamReport = () => {
    if (DEMO_MODE) void runDemoDownload('aiTeam');
    else engine.downloadAiTeamReport();
  };

  const handleCampaignPackage = () => {
    if (DEMO_MODE) void runDemoDownload('package');
    else engine.downloadCampaignPackage();
  };

  return (
    <>
      <DemoDownloadPreparationDialog open={prepOpen} step={prepStep} target={prepTarget} />

      <div className={cn('space-y-6', className)}>
        {showReportCards ? (
          <div className="grid gap-3 lg:grid-cols-2">
            <ReportReadyCard
              icon={FileText}
              title={reports.client.title}
              statusLabel={reports.client.statusLabel}
              includes={reports.client.includes}
            />
            <ReportReadyCard
              icon={Settings2}
              title={reports.aiTeam.title}
              statusLabel={reports.aiTeam.statusLabel}
              includes={reports.aiTeam.includes}
            />
          </div>
        ) : null}

        {showPackagePreview ? (
          <div className="space-y-4 rounded-xl border border-primary/20 bg-gradient-to-br from-primary/[0.04] via-background to-background p-5 shadow-sm">
            <div>
              <p className="text-base font-semibold">{campaignPackage.title}</p>
              <p className="text-sm text-muted-foreground">{campaignPackage.subtitle}</p>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              <PackageStatCard
                value={String(presentation.creativeAssets)}
                label="Creative Assets"
                icon={ImageIcon}
              />
              <PackageStatCard
                value={String(presentation.clientReportPages)}
                label="Client Report Pages"
                icon={FileText}
              />
              <PackageStatCard
                value={String(presentation.aiReportPages)}
                label="AI Team Report Pages"
                icon={BarChart3}
              />
              <PackageStatCard
                value={`${presentation.estimatedTimeSavedHours} hrs`}
                label="Estimated Time Saved"
                icon={Clock3}
              />
              <PackageStatCard
                value={presentation.marketingOperationsStatus}
                label="Marketing Operations"
                icon={CheckCircle2}
              />
            </div>

            <ul className="grid gap-1.5 sm:grid-cols-2">
              {presentation.packageContents.map((item) => (
                <li key={item} className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="size-3.5 shrink-0 text-[rgb(29,111,66)]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            <div className="rounded-lg border border-[rgba(29,111,66,0.35)] bg-[rgba(29,111,66,0.06)] px-4 py-3">
              <p className="text-xs text-muted-foreground">Campaign Status</p>
              <p className="text-sm font-semibold text-[rgb(29,111,66)]">
                {presentation.campaignStatusLabel}
              </p>
            </div>

            <Button
              className="h-11 w-full text-base"
              onClick={handleCampaignPackage}
              disabled={downloading}
            >
              <Download className="mr-2 size-4" />
              Download Complete Campaign Package
            </Button>
          </div>
        ) : (
          <Button
            className="h-11 w-full text-base"
            onClick={handleCampaignPackage}
            disabled={downloading}
          >
            <Package className="mr-2 size-4" />
            Download Complete Campaign Package
          </Button>
        )}

        <div className="space-y-3 border-t pt-4">
          <p className="text-sm font-semibold">Individual Reports</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={handleClientReport} disabled={downloading}>
              <Download className="mr-2 size-4" />
              Download Client Report
            </Button>
            <Button variant="outline" size="sm" onClick={handleAiTeamReport} disabled={downloading}>
              <Download className="mr-2 size-4" />
              Download AI Team Performance Report
            </Button>
          </div>
          {DEMO_MODE ? null : (
            <p className="text-xs text-muted-foreground">
              Reports are generated dynamically from campaign data when demo mode is off.
            </p>
          )}
        </div>
      </div>
    </>
  );
}
