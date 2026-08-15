import { defaultCommercialDealDraft } from '@/lib/commercial-os/commercial-deal-draft';
import {
  CREATE_INVOICE_CUSTOMER_CHOICE_RAILS_MESSAGE,
  validateCreateInvoiceDraft,
  validateCreateInvoicePaymentRailReadiness,
  validateCreateInvoiceSubmitReadiness,
} from '@/lib/commercial-os/create-invoice-progress';
import {
  paymentMethodAndTokenToSettlementContext,
  resolveSettlementAccount,
} from '@/lib/accounting/settlement-account-resolver';
import { invoicePaymentMethodLabel } from '@/lib/payment-links/invoice-display-status';
import { createPaymentLinkFromDraft } from '@/lib/payment-links/create-payment-link-from-draft';
import {
  formatInvoicePaymentMethodLabel,
  getOperationalMultiCheckoutOptions,
  INVOICE_PAYMENT_METHOD_CUSTOMER_CHOICE_LABEL,
  isMultiCheckoutPaymentMethod,
} from '@/lib/payment-links/payment-collection-mode';
import { paymentLinkAllowsCheckoutRail } from '@/lib/payments/payment-rail-registry';
import { resolvePublicCheckoutMethods } from '@/lib/payments/public-checkout-methods.server';
import { CreatePaymentLinkSchema } from '@/lib/validations/schemas';
import {
  computePaymentLinkRailSetup,
  toPaymentLinkRailSnapshot,
} from '@/lib/payment-links/setup-status';

jest.mock('@/lib/config/env', () => ({
  __esModule: true,
  default: {
    features: { wisePayments: true, evmWalletPayments: true },
  },
}));

jest.mock('@/lib/pilot/wise-auto-settlement', () => ({
  isWiseAutoSettlementAvailable: () => true,
}));

jest.mock('@/lib/payments/evm-wallet-rail.server', () => ({
  resolveMerchantEvmWallet: () => '0x1234567890123456789012345678901234567890',
}));

const ORG_ID = '550e8400-e29b-41d4-a716-446655440000';

const completeDraft = {
  ...defaultCommercialDealDraft(),
  customerName: 'Beth',
  description: 'Campaign',
  amount: 2500,
};

function railSetupWith(input: {
  stripe?: boolean;
  wise?: boolean;
  hedera?: boolean;
  evm?: boolean;
}) {
  return computePaymentLinkRailSetup(
    toPaymentLinkRailSnapshot({
      stripeAccountId: input.stripe ? 'acct_stripe_test' : null,
      hederaAccountId: input.hedera ? '0.0.12345' : null,
      wiseEnabled: input.wise ?? false,
      wiseProfileId: input.wise ? 'wise-profile' : null,
      evmWalletEnabled: input.evm ?? false,
      evmWalletAddress: input.evm ? '0x1234567890123456789012345678901234567890' : null,
    }),
    {
      wisePayments: true,
      evmWalletPayments: true,
    }
  );
}

