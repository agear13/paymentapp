import type { OnboardingStep } from '@/lib/onboarding/operator-onboarding-types';
import { STARTER_MAX_AGREEMENTS, STARTER_MAX_AI_IMPORTS } from '@/lib/entitlements/plans';

export const STARTER_PLAN_INCLUDES = [
  `Up to ${STARTER_MAX_AGREEMENTS} Agreements`,
  `Up to ${STARTER_MAX_AI_IMPORTS} AI Imports`,
  'Single Workspace',
  'Manual Settlement Tracking',
] as const;

export const STARTER_UPGRADE_COMPARISON =
  'Need more? Professional includes unlimited agreements, unlimited AI imports, payment links, referrals and Xero integration.';

export const PROFESSIONAL_PLAN_SUMMARY =
  'Unlimited agreements and imports. Includes payment links, referrals and Xero integration.';

export const GROWTH_PLAN_SUMMARY =
  'Everything in Professional plus team members, approval workflows, advanced reporting and automated settlement coordination.';

export const ONBOARDING_STARTER_AWARENESS_STEPS: OnboardingStep[] = [
  'start_method',
  'import_source',
  'import_content',
  'template_select',
  'project',
  'participants',
  'use_case',
  'funding',
  'payment_rails',
];

export type StarterLimitFeature = 'create_agreement' | 'ai_import';

export function starterLimitMessage(feature: StarterLimitFeature): string {
  if (feature === 'ai_import') {
    return `Starter includes ${STARTER_MAX_AI_IMPORTS} AI imports. Upgrade to Professional for unlimited imports.`;
  }
  return `Starter includes ${STARTER_MAX_AGREEMENTS} active agreements. Upgrade to Professional for unlimited agreements.`;
}

export function isOnboardingStarterAwarenessStep(step: OnboardingStep): boolean {
  return ONBOARDING_STARTER_AWARENESS_STEPS.includes(step);
}
