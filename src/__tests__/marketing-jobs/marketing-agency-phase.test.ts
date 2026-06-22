import { buildDemoStateForStage } from '@/lib/marketing-jobs/demo-mode';
import {
  isFinalDeliveryUnlocked,
  isStrategyReviewPhase,
  resolveMarketingAgencyPhase,
} from '@/lib/marketing-jobs/marketing-agency-phase';

describe('marketing agency phase', () => {
  const input = { companyId: 'demo-co', companyName: 'Thirsty Turtl' };

  it('starts in intake before campaign generation', () => {
    const state = buildDemoStateForStage(input, 'idle');
    expect(resolveMarketingAgencyPhase(state)).toBe('intake');
  });

  it('enters strategy review when package is ready', () => {
    const state = buildDemoStateForStage(input, 'package_ready');
    expect(resolveMarketingAgencyPhase(state)).toBe('strategy_review');
    expect(isStrategyReviewPhase(state)).toBe(true);
  });

  it('does not unlock final deliverables until operations complete', () => {
    const assetsReady = buildDemoStateForStage(input, 'assets_ready');
    const delivery = buildDemoStateForStage(input, 'operations_complete');

    expect(isFinalDeliveryUnlocked(assetsReady)).toBe(false);
    expect(resolveMarketingAgencyPhase(assetsReady)).toBe('operations');
    expect(isFinalDeliveryUnlocked(delivery)).toBe(true);
    expect(resolveMarketingAgencyPhase(delivery)).toBe('delivery');
  });
});
