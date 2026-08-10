/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';

import { AccountingSyncedInvoiceRemovalDialog } from '@/components/journey/lovable/accounting-synced-invoice-removal-dialog';
import { AccountingActivityTimeline } from '@/components/journey/lovable/accounting-activity-timeline';
import { ACCOUNTING_INTEGRATION_COPY } from '@/lib/accounting/accounting-integration-copy';
import {
  buildAccountingActivityTimeline,
  formatAccountingActivityDate,
} from '@/lib/accounting/accounting-activity-timeline';
import {
  archiveInvoiceConsequenceFlow,
  shouldShowPaidVoidWarning,
  voidInvoiceConsequenceFlow,
} from '@/lib/accounting/accounting-removal-ux';

describe('synced invoice removal UX copy', () => {
  it('includes decision-focused intro text', () => {
    expect(ACCOUNTING_INTEGRATION_COPY.syncedInvoiceRemovalIntro).toContain(
      "Choose how you'd like to handle this invoice."
    );
    expect(ACCOUNTING_INTEGRATION_COPY.syncedInvoiceRemovalIntro).toContain(
      'Provvy is your commercial system of record'
    );
  });

  it('documents void option with Xero-specific guidance', () => {
    expect(ACCOUNTING_INTEGRATION_COPY.voidInvoiceLead).toContain('Xero');
    expect(ACCOUNTING_INTEGRATION_COPY.voidInvoiceBenefits).toHaveLength(3);
    expect(ACCOUNTING_INTEGRATION_COPY.voidInvoiceBenefits[0]).toMatch(
      /active commercial workflows/i
    );
  });

  it('documents archive option with operational guidance', () => {
    expect(ACCOUNTING_INTEGRATION_COPY.archiveInvoiceLead).toContain('unchanged');
    expect(ACCOUNTING_INTEGRATION_COPY.archiveInvoiceBenefits).toHaveLength(3);
    expect(ACCOUNTING_INTEGRATION_COPY.archiveInvoiceBenefits[1]).toMatch(
      /accounting remains unchanged/i
    );
  });

  it('defines polished success toast messages', () => {
    expect(ACCOUNTING_INTEGRATION_COPY.voidSuccessToastTitle).toBe('Invoice void requested.');
    expect(ACCOUNTING_INTEGRATION_COPY.voidSuccessToastBody).toContain('update Xero');
    expect(ACCOUNTING_INTEGRATION_COPY.archiveSuccessToastTitle).toBe('Invoice archived.');
    expect(ACCOUNTING_INTEGRATION_COPY.archiveSuccessToastBody).toContain('not been changed');
  });
});

describe('accounting consequence summaries', () => {
  it('describes void flow across Provvy and accounting', () => {
    const flow = voidInvoiceConsequenceFlow();
    expect(flow.steps).toEqual([
      { label: 'Provvy', value: 'Cancelled' },
      { label: 'Accounting', value: 'Voided' },
    ]);
    expect(flow.footer).toBe('Commercial history retained');
  });

  it('describes archive flow without accounting changes', () => {
    const flow = archiveInvoiceConsequenceFlow();
    expect(flow.steps).toEqual([
      { label: 'Provvy', value: 'Archived' },
      { label: 'Accounting', value: 'No changes' },
    ]);
  });
});

describe('paid invoice warning helpers', () => {
  it('shows warning for paid status', () => {
    expect(shouldShowPaidVoidWarning({ status: 'PAID', xeroSyncs: [] })).toBe(true);
  });

  it('shows warning when payment sync succeeded on an open invoice', () => {
    expect(
      shouldShowPaidVoidWarning({
        status: 'OPEN',
        xeroSyncs: [{ syncType: 'PAYMENT', status: 'SUCCESS' }],
      })
    ).toBe(true);
  });

  it('does not show warning for unsynced open invoices', () => {
    expect(
      shouldShowPaidVoidWarning({
        status: 'OPEN',
        xeroSyncs: [{ syncType: 'INVOICE', status: 'SUCCESS' }],
      })
    ).toBe(false);
  });
});

