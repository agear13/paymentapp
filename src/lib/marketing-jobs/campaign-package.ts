import type { CampaignPackageExport, MarketingCampaignContext } from '@/lib/marketing-jobs/types';
import { REQUESTED_VISUAL_ASSET_LABELS, VISUAL_ASSET_CATALOG } from '@/lib/marketing-jobs/asset-catalog';
import { CREATIVE_PRODUCTION_ESTIMATE_MINUTES } from '@/lib/marketing-jobs/creative-team';

import { downloadZipArchive } from '@/lib/marketing-jobs/zip-download';

export function buildCampaignPackageExport(input: {
  context: MarketingCampaignContext;
  jobId: string;
  exportedAt?: string;
}): CampaignPackageExport {
  const { context, jobId } = input;

  return {
    company: { name: context.company.name },
    campaign: { title: context.campaign.title },
    companyBrain: context.companyBrain,
    article: context.article,
    copy: context.copy,
    seo: context.seo,
    visualRecommendations: context.visualRecommendations,
    requestedAssets: [...REQUESTED_VISUAL_ASSET_LABELS],
    exportedAt: input.exportedAt ?? new Date().toISOString(),
    jobId,
  };
}

export type CampaignPackageFile = {
  path: string;
  content: string;
};

export function buildCampaignPackageFiles(input: {
  context: MarketingCampaignContext;
  jobId: string;
  exportedAt?: string;
}): CampaignPackageFile[] {
  const exportedAt = input.exportedAt ?? new Date().toISOString();
  const payload = buildCampaignPackageExport({ ...input, exportedAt });
  const { context } = input;

  const articleMarkdown = [
    `# ${context.article.title}`,
    '',
    context.article.summary,
    '',
    '## Outline',
    ...context.article.outline.map((item) => `- ${item}`),
  ].join('\n');

  const socialCopyMarkdown = [
    `# Social Copy`,
    '',
    `## Headline`,
    context.copy.headline,
    '',
    `## Subheadline`,
    context.copy.subheadline,
    '',
    `## CTA`,
    context.copy.cta,
    '',
    `## Social Caption`,
    context.copy.socialCaption,
    '',
    `## Newsletter Intro`,
    context.copy.newsletterIntro,
  ].join('\n');

  const seoMarkdown = [
    `# SEO Strategy`,
    '',
    `**Primary keyword:** ${context.seo.primaryKeyword}`,
    '',
    `**Secondary keywords:** ${context.seo.secondaryKeywords.join(', ')}`,
    '',
    `**Meta description:** ${context.seo.metaDescription}`,
  ].join('\n');

  const visualBriefMarkdown = [
    `# Visual Brief`,
    '',
    ...Object.entries(context.visualRecommendations).map(
      ([key, rec]) =>
        `## ${key}\n- Format: ${rec.format}\n- Dimensions: ${rec.dimensions}\n- Concept: ${rec.concept}\n- Notes: ${rec.notes}\n`
    ),
  ].join('\n');

  const campaignSummaryMarkdown = [
    `# Campaign Summary`,
    '',
    `**Campaign:** ${context.campaign.title}`,
    `**Type:** ${context.campaign.type}`,
    `**Business goal:** ${context.campaign.businessGoal}`,
    `**Target audience:** ${context.campaign.targetAudience}`,
  ].join('\n');

  const assetChecklistMarkdown = [
    `# Creative Asset Checklist`,
    '',
    ...VISUAL_ASSET_CATALOG.map(
      (asset) =>
        `## ${asset.label}\n${asset.creativeRequirements.map((req) => `- [ ] ${req}`).join('\n')}\n`
    ),
  ].join('\n');

  const canvaTemplateJson = {
    campaign: context.campaign.title,
    company: context.company.name,
    assets: VISUAL_ASSET_CATALOG.map((asset) => ({
      type: asset.type,
      label: asset.label,
      requirements: asset.creativeRequirements,
    })),
    exportedAt,
  };

  return [
    { path: 'README.md', content: buildReadmeMarkdown(context, exportedAt) },
    { path: 'campaign.json', content: JSON.stringify(payload, null, 2) },
    { path: 'company-brain/brand-voice.md', content: `# Brand Voice\n\n${context.companyBrain.brandVoice}` },
    { path: 'company-brain/messaging.md', content: `# Messaging\n\n${context.companyBrain.messaging}` },
    { path: 'company-brain/personas.md', content: `# Personas\n\n${context.companyBrain.personas}` },
    {
      path: 'company-brain/positioning.md',
      content: `# Positioning\n\n${context.companyBrain.positioning ?? ''}`,
    },
    {
      path: 'company-brain/products.md',
      content: `# Products\n\n${context.companyBrain.products ?? ''}`,
    },
    { path: 'campaign/campaign-summary.md', content: campaignSummaryMarkdown },
    { path: 'campaign/article.md', content: articleMarkdown },
    { path: 'campaign/social-copy.md', content: socialCopyMarkdown },
    { path: 'campaign/seo-strategy.md', content: seoMarkdown },
    { path: 'campaign/visual-brief.md', content: visualBriefMarkdown },
    {
      path: 'creative/required-assets.json',
      content: JSON.stringify({ requestedAssets: REQUESTED_VISUAL_ASSET_LABELS }, null, 2),
    },
    { path: 'creative/asset-checklist.md', content: assetChecklistMarkdown },
    {
      path: 'creative/canva-template.json',
      content: JSON.stringify(canvaTemplateJson, null, 2),
    },
  ];
}

export function buildReadmeMarkdown(context: MarketingCampaignContext, exportedAt: string): string {
  const assetList = VISUAL_ASSET_CATALOG.map((asset) => `• Create ${asset.label.toLowerCase()}`).join('\n');

  return [
    'Provvypay Labs',
    '',
    'AI Creative Dispatch Package',
    '',
    'Client',
    context.company.name,
    '',
    'Campaign',
    context.article.title,
    '',
    'Contents',
    '',
    '✓ Company Brain',
    '✓ Campaign Strategy',
    '✓ Marketing Copy',
    '✓ Visual Brief',
    '✓ Creative Asset Checklist',
    '',
    'Next Step',
    '',
    'Provide this package to the AI Creative Team.',
    '',
    'The AI Creative Team will:',
    '',
    assetList,
    '',
    'Expected completion time',
    '',
    `Approximately ${CREATIVE_PRODUCTION_ESTIMATE_MINUTES - 3}–${CREATIVE_PRODUCTION_ESTIMATE_MINUTES} minutes.`,
    '',
    `Exported: ${exportedAt}`,
  ].join('\n');
}

/** @deprecated Use downloadCampaignPackageZip — retained for internal reuse. */
export function downloadCampaignPackageJson(payload: CampaignPackageExport): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'campaign-package.json';
  anchor.click();
  URL.revokeObjectURL(url);
}

export function downloadCampaignPackageZip(files: CampaignPackageFile[]): void {
  downloadZipArchive(files, 'campaign-package.zip');
}
