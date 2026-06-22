import {
  checkStaticAssetExists,
  DEMO_DOWNLOAD_PREP_DURATION_MS,
  DEMO_DOWNLOAD_PREP_STEPS,
} from '@/lib/demo/demo-download';
import {
  checkDemoDeliverableExists,
  getDemoDownloadAsset,
  showDemoAssetMissingToast,
} from '@/lib/demo/demo-deliverable-download';
import {
  DEFAULT_DEMO_CAMPAIGN_KEY,
  getDemoCampaignDeliverables,
  resolveDemoCampaignKey,
} from '@/lib/demo/demo-reports';

describe('demo reports config', () => {
  it('resolves Thirsty Turtl campaign from context', () => {
    expect(
      resolveDemoCampaignKey({
        campaignId: 'co-1:gentle-cleanser-education',
        companyName: 'Thirsty Turtl',
        campaignTitle: 'Thirsty Turtl — Gentle Cleanser Education Campaign',
      })
    ).toBe('thirsty-turtl');
  });

  it('falls back to default campaign when no matcher hits', () => {
    expect(
      resolveDemoCampaignKey({
        campaignId: 'unknown-campaign',
        companyName: 'Acme Corp',
      })
    ).toBe(DEFAULT_DEMO_CAMPAIGN_KEY);
  });

  it('returns configured download paths without hardcoding brand in logic', () => {
    const deliverables = getDemoCampaignDeliverables({
      companyName: 'Thirsty Turtl',
    });

    expect(deliverables.reports.client.file).toBe('/demo-reports/thirsty-turtl/Client-Report.pdf');
    expect(deliverables.reports.client.publicPathHint).toBe(
      'public/demo-reports/thirsty-turtl/Client-Report.pdf'
    );
    expect(deliverables.reports.aiTeam.file).toBe(
      '/demo-reports/thirsty-turtl/ai_team_performance_report.pdf'
    );
    expect(deliverables.reports.client.downloadName).toBe('Thirsty-Turtl-Client-Report.pdf');
    expect(deliverables.campaignPackage.file).toBe('/demo-packages/thirsty-turtl-campaign-package.zip');
  });

  it('exposes presentation metrics and package contents from config', () => {
    const deliverables = getDemoCampaignDeliverables({ companyName: 'Thirsty Turtl' });

    expect(deliverables.presentation.creativeAssets).toBe(12);
    expect(deliverables.presentation.clientReportPages).toBe(22);
    expect(deliverables.presentation.aiReportPages).toBe(16);
    expect(deliverables.presentation.estimatedTimeSavedHours).toBe(11.2);
    expect(deliverables.presentation.packageContents).toContain('Blog Article');
    expect(deliverables.reports.client.includes).toContain('Campaign Strategy');
    expect(deliverables.reports.aiTeam.includes).toContain('Knowledge Coverage');
  });

  it('maps download assets by target', () => {
    const deliverables = getDemoCampaignDeliverables({ companyName: 'Thirsty Turtl' });
    expect(getDemoDownloadAsset(deliverables, 'package').publicPathHint).toBe(
      'public/demo-packages/thirsty-turtl-campaign-package.zip'
    );
  });
});

describe('demo static asset detection', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('returns true when HEAD succeeds', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 });
    await expect(checkStaticAssetExists('/demo-reports/thirsty-turtl/client-report.pdf')).resolves.toBe(
      true
    );
  });

  it('returns false when asset is missing', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 404 })
      .mockResolvedValueOnce({ ok: false, status: 404 });

    await expect(checkStaticAssetExists('/missing.pdf')).resolves.toBe(false);
  });

  it('checks deliverable existence without throwing', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 404 });
    const deliverables = getDemoCampaignDeliverables({ companyName: 'Thirsty Turtl' });

    await expect(checkDemoDeliverableExists(deliverables, 'client')).resolves.toBe(false);
  });

  it('uses configured preparation timing', () => {
    expect(DEMO_DOWNLOAD_PREP_STEPS).toHaveLength(4);
    expect(DEMO_DOWNLOAD_PREP_DURATION_MS).toBeGreaterThanOrEqual(900);
    expect(DEMO_DOWNLOAD_PREP_DURATION_MS).toBeLessThanOrEqual(1200);
  });
});

describe('demo missing asset toasts', () => {
  it('does not throw when showing missing asset toast', () => {
    expect(() =>
      showDemoAssetMissingToast('client', 'public/demo-reports/thirsty-turtl/client-report.pdf')
    ).not.toThrow();
  });
});