describe('multi-rail invoice MVP', () => {
  describe('payment collection mode helpers', () => {
    it('identifies multi-checkout payment methods', () => {
      expect(isMultiCheckoutPaymentMethod('STRIPE')).toBe(true);
      expect(isMultiCheckoutPaymentMethod('EVM_WALLET')).toBe(true);
      expect(isMultiCheckoutPaymentMethod('CRYPTO')).toBe(false);
      expect(isMultiCheckoutPaymentMethod('MANUAL_BANK')).toBe(false);
    });

    it('filters operational multi-checkout options', () => {
      const options = [
        { value: 'STRIPE', available: true, configured: true },
        { value: 'WISE', available: true, configured: false },
        { value: 'HEDERA', available: true, configured: true },
        { value: 'MANUAL_BANK', available: true, configured: true },
      ];

      expect(getOperationalMultiCheckoutOptions(options).map((opt) => opt.value)).toEqual([
        'STRIPE',
        'HEDERA',
      ]);
    });

    it('formats null payment method as customer choice label', () => {
      expect(formatInvoicePaymentMethodLabel({ paymentMethod: null })).toBe(
        INVOICE_PAYMENT_METHOD_CUSTOMER_CHOICE_LABEL
      );
    });
  });

  describe('create invoice draft validation', () => {
    it('requires a single payment method in single-rail mode', () => {
      const validation = validateCreateInvoiceDraft({
        ...completeDraft,
        paymentCollectionMode: 'single',
      });
      expect(validation.isSubmittable).toBe(false);
      expect(validation.missingLabels).toContain('Payment method');
    });

    it('accepts customer-choice invoice without paymentMethod', () => {
      const validation = validateCreateInvoiceDraft({
        ...completeDraft,
        paymentCollectionMode: 'customer_choice',
        paymentMethod: undefined,
      });
      expect(validation.isSubmittable).toBe(true);
      expect(validation.paymentMethod).toBe(true);
    });

    it('accepts invoice-only mode without paymentMethod', () => {
      const validation = validateCreateInvoiceDraft({
        ...completeDraft,
        paymentCollectionMode: 'invoice_only',
        paymentMethod: undefined,
      });
      expect(validation.isSubmittable).toBe(true);
    });

    it('blocks customer choice when no operational multi-checkout rails exist', () => {
      const railSetup = railSetupWith({ stripe: false, wise: false, hedera: false });
      const result = validateCreateInvoicePaymentRailReadiness(
        { ...completeDraft, paymentCollectionMode: 'customer_choice' },
        {
          railSetup,
          manualBankReady: true,
          cryptoReady: true,
          paymentMethodOptions: [
            { value: 'STRIPE', available: true, configured: false },
            { value: 'MANUAL_BANK', available: true, configured: true },
          ],
        }
      );

      expect(result.ready).toBe(false);
      expect(result.blockMessage).toBe(CREATE_INVOICE_CUSTOMER_CHOICE_RAILS_MESSAGE);
    });

    it('allows customer choice when at least one multi-checkout rail is operational', () => {
      const railSetup = railSetupWith({ stripe: true });
      const result = validateCreateInvoiceSubmitReadiness(
        { ...completeDraft, paymentCollectionMode: 'customer_choice' },
        {
          railSetup,
          manualBankReady: false,
          cryptoReady: false,
          paymentMethodOptions: [{ value: 'STRIPE', available: true, configured: true }],
        }
      );

      expect(result.isSubmittable).toBe(true);
    });

    it('still locks single-rail invoices to the selected method', () => {
      expect(paymentLinkAllowsCheckoutRail('STRIPE', 'STRIPE')).toBe(true);
      expect(paymentLinkAllowsCheckoutRail('STRIPE', 'WISE')).toBe(false);
      expect(paymentLinkAllowsCheckoutRail('STRIPE', 'HEDERA')).toBe(false);
    });
  });

  describe('CreatePaymentLinkSchema', () => {
    const base = {
      organizationId: ORG_ID,
      amount: 1500,
      currency: 'AUD',
      invoiceCurrency: 'AUD',
      description: 'Consulting services',
      invoiceDate: new Date('2026-08-14T12:00:00.000Z').toISOString(),
      dueDate: new Date('2026-08-28T12:00:00.000Z').toISOString(),
      invoiceOnlyMode: false,
    };

    it('accepts customer choice without paymentMethod', () => {
      const result = CreatePaymentLinkSchema.safeParse({
        ...base,
        customerChoosesAtCheckout: true,
      });
      expect(result.success).toBe(true);
    });

    it('does not require settlement account mappings in the schema', () => {
      const result = CreatePaymentLinkSchema.safeParse({
        ...base,
        customerChoosesAtCheckout: true,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.paymentMethod).toBeUndefined();
      }
    });
  });

  describe('createPaymentLinkFromDraft', () => {
    const originalFetch = global.fetch;

    afterEach(() => {
      global.fetch = originalFetch;
      jest.restoreAllMocks();
    });

    it('persists customer choice flags without paymentMethod', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: { id: 'pl-1', shortCode: 'abc123' } }),
      });
      global.fetch = mockFetch as unknown as typeof fetch;

      await createPaymentLinkFromDraft(ORG_ID, {
        ...completeDraft,
        paymentCollectionMode: 'customer_choice',
        paymentMethod: undefined,
      });

      const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(String(init.body)) as Record<string, unknown>;
      expect(body.customerChoosesAtCheckout).toBe(true);
      expect(body.invoiceOnlyMode).toBe(false);
      expect(body).not.toHaveProperty('paymentMethod');
    });

    it('still sends paymentMethod for single-rail invoices', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: { id: 'pl-1', shortCode: 'abc123' } }),
      });
      global.fetch = mockFetch as unknown as typeof fetch;

      await createPaymentLinkFromDraft(ORG_ID, {
        ...completeDraft,
        paymentCollectionMode: 'single',
        paymentMethod: 'STRIPE',
      });

      const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(String(init.body)) as Record<string, unknown>;
      expect(body.paymentMethod).toBe('STRIPE');
      expect(body.customerChoosesAtCheckout).toBe(false);
    });
  });

  describe('invoice display label', () => {
    it('shows customer choice label when payment_method is null', () => {
      expect(
        invoicePaymentMethodLabel({
          status: 'ACTIVE',
          paymentMethod: null,
          invoiceOnlyMode: false,
        })
      ).toBe(INVOICE_PAYMENT_METHOD_CUSTOMER_CHOICE_LABEL);
    });
  });

  describe('public checkout with null locked payment method', () => {
    it('exposes all configured operational multi-checkout rails', () => {
      const methods = resolvePublicCheckoutMethods({
        invoiceOnly: false,
        lockedPaymentMethod: null,
        merchantSettings: {
          stripe_account_id: 'acct_1',
          hedera_account_id: '0.0.999',
          wise_enabled: true,
          wise_profile_id: 'wise-profile',
          evm_wallet_enabled: true,
          evm_wallet_address: '0x1234567890123456789012345678901234567890',
        },
      });

      expect(methods).toEqual({
        stripe: true,
        hedera: true,
        wise: true,
        metamask: true,
        crypto: false,
        manualBank: false,
      });
    });

    it('locks checkout to a single rail when payment_method is set', () => {
      const methods = resolvePublicCheckoutMethods({
        invoiceOnly: false,
        lockedPaymentMethod: 'WISE',
        merchantSettings: {
          stripe_account_id: 'acct_1',
          hedera_account_id: '0.0.999',
          wise_enabled: true,
          wise_profile_id: 'wise-profile',
        },
      });

      expect(methods.stripe).toBe(false);
      expect(methods.wise).toBe(true);
      expect(methods.hedera).toBe(false);
    });
  });

  describe('settlement routing is driven by confirmed payment, not invoice payment_method', () => {
    it('routes Stripe confirmations to Stripe Holding', () => {
      const context = paymentMethodAndTokenToSettlementContext('STRIPE', null, 'AUD');
      const resolution = resolveSettlementAccount({
        ...context,
        settings: { xero_stripe_clearing_account_id: '1050' },
      });
      expect(resolution.status).toBe('resolved');
      if (resolution.status === 'resolved') {
        expect(resolution.target.accountName).toBe('Stripe Holding');
      }
    });

    it('routes Wise confirmations to Wise Holding', () => {
      const context = paymentMethodAndTokenToSettlementContext('WISE', null, 'AUD');
      const resolution = resolveSettlementAccount({
        ...context,
        settings: { xero_wise_clearing_account_id: '1055' },
      });
      expect(resolution.status).toBe('resolved');
      if (resolution.status === 'resolved') {
        expect(resolution.target.accountName).toBe('Wise Holding');
      }
    });

    it('routes MetaMask USDC to USDC Holding', () => {
      const context = paymentMethodAndTokenToSettlementContext('EVM_WALLET', 'USDC');
      const resolution = resolveSettlementAccount({
        ...context,
        settings: {
          crypto_settlement_strategy: 'per_asset',
          xero_usdc_clearing_account_id: '1052',
        },
      });
      expect(resolution.status).toBe('resolved');
      if (resolution.status === 'resolved') {
        expect(resolution.target.accountName).toBe('USDC Holding');
      }
    });

    it('routes MetaMask USDT to USDT Holding', () => {
      const context = paymentMethodAndTokenToSettlementContext('EVM_WALLET', 'USDT');
      const resolution = resolveSettlementAccount({
        ...context,
        settings: {
          crypto_settlement_strategy: 'per_asset',
          xero_usdt_clearing_account_id: '1053',
        },
      });
      expect(resolution.status).toBe('resolved');
      if (resolution.status === 'resolved') {
        expect(resolution.target.accountName).toBe('USDT Holding');
      }
    });

    it('routes HashPack HBAR to HBAR Holding', () => {
      const context = paymentMethodAndTokenToSettlementContext('HEDERA', 'HBAR');
      const resolution = resolveSettlementAccount({
        ...context,
        settings: {
          crypto_settlement_strategy: 'per_asset',
          xero_hbar_clearing_account_id: '1051',
        },
      });
      expect(resolution.status).toBe('resolved');
      if (resolution.status === 'resolved') {
        expect(resolution.target.accountName).toBe('HBAR Holding');
      }
    });
  });
});
