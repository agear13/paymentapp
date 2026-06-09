import {
  isOnboardingStarterAwarenessStep,
  starterLimitMessage,
  STARTER_PLAN_INCLUDES,
} from '@/lib/entitlements/plan-onboarding-summaries';

describe('plan-onboarding-summaries', () => {
  it('defines starter plan includes aligned with entitlement limits', () => {
    expect(STARTER_PLAN_INCLUDES).toEqual([
      'Up to 3 Agreements',
      'Up to 3 AI Imports',
      'Single Workspace',
      'Manual Settlement Tracking',
    ]);
  });

  it('builds consistent starter limit messages', () => {
    expect(starterLimitMessage('create_agreement')).toContain('3 active agreements');
    expect(starterLimitMessage('ai_import')).toContain('3 AI imports');
  });

  it('flags onboarding steps that should show starter awareness', () => {
    expect(isOnboardingStarterAwarenessStep('start_method')).toBe(true);
    expect(isOnboardingStarterAwarenessStep('import_content')).toBe(true);
    expect(isOnboardingStarterAwarenessStep('complete')).toBe(false);
    expect(isOnboardingStarterAwarenessStep('workspace')).toBe(false);
  });
});
