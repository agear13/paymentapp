import fs from 'fs';
import path from 'path';
import { computeXeroReadiness } from '@/lib/commercial-os/xero-readiness';
import { computeXeroSetupOverviewFromReadiness } from '@/lib/commercial-os/xero-setup-overview';
import { computeXeroSetupSteps, xeroSetupProgressPercent } from '@/lib/xero/xero-setup-guidance';

const PARTIAL_HOLDING_CODES = new Set(['200', '610', '1050', '1051', '1052']);

const stripeUsdcHbarMappings = {
  xero_revenue_account_id: '200',
  xero_receivable_account_id: '610',
  xero_stripe_clearing_account_id: '1050',
  xero_usdc_clearing_account_id: '1052',
  xero_hbar_clearing_account_id: '1051',
  xero_usdt_clearing_account_id: null,
  xero_audd_clearing_account_id: null,
  xero_wise_clearing_account_id: null,
  crypto_settlement_strategy: 'per_asset' as const,
};

describe('computeXeroSetupSteps', () => {
  it('covers only invoice/accounting setup tasks', () => {
    const steps = computeXeroSetupSteps({
      connected: true,
      tenantId: 'tenant-1',
      revenueMapped: true,
      receivableMapped: true,
    });

    expect(steps.map((step) => step.id)).toEqual([
      'connected',
      'business_selected',
      'invoice_accounts',
    ]);
    expect(steps.every((step) => step.complete)).toBe(true);
    expect(xeroSetupProgressPercent(steps)).toBe(100);
  });

  it('does not include a binary payment-accounts step', () => {
    const steps = computeXeroSetupSteps({
      connected: true,
      tenantId: 'tenant-1',
      revenueMapped: true,
      receivableMapped: true,
    });

    expect(steps.find((step) => step.id === ('payment_accounts' as never))).toBeUndefined();
    expect(steps.find((step) => step.label.toLowerCase().includes('payment accounts confirmed'))).toBeUndefined();
  });
});

describe('computeXeroSetupOverviewFromReadiness', () => {
  it('keeps invoice sync ready while payment holdings are partial', () => {
    const readiness = computeXeroReadiness({
      status: { connected: true, tenantId: 'tenant-1' },
      mappings: stripeUsdcHbarMappings,
      chartAccountCodes: PARTIAL_HOLDING_CODES,
      chartLoaded: true,
      queue: { pendingCount: 0, hasRecentFailures: false },
      merchantRails: {
        stripeEnabled: true,
        wiseEnabled: true,
        stablecoinSettlementsEnabled: true,
        manualBankEnabled: true,
      },
      merchantPaymentCapabilities: {
        hederaConfigured: true,
        evmConfigured: true,
        enabledSettlementTokens: ['USDC', 'HBAR', 'USDT', 'AUDD'],
      },
    });

    const overview = computeXeroSetupOverviewFromReadiness(readiness);

    expect(readiness.canSyncToAccounting).toBe(true);
    expect(overview.invoiceReady).toBe(true);
    expect(overview.invoiceReadinessLabel).toBe('Ready');
    expect(overview.invoiceSteps.every((step) => step.complete)).toBe(true);

    expect(overview.payment.status).toBe('partial');
    expect(overview.payment.statusLabel).toBe('Partially configured');
    expect(overview.payment.configuredCount).toBe(3);
    expect(overview.payment.summary).toContain('3 of');
    expect(overview.payment.summary.toLowerCase()).toContain('partially configured');
    expect(overview.payment.holdings.filter((holding) => holding.configured).map((holding) => holding.label)).toEqual(
      expect.arrayContaining(['Stripe', 'USDC', 'HBAR'])
    );
    expect(overview.payment.unresolvedLabels).toEqual(expect.arrayContaining(['Wise', 'USDT', 'AUDD']));
    expect(overview.payment.unresolvedSummary).toMatch(/Wise/);
    expect(overview.payment.unresolvedSummary).toMatch(/USDT/);
    expect(overview.payment.unresolvedSummary).toMatch(/AUDD/);
    expect(overview.payment.unresolvedSummary).toMatch(/still need holding accounts/);

    expect(overview.historical.status).toBe('not_reviewed');
    expect(overview.historical.label).toBe('Not reviewed');
  });

  it('marks historical payments pending without changing invoice readiness', () => {
    const readiness = computeXeroReadiness({
      status: { connected: true, tenantId: 'tenant-1' },
      mappings: stripeUsdcHbarMappings,
      chartAccountCodes: PARTIAL_HOLDING_CODES,
      chartLoaded: true,
      queue: { pendingCount: 2, hasRecentFailures: false },
      merchantRails: {
        stripeEnabled: true,
        wiseEnabled: false,
        stablecoinSettlementsEnabled: false,
        manualBankEnabled: false,
      },
    });

    const overview = computeXeroSetupOverviewFromReadiness(readiness);

    expect(overview.invoiceReady).toBe(true);
    expect(overview.historical.status).toBe('pending');
    expect(overview.historical.label).toContain('2 past payments waiting');
  });
});

describe('Xero setup progress UI copy', () => {
  it('does not present a binary payment-accounts checklist or an overall readiness percent', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '..', '..', 'components', 'xero', 'xero-setup-progress.tsx'),
      'utf8'
    );

    expect(source).not.toMatch(/Setup checklist/);
    expect(source).not.toMatch(/Payment accounts confirmed/);
    expect(source).not.toMatch(/% complete/);
    expect(source).not.toMatch(/xeroSetupProgressPercent/);
    expect(source).toContain('computeXeroSetupOverviewFromReadiness');
    expect(source).toContain('paymentSection');
  });
});
