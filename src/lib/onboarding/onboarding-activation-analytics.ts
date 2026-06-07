export const ONBOARDING_ACTIVATION_EVENTS = [
  'workspace_created',
  'agreement_creation_method_selected',
  'template_selected',
  'conversation_import_started',
  'conversation_import_completed',
  'agreement_intelligence_generated',
  'agreement_readiness_viewed',
  'agreement_created',
  'workflow_selected',
  'workspace_ready_viewed',
  'plan_viewed',
  'plan_selected',
  'skip_and_explore_selected',
  'demo_workspace_created',
] as const;

export type OnboardingActivationEvent = (typeof ONBOARDING_ACTIVATION_EVENTS)[number];

export type OnboardingActivationProperties = {
  organizationId?: string | null;
  projectId?: string | null;
  method?: string;
  templateId?: string;
  planId?: string;
  source?: string;
  readinessScore?: number;
  agreementType?: string;
  exploreMode?: boolean;
  [key: string]: string | number | boolean | null | undefined;
};

const ANALYTICS_ENDPOINT = '/api/onboarding/analytics';

/** Fire-and-forget onboarding activation instrumentation. */
export function trackOnboardingActivation(
  event: OnboardingActivationEvent,
  properties?: OnboardingActivationProperties
): void {
  if (typeof window === 'undefined') return;

  const payload = {
    event,
    properties: properties ?? {},
    timestamp: new Date().toISOString(),
    path: window.location.pathname,
  };

  try {
    window.dispatchEvent(new CustomEvent('provvypay:onboarding-activation', { detail: payload }));
  } catch {
    /* ignore */
  }

  void fetch(ANALYTICS_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {
    /* analytics must not block onboarding */
  });
}
