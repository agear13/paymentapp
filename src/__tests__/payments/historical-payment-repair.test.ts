/**
 * Historical payment repair — cohort inventory, dry-run default, idempotent repair paths.
 */

const fs = require('fs');
const path = require('path');

const REPAIR_CORE = path.join(
  __dirname,
  '..',
  '..',
  'lib',
  'payments',
  'historical-payment-repair.core.ts'
);
const REPAIR_SERVER = path.join(
  __dirname,
  '..',
  '..',
  'lib',
  'payments',
  'historical-payment-repair.server.ts'
);
const REPAIR_SCRIPT = path.join(__dirname, '..', '..', 'scripts', 'historical-payment-repair.ts');
const CONFIRM_PAYMENT = path.join(
  __dirname,
  '..',
  '..',
  'lib',
  'services',
  'payment-confirmation.ts'
);
const COMMISSION_RECONCILE = path.join(
  __dirname,
  '..',
  '..',
  'lib',
  'referrals',
  'commission-reconcile.server.ts'
);

describe('Historical payment repair — architecture contract', () => {
  const coreSource = fs.readFileSync(REPAIR_CORE, 'utf-8');
  const serverSource = fs.readFileSync(REPAIR_SERVER, 'utf-8');
  const scriptSource = fs.readFileSync(REPAIR_SCRIPT, 'utf-8');
  const confirmSource = fs.readFileSync(CONFIRM_PAYMENT, 'utf-8');

  it('server module is a server-only re-export of core', () => {
    expect(serverSource).toContain("import 'server-only'");
    expect(serverSource).toContain('historical-payment-repair.core');
    expect(coreSource).not.toContain("import 'server-only'");
  });

  it('CLI loads server-only stub and dynamically imports core after dotenv', () => {
    expect(scriptSource).toContain('register-server-only-stub');
    expect(scriptSource).toContain('historical-payment-repair.core');
    expect(scriptSource).toContain('await import(');
    expect(scriptSource).not.toContain('historical-payment-repair.server');
  });

  it('does not modify confirmPayment implementation', () => {
    expect(coreSource).not.toContain('payment-confirmation.ts');
    expect(coreSource).toMatch(/from '@\/lib\/services\/payment-confirmation'/);
    expect(confirmSource).not.toContain('historical-payment-repair');
  });

  it('uses confirmPayment for settlement backfill only', () => {
    expect(coreSource).toContain('await confirmPayment(resolved.params)');
    expect(coreSource).not.toContain('transitionPaymentLinkState');
    expect(coreSource).not.toContain('ledger_entries.create');
    expect(coreSource).not.toContain('payment_events.create');
    expect(coreSource).not.toContain('queueXeroPaymentSyncIfEnabled');
  });

  it('uses reconcileCommissionArtifactsForPaymentEvent for commission gaps', () => {
    expect(coreSource).toContain('reconcileCommissionArtifactsForPaymentEvent');
    expect(coreSource).toContain('detectCommissionArtifactGaps');
    expect(coreSource).toContain('orchestrateFunding: true');
    expect(coreSource).not.toContain('applyRevenueShareSplits');
  });

  it('uses runtime-safe settlement provider refs', () => {
    expect(coreSource).toContain('settlement-provider-refs');
    expect(coreSource).not.toContain('assisted-review-settlement.server');
    expect(coreSource).not.toContain('manual-invoice-settlement.server');
  });

  it('defaults dry-run in runHistoricalPaymentRepair', () => {
    expect(coreSource).toContain('const dryRun = options.dryRun !== false');
  });

  it('guards settlement when PAYMENT_CONFIRMED already exists', () => {
    expect(coreSource).toContain("event_type: 'PAYMENT_CONFIRMED'");
    expect(coreSource).toContain('payment_confirmed_already_exists');
  });

  it('CLI defaults to dry-run unless --execute', () => {
    expect(scriptSource).toContain("argv.includes('--execute')");
    expect(scriptSource).toContain('dryRun: !execute');
    expect(scriptSource).toContain('DRY-RUN (default)');
  });

  it('CLI --help exits before loading repair module', () => {
    expect(scriptSource).toContain("cliArgv.includes('--help')");
    expect(scriptSource).toMatch(/printHelp\(\)[\s\S]*process\.exit\(0\)/);
  });

  it('writes JSON audit file on every run', () => {
    expect(scriptSource).toContain('scripts/.repair-audit');
    expect(scriptSource).toContain('writeFileSync');
  });
});

