/** @jest-environment jsdom */

import {
  clearJourneyProvisioningPending,
  hasJourneyAssessmentData,
  isJourneyProvisioningPending,
  journeyAssessmentsMatch,
  journeyAssessmentContext,
  markJourneyProvisioningPending,
  parseJourneyAssessmentContext,
  persistJourneyBusiness,
  persistJourneyObjective,
  readJourneyAssessment,
  restoreJourneyAssessment,
} from '@/lib/journey/journey-assessment-storage.client';

describe('journey assessment storage', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it('mirrors objective and business into localStorage', () => {
    persistJourneyObjective('reconcile');
    persistJourneyBusiness({ industry: 'SaaS / Technology', size: '6–20' });

    sessionStorage.clear();

    const snapshot = restoreJourneyAssessment();
    expect(snapshot.objective).toBe('reconcile');
    expect(snapshot.business).toEqual({ industry: 'SaaS / Technology', size: '6–20' });
    expect(hasJourneyAssessmentData(snapshot)).toBe(true);
  });

  it('tracks pending provisioning across refresh', () => {
    expect(isJourneyProvisioningPending()).toBe(false);
    markJourneyProvisioningPending();
    expect(isJourneyProvisioningPending()).toBe(true);
    clearJourneyProvisioningPending();
    expect(isJourneyProvisioningPending()).toBe(false);
  });

  it('matches saved and current assessment snapshots', () => {
    const objective = 'forecast';
    const business = { industry: 'Healthcare', size: '21–50' };
    const saved = parseJourneyAssessmentContext(journeyAssessmentContext(objective, business));

    expect(journeyAssessmentsMatch(saved, objective, business)).toBe(true);
    expect(journeyAssessmentsMatch(saved, 'reconcile', business)).toBe(false);
    expect(saved).not.toHaveProperty('recommendedWorkflow');
    expect(JSON.parse(journeyAssessmentContext(objective, business))).not.toHaveProperty(
      'recommendedWorkflow'
    );
  });

  it('still parses legacy snapshots that included a hardcoded workflow', () => {
    const parsed = parseJourneyAssessmentContext(
      JSON.stringify({
        source: 'journey_assessment',
        objective: 'reconcile',
        business: { accounting: 'Xero' },
        recommendedWorkflow: 'autonomous-reconciliation',
      })
    );

    expect(parsed?.objective).toBe('reconcile');
    expect(parsed?.recommendedWorkflow).toBe('autonomous-reconciliation');
  });

  it('reads the latest persisted snapshot', () => {
    persistJourneyObjective('reduce-admin');
    persistJourneyBusiness({ challenge: 'Manual reconciliation' });

    expect(readJourneyAssessment()).toEqual({
      objective: 'reduce-admin',
      business: { challenge: 'Manual reconciliation' },
    });
  });
});
