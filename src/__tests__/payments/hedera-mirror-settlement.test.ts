const fs = require('fs');
const path = require('path');

const { normalizeHederaTransactionId } = require('../../lib/hedera/txid');

function hederaMirrorSettlementProviderRef(transactionId: string): string {
  return normalizeHederaTransactionId(transactionId);
}

const ADAPTER_PATH = path.join(
  __dirname,
  '..',
  '..',
  'lib',
  'hedera',
  'hedera-mirror-settlement.server.ts'
);
const TRACE_PATH = path.join(
  __dirname,
  '..',
  '..',
  'lib',
  'hedera',
  'hedera-mirror-settlement-trace.ts'
);
const VERIFY_ROUTE_PATH = path.join(
  __dirname,
  '..',
  '..',
  'app',
  'api',
  'hedera',
  'transactions',
  'verify',
  'route.ts'
);
const CONFIRM_ROUTE_PATH = path.join(
  __dirname,
  '..',
  '..',
  'app',
  'api',
  'hedera',
  'confirm',
  'route.ts'
);
const CHECKER_PATH = path.join(
  __dirname,
  '..',
  '..',
  'lib',
  'hedera',
  'transaction-checker.ts'
);
const MONITOR_ROUTE_PATH = path.join(
  __dirname,
  '..',
  '..',
  'app',
  'api',
  'hedera',
  'transactions',
  'monitor',
  'route.ts'
);
const PAYMENT_CONFIRMATION_PATH = path.join(
  __dirname,
  '..',
  '..',
  'lib',
  'services',
  'payment-confirmation.ts'
);

describe('hederaMirrorSettlementProviderRef (R4)', () => {
  const adapterSource = fs.readFileSync(ADAPTER_PATH, 'utf-8');

  it('wraps normalizeHederaTransactionId for providerRef', () => {
    expect(adapterSource).toContain('export function hederaMirrorSettlementProviderRef');
    expect(adapterSource).toContain('return normalizeHederaTransactionId(transactionId)');
  });

  it('normalizes @ format to dash format for providerRef', () => {
    expect(hederaMirrorSettlementProviderRef('0.0.5363033@1769582713.055549545')).toBe(
      '0.0.5363033-1769582713-055549545'
    );
  });

  it('leaves dash format unchanged', () => {
    const id = '0.0.5363033-1769582713-055549545';
    expect(hederaMirrorSettlementProviderRef(id)).toBe(id);
  });
});

describe('executeHederaMirrorSettlement adapter (R4 contract)', () => {
  const adapterSource = fs.readFileSync(ADAPTER_PATH, 'utf-8');
  const traceSource = fs.readFileSync(TRACE_PATH, 'utf-8');

  it('converges through confirmPayment only (no inline settlement)', () => {
    expect(adapterSource).toContain('confirmPayment({');
    expect(adapterSource).not.toContain('transitionPaymentLinkState');
    expect(adapterSource).not.toContain('ledger_entries.create');
    expect(adapterSource).not.toContain('postHederaSettlement');
    expect(adapterSource).not.toContain('applyRevenueShareSplits');
    expect(adapterSource).not.toContain('queueXeroPaymentSyncIfEnabled');
  });

  it('uses hedera provider with manuallyVerified metadata', () => {
    expect(adapterSource).toContain("provider: 'hedera'");
    expect(adapterSource).toContain('manuallyVerified: true');
    expect(adapterSource).toContain("source: 'hedera-manual-verify'");
    expect(adapterSource).toContain("settlementPath: 'hedera_mirror_verify'");
  });

  it('emits hedera_verify_settlement observability stages', () => {
    expect(traceSource).toContain('hedera_verify_settlement_started');
    expect(traceSource).toContain('hedera_verify_settlement_completed');
    expect(traceSource).toContain('hedera_verify_settlement_failed');
    expect(adapterSource).toContain('hederaMirrorSettlementTrace');
    expect(adapterSource).toContain("'hedera_verify_settlement_started'");
    expect(adapterSource).toContain("'hedera_verify_settlement_completed'");
    expect(adapterSource).toContain("'hedera_verify_settlement_failed'");
  });

  it('documents providerRef as normalized transaction id', () => {
    expect(adapterSource).toContain('hederaMirrorSettlementProviderRef');
    expect(adapterSource).toMatch(/providerRef format[\s\S]*dash form/i);
  });
});