describe('Historical payment repair — cohort A (PAID without PAYMENT_CONFIRMED)', () => {
  const serverSource = fs.readFileSync(REPAIR_CORE, 'utf-8');

  it('detects cohort A via isPaidWithoutPaymentConfirmed', () => {
    expect(serverSource).toContain('isPaidWithoutPaymentConfirmed');
    expect(serverSource).toContain("status: 'PAID'");
    expect(serverSource).toContain('plannedAction: \'settlement_confirm_payment\'');
  });

  it('inventory query excludes links with PAYMENT_CONFIRMED', () => {
    expect(serverSource).toContain('payment_events: { none: { event_type: \'PAYMENT_CONFIRMED\' } }');
  });
});

describe('Historical payment repair — cohort B/F (commission reconcile)', () => {
  const serverSource = fs.readFileSync(REPAIR_CORE, 'utf-8');

  it('plans commission_reconcile when repairable gaps exist', () => {
    expect(serverSource).toContain('plannedAction: needsReconcile ? \'commission_reconcile\' : \'skip\'');
    expect(serverSource).toContain('detectCommissionArtifactGaps(pe.id)');
  });

  it('maps repairable gaps to cohort F', () => {
    expect(serverSource).toContain("cohort === 'B' && repairable.length > 0 ? 'F' : cohort");
  });
});

describe('Historical payment repair — cohort C (Hedera manual verify)', () => {
  const serverSource = fs.readFileSync(REPAIR_CORE, 'utf-8');

  it('classifies hedera manual metadata as cohort C', () => {
    expect(serverSource).toContain("metaString(md, 'source') === 'hedera-manual-verify'");
    expect(serverSource).toContain("metaBool(md, 'manuallyVerified')");
    expect(serverSource).toContain("repairCohort: 'C'");
    expect(serverSource).toContain("provider: 'hedera'");
  });
});

describe('Historical payment repair — cohort D (bank/crypto review)', () => {
  const serverSource = fs.readFileSync(REPAIR_CORE, 'utf-8');

  it('resolves bank-review and crypto-review provider refs', () => {
    expect(serverSource).toContain('bankReviewProviderRef');
    expect(serverSource).toContain('cryptoReviewProviderRef');
    expect(serverSource).toContain("repairCohort: 'D'");
    expect(serverSource).toContain('historical_assisted_review_backfill');
  });

  it('classifies assisted review refs on confirmed events', () => {
    expect(serverSource).toContain("srcRef.startsWith('bank-review:')");
    expect(serverSource).toContain("srcRef.startsWith('crypto-review:')");
  });
});

describe('Historical payment repair — cohort E (manual settlement)', () => {
  const serverSource = fs.readFileSync(REPAIR_CORE, 'utf-8');

  it('uses manualSettlementProviderRef for operator manual backfill', () => {
    expect(serverSource).toContain('manualSettlementProviderRef');
    expect(serverSource).toContain("repairCohort: 'E'");
    expect(serverSource).toContain("srcRef.startsWith('manual-settlement:')");
  });
});

