import {
  checkStaticAssetExists,
  DEMO_DOWNLOAD_PREP_DURATION_MS,
  DEMO_DOWNLOAD_PREP_STEPS,
} from '@/lib/demo/demo-download';
import {
  canDownloadMarketingDeliverable,
  getMarketingDeliverablePathHint,
} from '@/lib/demo/marketing-download-service';
import {
  DEFAULT_DEMO_CAMPAIGN_KEY,
  getDemoCampaignDeliverables,
  resolveDemoCampaignKey,
} from '@/lib/demo/demo-reports';
import {
  checkDemoDeliverableExists,
  getDemoDownloadAsset,
  showDemoAssetMissingToast,
} from '@/lib/demo/demo-deliverable-download';
import { buildDemoStateForStage } from '@/lib/marketing-jobs/demo-mode';
import {
  isFinalDeliveryUnlocked,
  isStrategyReviewPhase,
} from '@/lib/marketing-jobs/marketing-agency-phase';

describe('demo reports config', () => {
  const thirstyInput = { companyName: 'Thirsty Turtl' };

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

  it('maps thirsty-turtl strategy report to Thirsty-Turtl-Campaign-Strategy-Report.pdf', () => {
    const deliverables = getDemoCampaignDeliverables(thirstyInput);

    expect(deliverables.reports.strategy.file).toBe(
      '/demo-reports/thirsty-turtl/Thirsty-Turtl-Campaign-Strategy-Report.pdf'
    );
    expect(deliverables.reports.strategy.downloadName).toBe(
      'Thirsty-Turtl-Campaign-Strategy-Report.pdf'
    );
  });

  it('maps thirsty-turtl final client report to client-report-1.pdf', () => {
    const deliverables = getDemoCampaignDeliverables(thirstyInput);

    expect(deliverables.reports.client.file).toBe('/demo-reports/thirsty-turtl/client-report-1.pdf');
    expect(deliverables.reports.client.downloadName).toBe('client-report-1.pdf');
    expect(deliverables.reports.client.publicPathHint).toBe(
      'public/demo-reports/thirsty-turtl/client-report-1.pdf'
    );
  });

  it('keeps ai team performance report mapping unchanged', () => {
    const deliverables = getDemoCampaignDeliverables(thirstyInput);

    expect(deliverables.reports.aiTeam.file).toBe(
      '/demo-reports/thirsty-turtl/ai_team_performance_report.pdf'
    );
  });

  it('maps campaign package zip to thirsty-turtl-campaign-package.zip', () => {
    const deliverables = getDemoCampaignDeliverables(thirstyInput);

    expect(deliverables.campaignPackage.file).toBe('/demo-packages/thirsty-turtl-campaign-package.zip');
    expect(deliverables.campaignPackage.downloadName).toBe('thirsty-turtl-campaign-package.zip');
  });
});

describe('demo static asset detection', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('returns true when HEAD succeeds', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 });
    await expect(
      checkStaticAssetExists('/demo-reports/thirsty-turtl/client-report-1.pdf')
    ).resolves.toBe(true);
  });

  it('returns false when asset is missing', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 404 })
      .mockResolvedValueOnce({ ok: false, status: 404 });

    await expect(checkStaticAssetExists('/missing.pdf')).resolves.toBe(false);
  });

  it('uses configured preparation timing', () => {
    expect(DEMO_DOWNLOAD_PREP_STEPS).toHaveLength(4);
    expect(DEMO_DOWNLOAD_PREP_DURATION_MS).toBeGreaterThanOrEqual(900);
    expect(DEMO_DOWNLOAD_PREP_DURATION_MS).toBeLessThanOrEqual(1200);
  });
});

describe('demo download workflow gates', () => {
  const input = { companyId: 'demo-co', companyName: 'Thirsty Turtl' };

  it('allows strategy report only during strategy review', () => {
    const strategyState = buildDemoStateForStage(input, 'package_ready');
    const deliveryState = buildDemoStateForStage(input, 'operations_complete');

    expect(isStrategyReviewPhase(strategyState)).toBe(true);
    expect(canDownloadMarketingDeliverable('strategy', strategyState)).toBe(true);
    expect(canDownloadMarketingDeliverable('client', strategyState)).toBe(false);
    expect(canDownloadMarketingDeliverable('package', strategyState)).toBe(false);
    expect(canDownloadMarketingDeliverable('client', deliveryState)).toBe(true);
  });

  it('unlocks final deliverables only after operations complete', () => {
    const assetsReady = buildDemoStateForStage(input, 'assets_ready');
    const delivery = buildDemoStateForStage(input, 'operations_complete');

    expect(isFinalDeliveryUnlocked(assetsReady)).toBe(false);
    expect(isFinalDeliveryUnlocked(delivery)).toBe(true);
  });

  it('does not throw when showing missing asset toast', () => {
    const state = buildDemoStateForStage(input, 'package_ready');
    expect(() =>
      showDemoAssetMissingToast('client', getMarketingDeliverablePathHint('client', state))
    ).not.toThrow();
  });

  it('maps download assets by target from config', () => {
    const deliverables = getDemoCampaignDeliverables(input);
    expect(getDemoDownloadAsset(deliverables, 'strategy').file).toBe(
      '/demo-reports/thirsty-turtl/Thirsty-Turtl-Campaign-Strategy-Report.pdf'
    );
    expect(getDemoDownloadAsset(deliverables, 'package').publicPathHint).toBe(
      'public/demo-packages/thirsty-turtl-campaign-package.zip'
    );
  });
});
