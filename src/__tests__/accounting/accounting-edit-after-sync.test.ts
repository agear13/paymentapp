import {
  buildAccountingSyncSnapshot,
  detectAccountingSyncDrift,
  hasAccountingContentDrift,
  parseAccountingSyncSnapshot,
} from '@/lib/accounting/accounting-sync-snapshot';
import {
  fieldsRequiringResync,
  policyRequiresAccountingResync,
  ACCOUNTING_EDIT_FIELD_POLICY,
} from '@/lib/accounting/accounting-edit-policy';
import {
  resolveAccountingPushState,
  resolveAccountingSyncDisplayStatus,
  accountingSyncDisplayLabel,
} from '@/lib/accounting/accounting-push-state';

const baseLink = {
  amount: 100,
  invoiceCurrency: 'AUD',
  currency: 'AUD',
  description: 'Consulting services',
  customerEmail: 'client@example.com',
  customerName: 'Acme Co',
  invoiceReference: 'INV-100',
  invoiceDate: '2026-01-01',
  dueDate: '2026-01-31',
};

describe('accounting edit after sync audit', () => {
  describe('field policy', () => {
    it('marks accounting-exported fields as requiring manual resync', () => {
      expect(policyRequiresAccountingResync('amount')).toBe(true);
      expect(policyRequiresAccountingResync('customerName')).toBe(true);
      expect(policyRequiresAccountingResync('dueDate')).toBe(true);
      expect(policyRequiresAccountingResync('tax')).toBe(false);
      expect(policyRequiresAccountingResync('paymentMethod')).toBe(false);
      expect(policyRequiresAccountingResync('status')).toBe(false);
    });

    it('documents policy for each editable field group', () => {
      expect(ACCOUNTING_EDIT_FIELD_POLICY.amount.policy).toBe('manual_resync');
      expect(ACCOUNTING_EDIT_FIELD_POLICY.description.policy).toBe('update_accounting');
      expect(ACCOUNTING_EDIT_FIELD_POLICY.tax.policy).toBe('locked');
      expect(ACCOUNTING_EDIT_FIELD_POLICY.paymentMethod.policy).toBe('provvy_only');
    });
  });

  describe('edit before sync', () => {
    it('shows push state when invoice has never been exported', () => {
      const state = resolveAccountingPushState({
        invoiceSync: null,
        linkUpdatedAt: new Date(),
        link: baseLink,
      });
      expect(state.state).toBe('push');
      expect(state.hasLocalChanges).toBe(false);
      expect(resolveAccountingSyncDisplayStatus(state)).toBe('not_synced');
    });
  });

  describe('edit after sync', () => {
    const snapshot = buildAccountingSyncSnapshot(baseLink);
    const exportedSync = {
      syncType: 'INVOICE',
      status: 'SUCCESS',
      xeroInvoiceId: 'xero-inv-1',
      updatedAt: '2026-01-10T12:00:00.000Z',
      accountingSnapshot: snapshot,
    };

    it('shows synced when content matches snapshot', () => {
      const state = resolveAccountingPushState({
        invoiceSync: exportedSync,
        linkUpdatedAt: '2026-01-10T12:00:00.000Z',
        link: baseLink,
      });
      expect(state.state).toBe('already_synced');
      expect(accountingSyncDisplayLabel(resolveAccountingSyncDisplayStatus(state))).toBe('Synced');
    });

    it('detects local changes when amount is edited after sync', () => {
      const editedLink = { ...baseLink, amount: 150 };
      const drift = detectAccountingSyncDrift(
        buildAccountingSyncSnapshot(editedLink),
        snapshot
      );
      expect(drift.hasDrift).toBe(true);
      expect(drift.changedFields).toContain('amount');

      const state = resolveAccountingPushState({
        invoiceSync: exportedSync,
        linkUpdatedAt: '2026-01-12T09:00:00.000Z',
        link: editedLink,
      });
      expect(state.state).toBe('update');
      expect(state.hasLocalChanges).toBe(true);
      expect(accountingSyncDisplayLabel(resolveAccountingSyncDisplayStatus(state))).toBe(
        'Local changes not synced'
      );
    });

    it('detects multiple field changes', () => {
      const editedLink = {
        ...baseLink,
        description: 'Updated scope',
        dueDate: '2026-02-15',
      };
      const drift = detectAccountingSyncDrift(
        buildAccountingSyncSnapshot(editedLink),
        snapshot
      );
      expect(drift.changedFields).toEqual(
        expect.arrayContaining(['description', 'dueDate'])
      );
      expect(fieldsRequiringResync(drift.changedFields).length).toBeGreaterThan(0);
    });
  });

  describe('update accounting flow', () => {
    it('parses stored snapshot from sync response payload', () => {
      const snapshot = buildAccountingSyncSnapshot(baseLink);
      const parsed = parseAccountingSyncSnapshot({ accountingSnapshot: snapshot });
      expect(parsed?.amount).toBe('100.00');
      expect(parsed?.description).toBe('Consulting services');
    });

    it('legacy sync rows without snapshot fall back to updated_at drift', () => {
      const drift = hasAccountingContentDrift(
        baseLink,
        null,
        '2026-01-12T09:00:00.000Z',
        '2026-01-10T12:00:00.000Z'
      );
      expect(drift.hasDrift).toBe(true);
    });
  });

  describe('update failure and retry', () => {
    it('failed sync remains push/retry eligible without creating duplicates', () => {
      const state = resolveAccountingPushState({
        invoiceSync: {
          syncType: 'INVOICE',
          status: 'FAILED',
          xeroInvoiceId: null,
        },
        link: baseLink,
      });
      expect(state.state).toBe('sync_failed');
      expect(resolveAccountingSyncDisplayStatus(state)).toBe('sync_failed');
    });

    it('pending update shows sync in progress', () => {
      const state = resolveAccountingPushState({
        invoiceSync: {
          syncType: 'INVOICE',
          status: 'PENDING',
          xeroInvoiceId: 'xero-inv-1',
        },
        link: { ...baseLink, amount: 150 },
      });
      expect(state.state).toBe('sync_pending');
    });
  });

  describe('UI and API guards', () => {
    it('edit dialog warns when invoice is accounting-synced', () => {
      const fs = require('fs');
      const path = require('path');
      const source = fs.readFileSync(
        path.join(__dirname, '..', '..', 'components', 'payment-links', 'create-payment-link-dialog.tsx'),
        'utf8'
      );
      expect(source).toContain('isAccountingSynced');
      expect(source).toContain('editSyncedInvoiceWarningTitle');
    });

    it('PATCH route returns accounting impact without auto-syncing', () => {
      const fs = require('fs');
      const path = require('path');
      const source = fs.readFileSync(
        path.join(__dirname, '..', '..', 'app', 'api', 'payment-links', '[id]', 'route.ts'),
        'utf8'
      );
      expect(source).toContain('accountingImpact');
      expect(source).not.toContain('queueXeroSync');
      expect(source).not.toContain('queueXeroInvoiceUpdate');
    });

    it('orchestration stores accounting snapshot on successful export', () => {
      const fs = require('fs');
      const path = require('path');
      const source = fs.readFileSync(
        path.join(__dirname, '..', '..', 'lib', 'xero', 'sync-orchestration.ts'),
        'utf8'
      );
      expect(source).toContain('accountingSnapshot');
      expect(source).toContain('updateXeroInvoice');
    });
  });
});