describe('Historical payment repair — duplicate execution safety', () => {
  const serverSource = fs.readFileSync(REPAIR_CORE, 'utf-8');
  const reconcileSource = fs.readFileSync(COMMISSION_RECONCILE, 'utf-8');

  it('skips settlement when confirmed event exists before confirmPayment', () => {
    const fn = serverSource.split('export async function repairSettlementForLink')[1] ?? '';
    expect(fn).toContain('payment_confirmed_already_exists');
    expect(fn).toMatch(/hasConfirmed[\s\S]*return \{ success: true, skipped: true/);
  });

  it('delegates commission idempotency to R5 reconcile', () => {
    expect(serverSource).toContain('correlationId: `historical-repair-${paymentEventId}`');
    expect(reconcileSource).toContain('obligation_exists');
  });
});

describe('Historical payment repair — audit logging', () => {
  const serverSource = fs.readFileSync(REPAIR_CORE, 'utf-8');

  it('logs structured repair actions', () => {
    expect(serverSource).toContain("'historical_payment_repair_action'");
  });

  it('writes audit_logs on execute only', () => {
    expect(serverSource).toContain("action: 'HISTORICAL_PAYMENT_REPAIR'");
    expect(serverSource).toContain('if (params.dryRun) return');
    expect(serverSource).toContain('audit_logs.create');
  });
});

// --- Unit tests with mocks ---

const mockConfirmPayment = jest.fn();
const mockReconcile = jest.fn();
const mockDetectGaps = jest.fn();
const mockLogInfo = jest.fn();

jest.mock('@/lib/services/payment-confirmation', () => ({
  confirmPayment: (...args: unknown[]) => mockConfirmPayment(...args),
}));

jest.mock('@/lib/referrals/commission-reconcile.server', () => ({
  detectCommissionArtifactGaps: (...args: unknown[]) => mockDetectGaps(...args),
  reconcileCommissionArtifactsForPaymentEvent: (...args: unknown[]) => mockReconcile(...args),
}));

jest.mock('@/lib/logger', () => ({
  log: { info: (...args: unknown[]) => mockLogInfo(...args) },
}));

jest.mock('@/lib/server/prisma', () => ({
  prisma: {
    payment_links: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    payment_events: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    audit_logs: { create: jest.fn() },
  },
}));

jest.mock('@/lib/payments/assisted-review-settlement.server', () => ({
  bankReviewProviderRef: (id: string) => `bank-review:${id}`,
  cryptoReviewProviderRef: (id: string) => `crypto-review:${id}`,
}));

jest.mock('@/lib/payments/manual-invoice-settlement.server', () => ({
  manualSettlementProviderRef: (id: string) => `manual-settlement:${id}`,
}));

import { prisma } from '@/lib/server/prisma';
import {
  isPaidWithoutPaymentConfirmed,
  repairSettlementForLink,
  repairCommissionForPaymentEvent,
  runHistoricalPaymentRepair,
} from '@/lib/payments/historical-payment-repair.core';

const prismaMock = prisma as unknown as {
  payment_links: { findUnique: jest.Mock; findMany: jest.Mock };
  payment_events: { findFirst: jest.Mock; findUnique: jest.Mock; findMany: jest.Mock };
  audit_logs: { create: jest.Mock };
};

const LINK_ID = 'pl-hist-00000000-0000-0000-0000-000000000001';
const ORG_ID = 'org-hist-00000000-0000-0000-0000-000000000002';
const EVENT_ID = 'pe-hist-00000000-0000-0000-0000-000000000003';

beforeEach(() => {
  jest.clearAllMocks();
  mockConfirmPayment.mockResolvedValue({
    success: true,
    paymentEventId: EVENT_ID,
    alreadyProcessed: false,
  });
  mockReconcile.mockResolvedValue({
    status: 'repaired',
    gapsBefore: ['NO_COMMISSION_OBLIGATIONS_ROW'],
  });
  mockDetectGaps.mockResolvedValue(['NO_COMMISSION_OBLIGATIONS_ROW']);
  prismaMock.audit_logs.create.mockResolvedValue({ id: 'audit-1' });
});

describe('Historical payment repair — dry-run behavior (unit)', () => {
  it('does not call confirmPayment in dry-run settlement repair', async () => {
    prismaMock.payment_links.findUnique.mockResolvedValue({
      id: LINK_ID,
      organization_id: ORG_ID,
      status: 'PAID',
      amount: 100,
      invoice_currency: 'AUD',
      currency: 'AUD',
      payment_method: 'STRIPE',
      manual_bank_payment_confirmations: [],
      crypto_payment_confirmations: [],
    });
    prismaMock.payment_events.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    const out = await repairSettlementForLink(LINK_ID, {
      dryRun: true,
      cohort: 'A',
    });

    expect(out.success).toBe(true);
    expect(out.reason).toBe('dry_run');
    expect(mockConfirmPayment).not.toHaveBeenCalled();
    expect(prismaMock.audit_logs.create).not.toHaveBeenCalled();
    expect(mockLogInfo).toHaveBeenCalledWith(
      'historical_payment_repair_action',
      expect.objectContaining({ dryRun: true, action: 'settlement_confirm_payment' })
    );
  });

  it('passes dryRun to reconcileCommissionArtifactsForPaymentEvent', async () => {
    await repairCommissionForPaymentEvent(EVENT_ID, {
      dryRun: true,
      cohort: 'F',
      paymentLinkId: LINK_ID,
      organizationId: ORG_ID,
    });

    expect(mockReconcile).toHaveBeenCalledWith(
      EVENT_ID,
      expect.objectContaining({ dryRun: true, orchestrateFunding: true })
    );
    expect(prismaMock.audit_logs.create).not.toHaveBeenCalled();
  });
});

describe('Historical payment repair — PAID without PAYMENT_CONFIRMED (unit)', () => {
  it('isPaidWithoutPaymentConfirmed returns true when PAID and no event', async () => {
    prismaMock.payment_links.findUnique.mockResolvedValue({ status: 'PAID' });
    prismaMock.payment_events.findFirst.mockResolvedValue(null);

    await expect(isPaidWithoutPaymentConfirmed(LINK_ID)).resolves.toBe(true);
  });

  it('execute settlement calls confirmPayment once', async () => {
    prismaMock.payment_links.findUnique.mockResolvedValue({
      id: LINK_ID,
      organization_id: ORG_ID,
      status: 'PAID',
      amount: 50,
      invoice_currency: 'USD',
      currency: 'USD',
      payment_method: 'STRIPE',
      manual_bank_payment_confirmations: [],
      crypto_payment_confirmations: [],
    });
    prismaMock.payment_events.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    const out = await repairSettlementForLink(LINK_ID, {
      dryRun: false,
      cohort: 'A',
    });

    expect(out.success).toBe(true);
    expect(mockConfirmPayment).toHaveBeenCalledTimes(1);
    expect(mockConfirmPayment.mock.calls[0][0]).toMatchObject({
      paymentLinkId: LINK_ID,
      metadata: expect.objectContaining({ historicalRepair: true }),
    });
  });
});

describe('Historical payment repair — duplicate settlement skip (unit)', () => {
  it('skips confirmPayment when PAYMENT_CONFIRMED already exists', async () => {
    prismaMock.payment_links.findUnique.mockResolvedValue({
      id: LINK_ID,
      organization_id: ORG_ID,
      status: 'PAID',
    });
    prismaMock.payment_events.findFirst.mockResolvedValue({ id: EVENT_ID });

    const out = await repairSettlementForLink(LINK_ID, {
      dryRun: false,
      cohort: 'A',
    });

    expect(out.skipped).toBe(true);
    expect(out.reason).toBe('payment_confirmed_already_exists');
    expect(mockConfirmPayment).not.toHaveBeenCalled();
  });
});

describe('Historical payment repair — audit on execute (unit)', () => {
  it('writes audit_logs when not dry-run', async () => {
    prismaMock.payment_links.findUnique.mockResolvedValue({
      id: LINK_ID,
      organization_id: ORG_ID,
      status: 'PAID',
      amount: 10,
      invoice_currency: 'AUD',
      currency: 'AUD',
      payment_method: 'STRIPE',
      manual_bank_payment_confirmations: [],
      crypto_payment_confirmations: [],
    });
    prismaMock.payment_events.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    await repairSettlementForLink(LINK_ID, { dryRun: false, cohort: 'A' });

    expect(prismaMock.audit_logs.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'HISTORICAL_PAYMENT_REPAIR',
          entity_type: 'HistoricalPaymentRepair',
        }),
      })
    );
  });
});

describe('Historical payment repair — runHistoricalPaymentRepair default dry-run (unit)', () => {
  it('defaults dryRun true and does not increment settlementRepairs without execute', async () => {
    prismaMock.payment_links.findMany.mockResolvedValue([
      { id: LINK_ID, organization_id: ORG_ID, payment_method: 'STRIPE' },
    ]);
    prismaMock.payment_events.findMany.mockResolvedValue([]);

    prismaMock.payment_links.findUnique.mockResolvedValue({
      id: LINK_ID,
      organization_id: ORG_ID,
      status: 'PAID',
      amount: 100,
      invoice_currency: 'AUD',
      currency: 'AUD',
      payment_method: 'STRIPE',
      manual_bank_payment_confirmations: [],
      crypto_payment_confirmations: [],
    });
    prismaMock.payment_events.findFirst.mockResolvedValue(null);

    const result = await runHistoricalPaymentRepair({ limit: 5 });

    expect(result.dryRun).toBe(true);
    expect(result.summary.settlementRepairs).toBe(0);
    expect(mockConfirmPayment).not.toHaveBeenCalled();
  });
});
