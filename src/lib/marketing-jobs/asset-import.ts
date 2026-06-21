import type { CampaignAsset } from '@/lib/marketing-jobs/types';
import { resolveAssetTypeFromImport } from '@/lib/marketing-jobs/asset-catalog';

/** Normalized asset record — supports legacy and AI Creative Team canonical schemas. */
export type NormalizedImportedAsset = {
  typeHint: string;
  previewUrl?: string;
  downloadUrl?: string;
  canvaUrl?: string;
};

export type ParsedImportedAssetsFile = {
  campaignId?: string;
  campaignName?: string;
  status?: string;
  generatedAt?: string;
  assets: NormalizedImportedAsset[];
};

export type AssetImportResult =
  | { ok: true; updatedAssets: CampaignAsset[]; importedCount: number }
  | { ok: false; error: string };

const IMPORTABLE_ASSET_STATUSES = new Set([
  'generated',
  'ready',
  'complete',
  'completed',
  'done',
]);

function safeString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function isImportableAssetStatus(status: string | undefined): boolean {
  if (!status) return true;
  return IMPORTABLE_ASSET_STATUSES.has(status.toLowerCase());
}

/**
 * Maps a single asset entry from either schema:
 * - Legacy: type, preview, downloadUrl, canvaUrl
 * - Canonical: assetType, previewImage, downloadFile, status
 */
export function normalizeImportedAssetRecord(raw: unknown): NormalizedImportedAsset | null {
  if (!raw || typeof raw !== 'object') return null;

  const record = raw as Record<string, unknown>;
  const importStatus = safeString(record.status);
  if (!isImportableAssetStatus(importStatus)) return null;

  const typeHint = safeString(record.type) ?? safeString(record.assetType);
  if (!typeHint) return null;

  return {
    typeHint,
    previewUrl: safeString(record.preview) ?? safeString(record.previewImage),
    downloadUrl: safeString(record.downloadUrl) ?? safeString(record.downloadFile),
    canvaUrl: safeString(record.canvaUrl),
  };
}

export function parseImportedAssetsFile(raw: unknown): ParsedImportedAssetsFile | null {
  if (!raw || typeof raw !== 'object') return null;

  const root = raw as Record<string, unknown>;
  const assetsRaw = root.assets;
  if (!Array.isArray(assetsRaw)) return null;

  const assets: NormalizedImportedAsset[] = [];
  for (const item of assetsRaw) {
    const normalized = normalizeImportedAssetRecord(item);
    if (normalized) assets.push(normalized);
  }

  if (!assets.length) return null;

  return {
    campaignId: safeString(root.campaignId),
    campaignName: safeString(root.campaignName),
    status: safeString(root.status),
    generatedAt: safeString(root.generatedAt),
    assets,
  };
}

export function mergeImportedAssets(
  currentAssets: CampaignAsset[],
  file: ParsedImportedAssetsFile,
  importedAt: string
): AssetImportResult {
  if (!file.assets.length) {
    return { ok: false, error: 'No assets found in file.' };
  }

  const assetByType = new Map(currentAssets.map((asset) => [asset.type, asset]));
  let importedCount = 0;

  for (const record of file.assets) {
    const type = resolveAssetTypeFromImport(record.typeHint);
    if (!type) continue;

    const existing = assetByType.get(type);
    if (!existing) continue;

    assetByType.set(type, {
      ...existing,
      status: 'ready',
      previewUrl: record.previewUrl ?? existing.previewUrl,
      canvaUrl: record.canvaUrl ?? existing.canvaUrl,
      downloadUrl: record.downloadUrl ?? existing.downloadUrl,
      importedAt,
    });
    importedCount += 1;
  }

  if (importedCount === 0) {
    return {
      ok: false,
      error:
        'No matching Creative Asset types found. Expected assetType values such as Instagram Carousel, Facebook Post, or legacy types like instagram-carousel.',
    };
  }

  return {
    ok: true,
    updatedAssets: currentAssets.map((asset) => assetByType.get(asset.type) ?? asset),
    importedCount,
  };
}

export async function readAssetsJsonFile(file: File): Promise<unknown> {
  const text = await file.text();
  return JSON.parse(text) as unknown;
}
