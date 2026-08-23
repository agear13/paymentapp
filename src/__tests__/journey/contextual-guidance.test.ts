import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';
import {
  deriveCreateInvoiceContextualGuidance,
  isCustomerPaymentMethodConfigured,
  isInvoiceBrandingConfigured,
} from '@/lib/journey/contextual-guidance';

describe('invoice branding detection', () => {
  test('does not treat bootstrap display_name as configured branding', () => {
    expect(
      isInvoiceBrandingConfigured({
        displayName: "alish's workspace",
        organizationLogoUrl: null,
      })
    ).toBe(false);
    expect(
      isInvoiceBrandingConfigured({
        displayName: 'Professional services',
        organizationLogoUrl: '',
      })
    ).toBe(false);
  });

  test('treats an uploaded organization logo as configured branding', () => {
    expect(
      isInvoiceBrandingConfigured({
        displayName: "alish's workspace",
        organizationLogoUrl: 'https://cdn.example.com/logo.png',
      })
    ).toBe(true);
  });
});

describe('customer payment method readiness', () => {
  test('does not treat an unconfigured new workspace as ready to collect', () => {
    expect(
      isCustomerPaymentMethodConfigured({
        anyRailConfigured: false,
        manualBankConfigured: false,
        cryptoConfigured: false,
      })
    ).toBe(false);
  });

  test('counts a genuinely configured dedicated crypto method', () => {
    expect(
      isCustomerPaymentMethodConfigured({
        anyRailConfigured: false,
        manualBankConfigured: false,
        cryptoConfigured: true,
      })
    ).toBe(true);
  });

  test('counts a configured multi-checkout rail or manual bank', () => {
    expect(isCustomerPaymentMethodConfigured({ anyRailConfigured: true })).toBe(true);
    expect(isCustomerPaymentMethodConfigured({ manualBankConfigured: true })).toBe(true);
  });
});

describe('create-invoice contextual guidance', () => {
  test('explains both options when neither branding nor payment methods are configured', () => {
    const guidance = deriveCreateInvoiceContextualGuidance({
      brandingConfigured: false,
      paymentRailConfigured: false,
    });

    expect(guidance?.layer).toBe('contextual');
    expect(guidance?.trigger).toBe('create-invoice');
    expect(guidance?.title).toBe('Make this invoice work the way you want');
    expect(guidance?.description).toMatch(/branding/);
    expect(guidance?.description).toMatch(/how customers can pay/);
    expect(guidance?.actions.map((action) => action.id)).toEqual([
      'continue',
      'branding',
      'payment_rail',
    ]);
    expect(guidance?.actions[0]).toEqual({ id: 'continue', label: 'Keep creating invoice' });
  });

  test('discusses branding only when only branding is missing', () => {
    const guidance = deriveCreateInvoiceContextualGuidance({
      brandingConfigured: false,
      paymentRailConfigured: true,
    });

    expect(guidance?.description).toMatch(/branding/);
    expect(guidance?.description).not.toMatch(/how customers can pay/);
    expect(guidance?.actions.map((action) => action.id)).toEqual(['continue', 'branding']);
    expect(guidance?.actions.find((action) => action.id === 'branding')?.href).toBe(
      COMMERCIAL_OS_ROUTES.payments
    );
  });

  test('discusses payment methods only when only rails are missing', () => {
    const guidance = deriveCreateInvoiceContextualGuidance({
      brandingConfigured: true,
      paymentRailConfigured: false,
    });

    expect(guidance?.description).toMatch(/how customers can pay/);
    expect(guidance?.description).not.toMatch(/branding/);
    expect(guidance?.actions.map((action) => action.id)).toEqual(['continue', 'payment_rail']);
    expect(guidance?.actions.find((action) => action.id === 'payment_rail')?.href).toBe(
      COMMERCIAL_OS_ROUTES.paymentsProviders
    );
  });

  test('hides when branding and payment methods are already configured', () => {
    expect(
      deriveCreateInvoiceContextualGuidance({
        brandingConfigured: true,
        paymentRailConfigured: true,
      })
    ).toBeNull();
  });

  test('does not offer Choose payment methods when dedicated crypto is already usable', () => {
    const paymentRailConfigured = isCustomerPaymentMethodConfigured({
      cryptoConfigured: true,
    });
    const guidance = deriveCreateInvoiceContextualGuidance({
      brandingConfigured: true,
      paymentRailConfigured,
    });

    expect(guidance).toBeNull();
  });
});
