import {
  JOURNEY_STEPS,
  isJourneyProvisioningBuild,
  journeyProgressPercent,
  journeyStepIndex,
} from '@/lib/journey/hackathon-journey';

describe('journey progress model', () => {
  test('counts only Intent, Context and Create workspace', () => {
    expect(JOURNEY_STEPS.map((step) => step.id)).toEqual(['intent', 'context', 'create-workspace']);
    expect(journeyStepIndex('/journey/assessment')).toBe(0);
    expect(journeyStepIndex('/journey/assessment/business')).toBe(1);
    expect(journeyStepIndex('/journey/provisioning')).toBe(2);
    expect(journeyProgressPercent('/journey/provisioning')).toBe(100);
  });

  test('does not count leftover analysis, recommendation, verify or provisioning theater', () => {
    expect(journeyStepIndex('/journey/assessment/analysis')).toBe(-1);
    expect(journeyStepIndex('/journey/assessment/connect')).toBe(-1);
    expect(journeyStepIndex('/journey/recommendation')).toBe(-1);
    expect(isJourneyProvisioningBuild('/journey/provisioning', 'build=1')).toBe(true);
    expect(journeyStepIndex('/journey/provisioning', 'build=1')).toBe(-1);
    expect(journeyStepIndex('/workspace')).toBe(-1);
  });
});
