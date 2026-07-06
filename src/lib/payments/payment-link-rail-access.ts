/**
 * @deprecated Import from `@/lib/payments/payment-rail-registry` instead.
 * Re-exports preserved for existing imports.
 */

export {
  type MultiCheckoutRail,
  type DedicatedCheckoutRail,
  paymentLinkAllowsCheckoutRail,
} from '@/lib/payments/payment-rail-registry';

import {
  getPaymentRailByMethod,
  paymentLinkAllowsCheckoutRail,
  type MultiCheckoutRail,
  type DedicatedCheckoutRail,
} from '@/lib/payments/payment-rail-registry';

/** Multi-rail checkout guard — delegates to registry access rules. */
export function paymentLinkAllowsMultiCheckoutRail(
  lockedMethod: Parameters<typeof paymentLinkAllowsCheckoutRail>[0],
  rail: MultiCheckoutRail
): boolean {
  const definition = getPaymentRailByMethod(rail);
  return definition?.checkoutSurface === 'multi'
    ? paymentLinkAllowsCheckoutRail(lockedMethod, definition)
    : false;
}

/** Dedicated-rail checkout guard — delegates to registry access rules. */
export function paymentLinkIsDedicatedRail(
  lockedMethod: Parameters<typeof paymentLinkAllowsCheckoutRail>[0],
  rail: DedicatedCheckoutRail
): boolean {
  const definition = getPaymentRailByMethod(rail);
  return definition?.checkoutSurface === 'dedicated'
    ? paymentLinkAllowsCheckoutRail(lockedMethod, definition)
    : false;
}
