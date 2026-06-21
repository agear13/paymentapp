'use client';

import { CheckCircle2, Download, ExternalLink, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { CampaignAsset, MarketingWorkspaceState } from '@/lib/marketing-jobs/types';
import { campaignAssetStatusLabel, selectVisualGenerationJob } from '@/lib/marketing-jobs';
import { MarketingEmptyState } from '@/components/marketing-labs/marketing-empty-state';
import { MARKETING_EMPTY_STATES } from '@/lib/marketing-labs/empty-states';
import { MarketingContextualLoader } from '@/components/marketing-labs/marketing-contextual-loader';
import type { MarketingImportReveal } from '@/components/marketing-labs/marketing-import-reveal';

type CampaignAssetsSectionProps = {
  state: MarketingWorkspaceState;
  importReveal?: MarketingImportReveal | null;
};

function AssetActionButton({
  label,
  icon: Icon,
  href,
  disabled,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href?: string;
  disabled: boolean;
}) {
  if (disabled || !href) {
    return (
      <Button variant="outline" size="sm" disabled>
        <Icon className="mr-1.5 size-3.5" />
        {label}
      </Button>
    );
  }

  return (
    <Button variant="outline" size="sm" asChild>
      <a href={href} target="_blank" rel="noopener noreferrer">
        <Icon className="mr-1.5 size-3.5" />
        {label}
      </a>
    </Button>
  );
}

function AssetRow({ asset }: { asset: CampaignAsset }) {
  const actionsEnabled = asset.status === 'ready' && Boolean(asset.previewUrl || asset.canvaUrl || asset.downloadUrl);

  return (
    <TableRow className="transition-colors duration-200">
      <TableCell className="font-medium">{asset.label}</TableCell>
      <TableCell>
        <Badge
          variant="outline"
          className={cn(
            'transition-colors duration-300',
            asset.status === 'ready' &&
              'border-[rgba(29,111,66,0.35)] bg-[rgba(29,111,66,0.06)] text-[rgb(29,111,66)]'
          )}
        >
          {asset.status === 'ready' ? 'Complete' : campaignAssetStatusLabel(asset.status)}
        </Badge>
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap justify-end gap-2">
          <AssetActionButton label="Preview" icon={Eye} href={asset.previewUrl} disabled={!actionsEnabled} />
          <AssetActionButton label="Open Canva" icon={ExternalLink} href={asset.canvaUrl} disabled={!actionsEnabled} />
          <AssetActionButton label="Download" icon={Download} href={asset.downloadUrl} disabled={!actionsEnabled} />
        </div>
      </TableCell>
    </TableRow>
  );
}

export function CampaignAssetsSection({ state, importReveal }: CampaignAssetsSectionProps) {
  const assets = state.assets;
  const visualJob = selectVisualGenerationJob(state.jobs);
  const productionRunning =
    state.creativeDispatch.status === 'dispatched' &&
    state.creativeDispatch.creativeProductionStatus !== 'complete';
  const allReady = assets.length > 0 && assets.every((a) => a.status === 'ready');
  const awaitingTableReveal = Boolean(importReveal && !importReveal.tableRevealed);
  const assetLabel = importReveal?.importedCount === 1 ? 'asset' : 'assets';

  return (
    <section id="campaign-assets" className="scroll-mt-6 space-y-6 animate-in fade-in duration-500">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Creative Assets</h2>
        <p className="text-sm text-muted-foreground">
          Visual deliverables from the AI Creative Team — carousels, pins, stories, and newsletter headers.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Creative Assets</CardTitle>
          <CardDescription>{state.campaignContext.campaign.title}</CardDescription>
        </CardHeader>
        <CardContent>
          {!visualJob ? (
            <MarketingEmptyState
              content={MARKETING_EMPTY_STATES.creativeAssets}
              ctaHref="#marketing-command-centre"
            />
          ) : productionRunning && !allReady ? (
            <div className="space-y-4">
              <MarketingContextualLoader context="creative-production" />
              <MarketingEmptyState content={MARKETING_EMPTY_STATES.creativeAssetsQueued} />
            </div>
          ) : awaitingTableReveal ? (
            <div
              className="flex flex-col items-center justify-center gap-3 py-14 text-center animate-in fade-in duration-500"
              aria-live="polite"
            >
              <CheckCircle2 className="size-10 text-[rgb(29,111,66)] animate-in zoom-in-95 duration-700" />
              <p className="text-sm font-medium">Creative production complete</p>
              <p className="text-sm text-muted-foreground">
                {importReveal!.importedCount} {assetLabel} imported — loading your library…
              </p>
            </div>
          ) : (
            <Table className={importReveal?.tableRevealed ? 'animate-in fade-in duration-500' : undefined}>
              <TableHeader>
                <TableRow>
                  <TableHead>Asset</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assets.map((asset) => (
                  <AssetRow key={asset.id} asset={asset} />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