describe('accounting activity timeline', () => {
  it('returns empty when no sync records exist', () => {
    expect(buildAccountingActivityTimeline([])).toEqual([]);
  });

  it('builds exported, updated, and voided events from existing sync history', () => {
    const events = buildAccountingActivityTimeline([
      {
        syncType: 'INVOICE',
        status: 'SUCCESS',
        xeroInvoiceId: 'xero-1',
        createdAt: '2026-08-10T00:00:00.000Z',
        updatedAt: '2026-08-12T00:00:00.000Z',
        lastRequestWasUpdate: true,
        voidedAt: '2026-08-15T00:00:00.000Z',
      },
    ]);

    expect(events.map((e) => e.label)).toEqual([
      'Exported to Xero',
      'Updated',
      'Voided',
    ]);
    expect(formatAccountingActivityDate(events[0].occurredAt)).toBe('10 Aug 2026');
  });

  it('renders empty state in the timeline component', () => {
    render(<AccountingActivityTimeline syncs={[]} />);
    expect(screen.getByText('Accounting Activity')).toBeInTheDocument();
    expect(screen.getByText('No accounting activity yet.')).toBeInTheDocument();
  });

  it('renders timeline events in the component', () => {
    render(
      <AccountingActivityTimeline
        syncs={[
          {
            syncType: 'INVOICE',
            status: 'SUCCESS',
            xeroInvoiceId: 'xero-1',
            createdAt: '2026-08-10T00:00:00.000Z',
            updatedAt: '2026-08-10T00:00:00.000Z',
          },
        ]}
      />
    );
    expect(screen.getByText('Exported to Xero')).toBeInTheDocument();
    expect(screen.getByText('10 Aug 2026')).toBeInTheDocument();
  });
});

describe('AccountingSyncedInvoiceRemovalDialog', () => {
  it('renders void and archive explanations with action buttons', () => {
    render(
      <AccountingSyncedInvoiceRemovalDialog
        open
        onOpenChange={() => {}}
        status="OPEN"
        invoiceSync={{
          syncType: 'INVOICE',
          status: 'SUCCESS',
          xeroInvoiceId: 'xero-1',
        }}
        xeroSyncs={[{ syncType: 'INVOICE', status: 'SUCCESS' }]}
        onVoid={jest.fn()}
        onArchive={jest.fn()}
      />
    );

    expect(
      screen.getByText(ACCOUNTING_INTEGRATION_COPY.syncedInvoiceRemovalTitle)
    ).toBeInTheDocument();
    expect(screen.getByText(/Choose how you'd like to handle this invoice/i)).toBeInTheDocument();
    expect(screen.getByText(/void the corresponding invoice in Xero/i)).toBeInTheDocument();
    expect(screen.getByText(/accounting record unchanged/i)).toBeInTheDocument();
    expect(screen.getByText('Cancelled')).toBeInTheDocument();
    expect(screen.getByText('No changes')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Void Invoice' }).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Archive Invoice' })).toBeInTheDocument();
  });

  it('shows paid void warning when void is allowed and payment exists', () => {
    render(
      <AccountingSyncedInvoiceRemovalDialog
        open
        onOpenChange={() => {}}
        status="PAID_UNVERIFIED"
        invoiceSync={{
          syncType: 'INVOICE',
          status: 'SUCCESS',
          xeroInvoiceId: 'xero-1',
        }}
        xeroSyncs={[
          { syncType: 'INVOICE', status: 'SUCCESS' },
          { syncType: 'PAYMENT', status: 'SUCCESS' },
        ]}
        onVoid={jest.fn()}
        onArchive={jest.fn()}
      />
    );

    expect(
      screen.getByText(ACCOUNTING_INTEGRATION_COPY.paidInvoiceVoidWarningTitle)
    ).toBeInTheDocument();
    expect(
      screen.getByText(ACCOUNTING_INTEGRATION_COPY.paidInvoiceVoidWarningBody)
    ).toBeInTheDocument();
  });

  it('shows no-actions message for paid synced invoices', () => {
    render(
      <AccountingSyncedInvoiceRemovalDialog
        open
        onOpenChange={() => {}}
        status="PAID"
        invoiceSync={{
          syncType: 'INVOICE',
          status: 'SUCCESS',
          xeroInvoiceId: 'xero-1',
        }}
        xeroSyncs={[{ syncType: 'INVOICE', status: 'SUCCESS' }]}
        onVoid={jest.fn()}
        onArchive={jest.fn()}
      />
    );

    expect(
      screen.getByText(ACCOUNTING_INTEGRATION_COPY.syncedInvoiceRemovalNoActions)
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Void Invoice' })).not.toBeInTheDocument();
  });
});
