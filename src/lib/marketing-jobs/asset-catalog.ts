import type { CampaignAsset, CampaignAssetType } from '@/lib/marketing-jobs/types';

export type CampaignAssetDefinition = {
  type: CampaignAssetType;
  label: string;
  importAliases: string[];
  creativeRequirements: string[];
};

/** Canonical visual assets requested by the generate_visuals job. */
export const VISUAL_ASSET_CATALOG: CampaignAssetDefinition[] = [
  {
    type: 'instagram-carousel',
    label: 'Instagram Carousel',
    importAliases: ['instagram-carousel', 'instagram carousel', 'carousel'],
    creativeRequirements: [
      'Product Photography',
      'Lifestyle Photography',
      'Brand Colours',
      'Typography',
      'Logo',
    ],
  },
  {
    type: 'facebook-post',
    label: 'Facebook Post',
    importAliases: ['facebook-post', 'facebook post', 'facebook'],
    creativeRequirements: [
      'Hero Image',
      'Campaign Headline',
      'Brand Colours',
      'Logo',
    ],
  },
  {
    type: 'pinterest-pin',
    label: 'Pinterest Pin',
    importAliases: ['pinterest-pin', 'pinterest pin', 'pinterest'],
    creativeRequirements: [
      'Product Image',
      'Educational Headline',
      'Brand Palette',
    ],
  },
  {
    type: 'instagram-story',
    label: 'Instagram Story',
    importAliases: ['instagram-story', 'instagram story', 'story'],
    creativeRequirements: [
      'Vertical Photography',
      'Swipe CTA',
      'Brand Colours',
      'Typography',
    ],
  },
  {
    type: 'newsletter-header',
    label: 'Newsletter Header',
    importAliases: ['newsletter-header', 'newsletter header', 'newsletter'],
    creativeRequirements: [
      'Hero Image',
      'Campaign Title',
      'CTA',
    ],
  },
];

export const REQUESTED_VISUAL_ASSET_LABELS = VISUAL_ASSET_CATALOG.map((asset) => asset.label);

export function createInitialCampaignAssets(campaignId: string, jobId?: string): CampaignAsset[] {
  return VISUAL_ASSET_CATALOG.map((definition) => ({
    id: `${campaignId}:${definition.type}`,
    campaignId,
    type: definition.type,
    label: definition.label,
    status: 'queued',
    jobId,
  }));
}

export function resolveAssetTypeFromImport(type: string): CampaignAssetType | null {
  const normalized = type.trim().toLowerCase();
  const match = VISUAL_ASSET_CATALOG.find(
    (asset) =>
      asset.type === normalized ||
      asset.importAliases.some((alias) => alias.toLowerCase() === normalized)
  );
  return match?.type ?? null;
}

export function getCreativeRequirementsCatalog() {
  return VISUAL_ASSET_CATALOG.map((asset) => ({
    assetType: asset.type,
    label: asset.label,
    requirements: asset.creativeRequirements,
    canvaReady: true,
  }));
}
