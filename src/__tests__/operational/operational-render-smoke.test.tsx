/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import { cleanup, render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';

import { CustomerFacingOriginProvider } from '@/components/operational/customer-facing-origin-provider';
import { PaymentProgressIndicator } from '@/components/public/payment-progress-indicator';
import { MerchantBranding } from '@/components/public/merchant-branding';
import {
  PaymentLinksTable,
  type PaymentLink,
} from '@/components/payment-links/payment-links-table';
import { CryptoPublicPaymentContent } from '@/components/public/crypto-public-payment-content';
import { ManualBankPublicPaymentContent } from '@/components/public/manual-bank-public-payment-content';

jest.mock('sonner', () => ({
  toast: Object.assign(jest.fn(), {
    error: jest.fn(),
    success: jest.fn(),
  }),
}));

jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: jest.fn() }),
}));

const samplePaymentLink: PaymentLink = {
  id: 'pl_test_001',
  shortCode: 'ABCD1234',
  status: 'OPEN',
  amount: 125.5,
  currency: 'USD',
  description: 'Operational settlement verification invoice',
  invoiceReference: 'INV-2026-001',
  customerEmail: 'payer@example.com',
  customerName: 'Beach Club',
  customerPhone: null,
  dueDate: new Date(Date.now() + 86400000).toISOString(),
  expiresAt: new Date(Date.now() + 86400000 * 7).toISOString(),
  xeroInvoiceNumber: null,
  paymentMethod: 'CRYPTO',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const publicPaymentLink = {
  id: samplePaymentLink.id,
  shortCode: samplePaymentLink.shortCode,
  amount: '125.50',
  currency: 'USD',
  description: samplePaymentLink.description,
  invoiceReference: samplePaymentLink.invoiceReference,
  customerName: samplePaymentLink.customerName,
  dueDate: samplePaymentLink.dueDate as string,
  expiresAt: samplePaymentLink.expiresAt as string,
  merchant: { name: 'Beach Club Operations', logoUrl: null },
  cryptoNetwork: 'Ethereum',
  cryptoAddress: '0x0000000000000000000000000000000000000000',
  cryptoCurrency: 'USDC',
  cryptoMemo: null,
  cryptoInstructions: 'Send exact amount with reference.',
};

function renderWithProviders(ui: ReactElement) {
  return render(
    <CustomerFacingOriginProvider
      origin="https://pay.example.com"
      configured
      infrastructureOverride={false}
    >
      {ui}
    </CustomerFacingOriginProvider>
  );
}

beforeAll(() => {
  Object.assign(navigator, {
    clipboard: {
      writeText: jest.fn().mockResolvedValue(undefined),
    },
  });
});

afterEach(() => {
  cleanup();
  jest.clearAllMocks();
});

describe('operational settlement render smoke', () => {
  it('renders payment stage progression without undefined references', () => {
    render(<PaymentProgressIndicator currentStage="review_invoice" />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.getByText(/review invoice/i)).toBeInTheDocument();
  });

  it('renders merchant branding with initials fallback', () => {
    render(<MerchantBranding merchantName="Beach Club Operations" logoUrl={null} />);
    expect(screen.getByText('Beach Club Operations')).toBeInTheDocument();
    expect(screen.getByText('BC')).toBeInTheDocument();
  });

  it('renders invoice table with formatted currency', () => {
    renderWithProviders(<PaymentLinksTable paymentLinks={[samplePaymentLink]} />);
    expect(screen.getByText(/125\.50|125\.5/)).toBeInTheDocument();
    expect(screen.getByText('Awaiting payment')).toBeInTheDocument();
  });

  it('renders crypto confirmation shell with stage progression', () => {
    render(
      <CryptoPublicPaymentContent shortCode={samplePaymentLink.shortCode} paymentLink={publicPaymentLink} />
    );
    expect(screen.getByText(/Beach Club Operations/i)).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('renders manual bank confirmation shell with stage progression', () => {
    render(
      <ManualBankPublicPaymentContent
        shortCode={samplePaymentLink.shortCode}
        paymentLink={{
          ...publicPaymentLink,
          manualBankRecipientName: 'Beach Club Ltd',
          manualBankCurrency: 'USD',
          manualBankBankName: 'Example Bank',
          manualBankAccountNumber: '****1234',
        }}
      />
    );
    expect(screen.getByText(/Beach Club Operations/i)).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });
});

describe('operational component module bindings', () => {
  const componentModules = [
    '@/components/payment-links/create-payment-link-dialog',
    '@/components/payment-links/payment-link-detail-dialog',
    '@/components/payment-links/payment-links-table',
    '@/components/public/crypto-public-payment-content',
    '@/components/public/manual-bank-public-payment-content',
    '@/components/public/payment-progress-indicator',
  ] as const;

  it.each(componentModules)('loads module %s', async (modulePath) => {
    const mod = await import(modulePath);
    expect(mod).toBeDefined();
  });

  it('exports critical invoice dialog components', async () => {
    const createMod = await import('@/components/payment-links/create-payment-link-dialog');
    const detailMod = await import('@/components/payment-links/payment-link-detail-dialog');
    expect(typeof createMod.CreatePaymentLinkDialog).toBe('function');
    expect(typeof detailMod.PaymentLinkDetailDialog).toBe('function');
  });
});