describe('H3 verify route (R4)', () => {
  const verifySource = fs.readFileSync(VERIFY_ROUTE_PATH, 'utf-8');

  it('delegates to executeHederaMirrorSettlement without inline PAID/event/ledger', () => {
    expect(verifySource).toContain('executeHederaMirrorSettlement');
    expect(verifySource).not.toMatch(/confirmPayment\s*\(/);
    expect(verifySource).not.toContain('transitionPaymentLinkState');
    expect(verifySource).not.toContain('payment_events.create');
    expect(verifySource).not.toContain('ledger_entries');
    expect(verifySource).not.toContain('ensureLedgerAccounts');
    expect(verifySource).not.toContain('queueXeroPaymentSyncIfEnabled');
  });
});

describe('H1 Hedera confirm path (canonical)', () => {
  const confirmSource = fs.readFileSync(CONFIRM_ROUTE_PATH, 'utf-8');

  it('still calls confirmPayment with hedera provider', () => {
    expect(confirmSource).toContain('confirmPayment({');
    expect(confirmSource).toContain("provider: 'hedera'");
    expect(confirmSource).not.toContain('executeHederaMirrorSettlement');
  });
});

describe('H2 Hedera monitor / transaction-checker path (canonical)', () => {
  const checkerSource = fs.readFileSync(CHECKER_PATH, 'utf-8');
  const monitorSource = fs.readFileSync(MONITOR_ROUTE_PATH, 'utf-8');

  it('transaction-checker persists via confirmPayment', () => {
    expect(checkerSource).toContain('confirmPayment({');
    expect(checkerSource).toContain("provider: 'hedera'");
    expect(checkerSource).not.toContain('ledger_entries.create');
  });

  it('monitor route delegates to checker (no inline settlement)', () => {
    expect(monitorSource).toContain('checkForTransaction');
    expect(monitorSource).not.toContain('ledger_entries.create');
    expect(monitorSource).not.toContain('transitionPaymentLinkState');
  });
});

describe('Hedera duplicate verification and replay (R4 + R5)', () => {
  const adapterSource = fs.readFileSync(ADAPTER_PATH, 'utf-8');
  const confirmSource = fs.readFileSync(PAYMENT_CONFIRMATION_PATH, 'utf-8');

  it('adapter always invokes confirmPayment (idempotency + reconcile delegated)', () => {
    expect(adapterSource).toMatch(/await confirmPayment\(/);
    expect(confirmSource).toContain('checkHederaIdempotency');
  });

  it('confirmPayment runs R5 reconcile on provider idempotency early return', () => {
    expect(confirmSource).toContain('Payment already processed (idempotent)');
    expect(confirmSource).toMatch(
      /idempotencyCheck\.eventId[\s\S]*runCommissionReconcileAfterSettlement/
    );
  });
});

describe('Commission propagation and funding (via confirmPayment only)', () => {
  const confirmSource = fs.readFileSync(PAYMENT_CONFIRMATION_PATH, 'utf-8');
  const adapterSource = fs.readFileSync(ADAPTER_PATH, 'utf-8');

  it('adapter does not call commission or funding directly', () => {
    expect(adapterSource).not.toContain('applyRevenueShareSplits');
    expect(adapterSource).not.toContain('orchestrateFundingAfterInvoiceSettlement');
    expect(adapterSource).not.toContain('reconcileCommissionArtifactsForPaymentEvent');
  });

  it('confirmPayment triggers commission and funding after hedera settlement', () => {
    expect(confirmSource).toContain('applyRevenueShareSplits');
    expect(confirmSource).toContain('orchestrateFundingAfterInvoiceSettlement');
    expect(confirmSource).toContain('postHederaSettlement');
  });
});

describe('No duplicate settlement artifacts (R4 guardrails)', () => {
  const verifySource = fs.readFileSync(VERIFY_ROUTE_PATH, 'utf-8');
  const adapterSource = fs.readFileSync(ADAPTER_PATH, 'utf-8');
  const confirmSource = fs.readFileSync(PAYMENT_CONFIRMATION_PATH, 'utf-8');

  it('verify route cannot create duplicate ledger rows inline', () => {
    expect(verifySource).not.toContain('ledger_entries');
  });

  it('single PAYMENT_CONFIRMED guard remains in confirmPayment', () => {
    expect(confirmSource).toContain('const existingConfirmed = await tx.payment_events.findFirst');
    expect(confirmSource).toContain("event_type: 'PAYMENT_CONFIRMED'");
  });

  it('adapter passes correlationId for ledger idempotency', () => {
    expect(adapterSource).toContain('correlationId');
    expect(adapterSource).toMatch(/confirmPayment\([\s\S]*correlationId/);
  });
});
