import { describe, expect, it } from 'vitest';
import { buildDemoAgreementInsight } from '@/lib/onboarding/onboarding-demo-workspace';
import { buildInsightsFromManual } from '@/lib/onboarding/agreement-intelligence-insights';
import { ONBOARDING_ACTIVATION_EVENTS } from '@/lib/onboarding/onboarding-activation-analytics';

describe('agreement intelligence insights', () => {
  it('builds demo insight with obligations and readiness score', () => {
    const insight = buildDemoAgreementInsight();
    expect(insight.agreementName).toBe('Beach Festival Partnership');
    expect(insight.agreementType).toBe('Event Settlement Agreement');
    expect(insight.obligationsIdentified.length).toBeGreaterThan(0);
    expect(insight.readinessScore).toBeGreaterThanOrEqual(90);
    expect(insight.potentialGaps.some((g) => g.includes('email'))).toBe(true);
  });

  it('derives commercial terms and obligations from manual input', () => {
    const insight = buildInsightsFromManual({
      agreementName: 'Coastal Promotions',
      participants: [{ name: 'Coastal Promotions', email: '', role: 'Promoter' }],
      description: 'Monthly settlement within 10 days with approval before release.',
      creationSource: 'manual',
    });

    expect(insight.commercialTermsFound.some((t) => t.includes('Revenue Share'))).toBe(true);
    expect(insight.obligationsIdentified.some((o) => o.includes('monthly'))).toBe(true);
    expect(insight.readinessScore).toBeGreaterThan(0);
  });
});

describe('onboarding activation analytics', () => {
  it('includes required funnel events', () => {
    expect(ONBOARDING_ACTIVATION_EVENTS).toContain('workspace_created');
    expect(ONBOARDING_ACTIVATION_EVENTS).toContain('agreement_intelligence_generated');
    expect(ONBOARDING_ACTIVATION_EVENTS).toContain('skip_and_explore_selected');
    expect(ONBOARDING_ACTIVATION_EVENTS).toContain('demo_workspace_created');
  });
});
