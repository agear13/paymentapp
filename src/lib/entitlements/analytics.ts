import { log } from '@/lib/logger';
import type { EntitlementFeature, SubscriptionPlan } from '@/lib/entitlements/types';

export const ENTITLEMENT_ANALYTICS_EVENTS = [
  'feature_gate_viewed',
  'upgrade_prompt_opened',
  'upgrade_clicked',
  'plan_selected',
  'plan_changed',
] as const;

export type EntitlementAnalyticsEvent = (typeof ENTITLEMENT_ANALYTICS_EVENTS)[number];

export type EntitlementAnalyticsPayload = {
  workspaceId?: string;
  organizationId?: string;
  currentPlan?: SubscriptionPlan;
  requiredPlan?: SubscriptionPlan;
  featureName?: string;
  feature?: EntitlementFeature;
  [key: string]: string | number | boolean | null | undefined;
};

export function trackEntitlementEvent(
  event: EntitlementAnalyticsEvent,
  payload: EntitlementAnalyticsPayload
): void {
  log.info('entitlements.analytics', {
    event,
    workspaceId: payload.workspaceId ?? payload.organizationId,
    currentPlan: payload.currentPlan,
    requiredPlan: payload.requiredPlan,
    featureName: payload.featureName ?? payload.feature,
    ...payload,
  });
}
