import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';

/**
 * Product guidance layers (do not merge these models).
 * setup — onboarding answers shown on Workspace / Advisor.
 * contextual — in-surface guidance based on what the user is currently doing.
 * observed — reserved for future behaviour-based recommendations.
 *
 * Contextual guidance should appear on the relevant product surface so the user
 * does not have to leave that work and return to the Advisor. Create Invoice is
 * the first surface; other surfaces should follow this layer later.
 */
export type GuidanceLayer = 'setup' | 'contextual' | 'observed';

export type ContextualGuidanceActionId = 'continue' | 'branding' | 'payment_rail';

export type ContextualGuidanceAction = {
  id: ContextualGuidanceActionId;
  label: string;
  href?: string;
};

export type ContextualGuidance = {
  layer: 'contextual';
  trigger: 'create-invoice';
  title: string;
  description: string;
  actions: ContextualGuidanceAction[];
};

const TITLE = 'Make this invoice work the way you want';

const COPY = {
  both: 'You can customise your invoice with your branding and choose how customers can pay. Set these up now or keep creating your invoice and come back later.',
  branding:
    'You can customise your invoice with your branding. Set this up now or keep creating your invoice and come back later.',
  paymentMethods:
    'You can choose how customers can pay. Set this up now or keep creating your invoice and come back later.',
} as const;

/**
 * Meaningful invoice branding is a logo the merchant uploaded.
 * Bootstrap always writes display_name from the workspace name, so that field
 * is not a valid configured-branding signal.
 */
export function isInvoiceBrandingConfigured(input: {
  displayName?: string | null;
  organizationLogoUrl?: string | null;
}): boolean {
  return Boolean(input.organizationLogoUrl?.trim());
}

/** A usable customer payment option — multi-checkout rail, manual bank, or dedicated crypto. */
export function isCustomerPaymentMethodConfigured(input: {
  anyRailConfigured?: boolean;
  manualBankConfigured?: boolean;
  cryptoConfigured?: boolean;
}): boolean {
  return Boolean(
    input.anyRailConfigured || input.manualBankConfigured || input.cryptoConfigured
  );
}

export function deriveCreateInvoiceContextualGuidance(input: {
  brandingConfigured: boolean;
  paymentRailConfigured: boolean;
}): ContextualGuidance | null {
  const offerBranding = !input.brandingConfigured;
  const offerRails = !input.paymentRailConfigured;
  if (!offerBranding && !offerRails) return null;

  const actions: ContextualGuidanceAction[] = [
    { id: 'continue', label: 'Keep creating invoice' },
  ];

  if (offerBranding) {
    actions.push({
      id: 'branding',
      label: 'Set up branding',
      href: COMMERCIAL_OS_ROUTES.payments,
    });
  }

  if (offerRails) {
    actions.push({
      id: 'payment_rail',
      label: 'Choose payment methods',
      href: COMMERCIAL_OS_ROUTES.paymentsProviders,
    });
  }

  const description =
    offerBranding && offerRails
      ? COPY.both
      : offerBranding
        ? COPY.branding
        : COPY.paymentMethods;

  return {
    layer: 'contextual',
    trigger: 'create-invoice',
    title: TITLE,
    description,
    actions,
  };
}
