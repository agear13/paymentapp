/**
 * Hackathon public onboarding journey — routes and feature flag.
 * Lovable source: src/lovable-import/src/routes/
 */

export const JOURNEY_ROUTES = {
  landing: '/journey',
  assessment: '/journey/assessment',
  assessmentBusiness: '/journey/assessment/business',
  assessmentConnect: '/journey/assessment/connect',
  assessmentAnalysis: '/journey/assessment/analysis',
  recommendation: '/journey/recommendation',
  provisioning: '/journey/provisioning',
  provisioningBuild: '/journey/provisioning/build',
} as const;

export type JourneyStepId =
  | 'landing'
  | 'assessment'
  | 'business'
  | 'connect'
  | 'analysis'
  | 'recommendation'
  | 'provisioning'
  | 'provisioningBuild';

export const JOURNEY_STEPS: { id: JourneyStepId; label: string; href: string }[] = [
  { id: 'assessment', label: 'Objective', href: JOURNEY_ROUTES.assessment },
  { id: 'business', label: 'Business', href: JOURNEY_ROUTES.assessmentBusiness },
  { id: 'connect', label: 'Connect', href: JOURNEY_ROUTES.assessmentConnect },
  { id: 'analysis', label: 'Analysis', href: JOURNEY_ROUTES.assessmentAnalysis },
  { id: 'recommendation', label: 'Recommendation', href: JOURNEY_ROUTES.recommendation },
  { id: 'provisioning', label: 'Workspace', href: JOURNEY_ROUTES.provisioning },
  { id: 'provisioningBuild', label: 'Provisioning', href: JOURNEY_ROUTES.provisioningBuild },
];

export function isHackathonJourneyEnabled(): boolean {
  return process.env.HACKATHON_JOURNEY_ENABLED === 'true';
}

export function journeyStepIndex(pathname: string): number {
  if (pathname.startsWith(JOURNEY_ROUTES.provisioningBuild)) return 6;
  if (pathname.startsWith(JOURNEY_ROUTES.provisioning)) return 5;
  if (pathname.startsWith(JOURNEY_ROUTES.recommendation)) return 4;
  if (pathname.startsWith(JOURNEY_ROUTES.assessmentAnalysis)) return 3;
  if (pathname.startsWith(JOURNEY_ROUTES.assessmentConnect)) return 2;
  if (pathname.startsWith(JOURNEY_ROUTES.assessmentBusiness)) return 1;
  if (pathname.startsWith(JOURNEY_ROUTES.assessment)) return 0;
  return -1;
}

export function journeyProgressPercent(pathname: string): number {
  const index = journeyStepIndex(pathname);
  if (index < 0) return 0;
  return Math.round(((index + 1) / JOURNEY_STEPS.length) * 100);
}
