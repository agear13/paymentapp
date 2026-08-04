/**
 * Generic guided setup types — reusable across Xero, Stripe, Wise, etc.
 */

export type GuidedSetupStep = {
  id: string;
  title: string;
  explanation: string;
  /** DOM id of the section to scroll to and highlight. */
  targetId: string;
  continueLabel?: string;
};

export type GuidedSetupCompletion = {
  title: string;
  body: string;
  bullets: readonly string[];
  primaryAction: { label: string; href: string };
  secondaryAction?: { label: string; href: string };
};

export type GuidedSetupConfig = {
  /** Unique setup flow id, e.g. "xero", "stripe". */
  id: string;
  introTitle: string;
  introSubtitle: string;
  estimatedTime: string;
  completion: GuidedSetupCompletion;
};

export type GuidedSetupPhase = 'intro' | 'active' | 'complete' | 'dismissed';

export function guidedSetupStorageKey(flowId: string, suffix: string): string {
  return `provvy.guided-setup.${flowId}.${suffix}`;
}

/** Server-side flag (ENABLE_GUIDED_SETUP). */
export function isGuidedSetupEnabledServer(): boolean {
  return ['true', '1'].includes((process.env.ENABLE_GUIDED_SETUP || '').toLowerCase());
}

/** Client-visible flag (NEXT_PUBLIC_ENABLE_GUIDED_SETUP). */
export function isGuidedSetupEnabledClient(): boolean {
  return ['true', '1'].includes(
    (process.env.NEXT_PUBLIC_ENABLE_GUIDED_SETUP || '').toLowerCase()
  );
}
