import { createInitialCampaignAssets } from '@/lib/marketing-jobs/asset-catalog';
import {
  mergeImportedAssets,
  normalizeImportedAssetRecord,
  parseImportedAssetsFile,
} from '@/lib/marketing-jobs/asset-import';
import { rewriteDemoAssetPath } from '@/lib/marketing-jobs/demo-asset-library';

describe('marketing asset import', () => {
  const campaignId = 'test-campaign';
  const importedAt = '2026-06-21T12:00:00.000Z';

  it('parses canonical AI Creative Team assets.json', () => {
    const parsed = parseImportedAssetsFile({
      campaignId: 'camp-1',
      campaignName: 'Thirsty Turtl Campaign',
      status: 'complete',
      generatedAt: importedAt,
      assets: [
        {
          assetId: 'a1',
          assetType: 'Instagram Carousel',
          status: 'generated',
          previewImage: 'https://example.com/preview.png',
          downloadFile: 'https://example.com/file.zip',
        },
      ],
    });

    expect(parsed).not.toBeNull();
    expect(parsed?.campaignName).toBe('Thirsty Turtl Campaign');
    expect(parsed?.assets[0]).toEqual({
      typeHint: 'Instagram Carousel',
      previewUrl: 'https://example.com/preview.png',
      downloadUrl: 'https://example.com/file.zip',
      canvaUrl: undefined,
    });
  });

  it('parses legacy assets.json', () => {
    const parsed = parseImportedAssetsFile({
      assets: [
        {
          type: 'instagram-carousel',
          preview: 'https://example.com/preview.png',
          downloadUrl: 'https://example.com/file.zip',
          canvaUrl: 'https://canva.com/design/abc',
        },
      ],
    });

    expect(parsed?.assets[0]).toEqual({
      typeHint: 'instagram-carousel',
      previewUrl: 'https://example.com/preview.png',
      downloadUrl: 'https://example.com/file.zip',
      canvaUrl: 'https://canva.com/design/abc',
    });
  });

  it('never throws when type fields are missing', () => {
    expect(normalizeImportedAssetRecord({ assetType: undefined, type: undefined })).toBeNull();
    expect(normalizeImportedAssetRecord({ status: 'generated' })).toBeNull();
  });

  it('merges canonical assets onto CampaignAsset model', () => {
    const currentAssets = createInitialCampaignAssets(campaignId);
    const parsed = parseImportedAssetsFile({
      assets: [
        {
          assetType: 'Facebook Post',
          status: 'generated',
          previewImage: 'https://example.com/fb-preview.png',
          downloadFile: 'https://example.com/fb.png',
        },
        {
          assetType: 'Instagram Carousel',
          status: 'generated',
          previewImage: 'https://example.com/ig-preview.png',
          downloadFile: 'https://example.com/ig.zip',
        },
      ],
    });

    const result = mergeImportedAssets(currentAssets, parsed!, importedAt);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const facebook = result.updatedAssets.find((a) => a.type === 'facebook-post');
    const carousel = result.updatedAssets.find((a) => a.type === 'instagram-carousel');

    expect(facebook?.status).toBe('ready');
    expect(facebook?.previewUrl).toBe('https://example.com/fb-preview.png');
    expect(facebook?.downloadUrl).toBe('https://example.com/fb.png');

    expect(carousel?.status).toBe('ready');
    expect(carousel?.previewUrl).toBe('https://example.com/ig-preview.png');
    expect(result.importedCount).toBe(2);
  });

  it('skips assets with non-importable status', () => {
    const parsed = parseImportedAssetsFile({
      assets: [
        { assetType: 'Instagram Carousel', status: 'pending' },
        { assetType: 'Facebook Post', status: 'generated', previewImage: 'https://example.com/x.png' },
      ],
    });

    expect(parsed?.assets).toHaveLength(1);
    expect(parsed?.assets[0]?.typeHint).toBe('Facebook Post');
  });

  it('rewrites AI Creative Team relative paths to demo library URLs', () => {
    expect(rewriteDemoAssetPath('Preview Images/Instagram Carousel.png')).toBe(
      '/demo-assets/thirsty-turtl/gentle-cleanser/Preview Images/Instagram Carousel.png'
    );
    expect(rewriteDemoAssetPath('Assets\\Facebook Post.png')).toBe(
      '/demo-assets/thirsty-turtl/gentle-cleanser/Assets/Facebook Post.png'
    );
    expect(rewriteDemoAssetPath('https://example.com/x.png')).toBe('https://example.com/x.png');
    expect(rewriteDemoAssetPath('/already/absolute.png')).toBe('/already/absolute.png');
  });

  it('normalizes canonical assets with demo path rewriting on import', () => {
    const parsed = parseImportedAssetsFile({
      assets: [
        {
          assetType: 'Instagram Carousel',
          status: 'generated',
          previewImage: 'Preview Images/Instagram Carousel.png',
          downloadFile: 'Assets/Instagram Carousel.png',
        },
      ],
    });

    expect(parsed?.assets[0]?.previewUrl).toBe(
      '/demo-assets/thirsty-turtl/gentle-cleanser/Preview Images/Instagram Carousel.png'
    );
    expect(parsed?.assets[0]?.downloadUrl).toBe(
      '/demo-assets/thirsty-turtl/gentle-cleanser/Assets/Instagram Carousel.png'
    );
  });
});
