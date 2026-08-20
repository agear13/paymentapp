import { computeXeroSetupSteps, xeroSetupProgressPercent } from '@/lib/xero/xero-setup-guidance';

describe('computeXeroSetupSteps', () => {
  it('separates connection, tenant, invoice, payment, and historical sync', () => {
    const steps = computeXeroSetupSteps({
      connected: true,
      tenantId: 'tenant-1',
      revenueMapped: true,
      receivableMapped: true,
      paymentAccountsConfigured: false,
      pendingPaymentCount: 0,
    });

    expect(steps.map((step) => step.id)).toEqual([
      'connected',
      'business_selected',
      'invoice_accounts',
      'payment_accounts',
      'historical_processed',
    ]);
    expect(steps.find((step) => step.id === 'invoice_accounts')?.complete).toBe(true);
    expect(steps.find((step) => step.id === 'payment_accounts')?.complete).toBe(false);
    expect(xeroSetupProgressPercent(steps)).toBe(80);
  });

  it('does not mark payment accounts complete until mappings are valid', () => {
    const steps = computeXeroSetupSteps({
      connected: true,
      tenantId: 'tenant-1',
      revenueMapped: true,
      receivableMapped: true,
      paymentAccountsConfigured: true,
      pendingPaymentCount: 0,
    });

    expect(steps.every((step) => step.complete)).toBe(true);
    expect(xeroSetupProgressPercent(steps)).toBe(100);
  });
});
