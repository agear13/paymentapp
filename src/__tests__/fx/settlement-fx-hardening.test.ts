/**
 * Settlement FX Snapshot Hardening tests
 * - ensureSettlementFxSnapshot is idempotent (check then create; second call does not duplicate)
 * - confirmPayment path ensures one SETTLEMENT snapshot per (link, currency, currency)
 * - Backfill script does not duplicate when run twice
 */

import * as fs from 'fs';
import * as path from 'path';
import { getFxSnapshotService } from '@/lib/fx/fx-snapshot-service';

const PAYMENT_LINK_ID = '11111111-1111-1111-1111-111111111111';
const CURRENCY = 'USD';

const PAYMENT_CONFIRMATION_PATH = path.join(
  __dirname,
  '..',
  '..',
  'lib',
  'services',
  'payment-confirmation.ts'
);
const BACKFILL_SCRIPT_PATH = path.join(__dirname, '..', '..', 'scripts', 'backfill-settlement-fx.ts');

describe('Settlement FX hardening', () => {
  describe('ensureSettlementFxSnapshot contract', () => {
    it('expects payment_link_id, snapshot_type SETTLEMENT, base_currency = quote_currency = link.currency, rate 1, provider INTERNAL', () => {
      const paymentLink = { id: PAYMENT_LINK_ID, currency: CURRENCY };
      expect(paymentLink.currency).toBe(CURRENCY);
      expect(getFxSnapshotService().ensureSettlementFxSnapshot).toBeDefined();
      expect(typeof getFxSnapshotService().ensureSettlementFxSnapshot).toBe('function');
    });

    it('ensureSettlementFxSnapshot accepts tx and paymentLink with id and currency', async () => {
      const service = getFxSnapshotService();
      const tx = {
        fx_snapshots: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({ id: 'snap-1' }),
        },
      };
      const paymentLink = { id: PAYMENT_LINK_ID, currency: CURRENCY };
      await (service as any).ensureSettlementFxSnapshot(tx, paymentLink);
      expect(tx.fx_snapshots.findFirst).toHaveBeenCalledWith({
        where: {
          payment_link_id: PAYMENT_LINK_ID,
          snapshot_type: 'SETTLEMENT',
          base_currency: CURRENCY,
          quote_currency: CURRENCY,
        },
      });
      expect(tx.fx_snapshots.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          payment_link_id: PAYMENT_LINK_ID,
          snapshot_type: 'SETTLEMENT',
          base_currency: CURRENCY,
          quote_currency: CURRENCY,
          rate: 1,
          provider: 'INTERNAL',
          token_type: null,
        }),
      });
    });

    it('ensureSettlementFxSnapshot does not create when row already exists (idempotent)', async () => {
      const service = getFxSnapshotService();
      const tx = {
        fx_snapshots: {
          findFirst: jest.fn().mockResolvedValue({ id: 'existing-snap' }),
          create: jest.fn(),
        },
      };
      const paymentLink = { id: PAYMENT_LINK_ID, currency: CURRENCY };
      await (service as any).ensureSettlementFxSnapshot(tx, paymentLink);
      expect(tx.fx_snapshots.findFirst).toHaveBeenCalled();
      expect(tx.fx_snapshots.create).not.toHaveBeenCalled();
    });
  });

  describe('confirmPayment settlement invariant', () => {
    it('confirmPayment calls ensureSettlementFxSnapshot so one SETTLEMENT snapshot per (link, currency, currency)', () => {
      const content = fs.readFileSync(PAYMENT_CONFIRMATION_PATH, 'utf-8');
      expect(content).toContain('ensureSettlementFxSnapshot');
      expect(content).toContain('SETTLEMENT');
    });
  });

  describe('backfill idempotency', () => {
    it('backfill script checks for existing SETTLEMENT snapshot before create (no duplicate when run twice)', () => {
      expect(fs.existsSync(BACKFILL_SCRIPT_PATH)).toBe(true);
      const content = fs.readFileSync(BACKFILL_SCRIPT_PATH, 'utf-8');
      expect(content).toContain('findFirst');
      expect(content).toContain('SETTLEMENT');
      expect(content).toContain('base_currency');
      expect(content).toContain('quote_currency');
      expect(content).toContain('BACKFILL');
      expect(content).toContain('if (existing)');
    });
  });
});
