import {
  buildOnboardingProject,
  buildOnboardingProjectWithId,
} from '@/lib/onboarding/build-onboarding-project';

describe('buildOnboardingProject', () => {
  it('creates a valid deal with draft defaults', () => {
    const deal = buildOnboardingProject({
      projectName: 'Beach Club Event',
      description: 'Saturday night',
      estimatedValue: 10000,
      currency: 'AUD',
    });
    expect(deal.dealName).toBe('Beach Club Event');
    expect(deal.setupStatus).toBe('configuring');
    expect(deal.operationalCompleteness).toBeDefined();
    expect(deal.id).toMatch(/^onb-deal-/);
  });

  it('reuses project id on retry', () => {
    const id = 'onb-deal-existing-123';
    const deal = buildOnboardingProjectWithId({
      projectName: 'Beach Club Event',
      currency: 'AUD',
      projectId: id,
    });
    expect(deal.id).toBe(id);
  });
});
