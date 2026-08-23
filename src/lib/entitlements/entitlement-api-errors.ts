import type { EntitlementFeature, SubscriptionPlan } from '@/lib/entitlements/types';

export const ENTITLEMENT_REQUIRED_CODE = 'ENTITLEMENT_REQUIRED';

export type EntitlementRequiredPayload = {
  error?: string;
  code?: string;
  feature?: EntitlementFeature;
  featureName?: string;
  currentPlan?: SubscriptionPlan;
  requiredPlan?: SubscriptionPlan;
  headline?: string;
  message?: string;
  reason?: string;
};

export class EntitlementRequiredError extends Error {
  readonly code = ENTITLEMENT_REQUIRED_CODE;
  readonly feature?: EntitlementFeature;
  readonly featureName?: string;
  readonly currentPlan?: SubscriptionPlan;
  readonly requiredPlan: SubscriptionPlan;
  readonly headline: string;
  readonly userMessage: string;
  readonly reason?: string;

  constructor(payload: EntitlementRequiredPayload) {
    const headline =
      payload.headline ??
      (payload.featureName
        ? `${payload.featureName} requires an upgrade`
        : 'Upgrade required');
    const userMessage =
      payload.message ??
      headline;

    super(userMessage);
    this.name = 'EntitlementRequiredError';
    this.feature = payload.feature;
    this.featureName = payload.featureName;
    this.currentPlan = payload.currentPlan;
    this.requiredPlan = payload.requiredPlan ?? 'professional';
    this.headline = headline;
    this.userMessage = userMessage;
    this.reason = payload.reason;
  }
}

export function parseEntitlementRequiredPayload(
  body: unknown
): EntitlementRequiredPayload | null {
  if (!body || typeof body !== 'object') return null;
  const record = body as Record<string, unknown>;
  if (record.code !== ENTITLEMENT_REQUIRED_CODE && record.error !== 'feature_gated') {
    return null;
  }
  return record as EntitlementRequiredPayload;
}

export function isEntitlementRequiredError(error: unknown): error is EntitlementRequiredError {
  return error instanceof EntitlementRequiredError;
}
