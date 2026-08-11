import {
  EntitlementRequiredError,
  parseEntitlementRequiredPayload,
} from '@/lib/entitlements/entitlement-api-errors';

describe('createPaymentLinkFromDraft entitlement errors', () => {
  it('maps feature_gated API body to EntitlementRequiredError', () => {
    const body = {
      error: 'feature_gated',
      code: 'ENTITLEMENT_REQUIRED',
      headline: 'Payment Links are available on Professional',
      message: "You're currently on Starter. Upgrade to Professional to create Payment Links.",
      currentPlan: 'starter',
      requiredPlan: 'professional',
      feature: 'payment_links',
    };
    const payload = parseEntitlementRequiredPayload(body);
    expect(payload).not.toBeNull();
    const err = new EntitlementRequiredError(payload!);
    expect(err.message).toBe(body.message);
    expect(err.message).not.toBe('feature_gated');
  });
});
