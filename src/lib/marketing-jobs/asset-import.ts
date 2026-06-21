import type { CampaignAsset, ImportedAssetsFile } from '@/lib/marketing-jobs/types';
import { resolveAssetTypeFromImport } from '@/lib/marketing-jobs/asset-catalog';

export type AssetImportResult =
  | { ok: true; updatedAssets: CampaignAsset[]; importedCount: number }
  | { ok: false; error: string };

export function parseImportedAssetsFile(raw: unknown): ImportedAssetsFile | null {
  if (!raw || typeof raw !== 'object') return null;
  const assets = (raw as { assets?: unknown }).assets;
  if (!Array.isArray(assets)) return null;
  return { assets: assets as ImportedAssetsFile['assets'] };
}

export function mergeImportedAssets(
  currentAssets: CampaignAsset[],
  file: ImportedAssetsFile,
  importedAt: string
): AssetImportResult {
  if (!file.assets.length) {
    return { ok: false, error: 'No assets found in file.' };
  }

  const assetByType = new Map(currentAssets.map((asset) => [asset.type, asset]));
  let importedCount = 0;

  for (const record of file.assets) {
    const type = resolveAssetTypeFromImport(record.type);
    if (!type) continue;

    const existing = assetByType.get(type);
    if (!existing) continue;

    assetByType.set(type, {
      ...existing,
      status: 'ready',
      previewUrl: record.preview,
      canvaUrl: record.canvaUrl,
      downloadUrl: record.downloadUrl,
      importedAt,
    });
    importedCount += 1;
  }

  if (importedCount === 0) {
    return {
      ok: false,
      error: 'No matching asset types found. Use types such as instagram-carousel, facebook-post, pinterest-pin.',
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
