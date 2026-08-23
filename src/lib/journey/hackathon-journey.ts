/**
 * Commercial OS public onboarding journey — routes and feature flag.
 * Lovable source: src/lovable-import/src/routes/
 *
 * Client-visible demo behaviour uses the single public flag:
 * NEXT_PUBLIC_HACKATHON_JOURNEY_ENABLED=true
 */

export const JOURNEY_ROUTES = {
  landing: '/journey',
  assessment: '/journey/assessment',
  assessmentBusiness: '/journey/assessment/business',
  assessmentConnect: '/journey/assessment/connect',
  assessmentAnalysis: '/journey/assessment/analysis',
  recommendation: '/journey/recommendation',
  provisioning: '/journey/provisioning',
  provisioningBuild: '/journey/provisioning?build=1',
} as const;

export type JourneyStepId = 'intent' | 'context' | 'create-workspace';

/** Honest setup progress only — leftover analysis/recommendation routes are not steps. */
export const JOURNEY_STEPS: { id: JourneyStepId; label: string; href: string }[] = [
  { id: 'intent', label: 'Intent', href: JOURNEY_ROUTES.assessment },
  { id: 'context', label: 'Context', href: JOURNEY_ROUTES.assessmentBusiness },
  { id: 'create-workspace', label: 'Create workspace', href: JOURNEY_ROUTES.provisioning },
];

/** Single public hackathon/demo flag — safe for client and server components. */
export function isHackathonJourneyEnabled(): boolean {
  return process.env.NEXT_PUBLIC_HACKATHON_JOURNEY_ENABLED === 'true';
}

/** Approval simulator follows the hackathon public flag. */
export function isDevelopmentApprovalSimulatorEnabled(): boolean {
  return isHackathonJourneyEnabled();
}

/** Payment demo follows the hackathon public flag. */
export function isDevelopmentPaymentSimulatorEnabled(): boolean {
  return isHackathonJourneyEnabled();
}

/** When true, hackathon Stage 5 uses simulated Pinch instead of live sandbox (recording fallback). */
export function isHackathonPinchSimulatorFallback(): boolean {
  return process.env.NEXT_PUBLIC_HACKATHON_PINCH_SIMULATOR === 'true';
}

export function logHackathonDemoFlagsInDevelopment(): void {
  if (process.env.NODE_ENV !== 'development') return;
  console.log(`Hackathon Journey Enabled: ${isHackathonJourneyEnabled()}`);
  console.log(`Demo Payment Simulator Enabled: ${isDevelopmentPaymentSimulatorEnabled()}`);
  console.log(`Hackathon Pinch Simulator Fallback: ${isHackathonPinchSimulatorFallback()}`);
}

export function isJourneyProvisioningBuild(pathname: string, search = ''): boolean {
  return pathname.startsWith('/journey/provisioning') && search.includes('build=1');
}

const UNCOUNTED_JOURNEY_PREFIXES = [
  JOURNEY_ROUTES.assessmentAnalysis,
  JOURNEY_ROUTES.assessmentConnect,
  JOURNEY_ROUTES.recommendation,
] as const;

export function journeyStepIndex(pathname: string, search = ''): number {
  if (isJourneyProvisioningBuild(pathname, search)) return -1;
  if (UNCOUNTED_JOURNEY_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return -1;
  if (pathname.startsWith('/journey/provisioning')) return 2;
  if (pathname.startsWith(JOURNEY_ROUTES.assessmentBusiness)) return 1;
  if (pathname === JOURNEY_ROUTES.assessment || pathname === `${JOURNEY_ROUTES.assessment}/`) {
    return 0;
  }
  return -1;
}

export function journeyProgressPercent(pathname: string, search = ''): number {
  const index = journeyStepIndex(pathname, search);
  if (index < 0) return 0;
  return Math.round(((index + 1) / JOURNEY_STEPS.length) * 100);
}
