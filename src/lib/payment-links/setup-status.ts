/**

 * Single source of truth for Payment Link App payment-rail setup.

 * Re-exports registry-driven readiness helpers for backward compatibility.

 */



export {

  buildInvoicePaymentMethodOptions,

  computePaymentLinkRailSetup,

  guardrailKindForUnconfiguredPaymentMethod,

  isMultiCheckoutRailConfigured,

  isMultiCheckoutRailIncomplete,

  isPaymentRailConfiguredForMerchant,

  multiCheckoutRailLabelsForGuardrail,

  multiCheckoutRailStatus,

  pickAlternativePaymentMethod,

  toPaymentLinkRailSnapshot,

  type InvoicePaymentMethodOption,

  type PaymentLinkMerchantRailSnapshot,

  type PaymentLinkRailSetupStatus,

  type PaymentLinksGuardrailKind,

  type PaymentRailPlatformFeatures,

  type RailSetupStatus,

} from '@/lib/payments/payment-rail-merchant-readiness';



export type { MultiCheckoutRailId } from '@/lib/payments/payment-rail-registry';


