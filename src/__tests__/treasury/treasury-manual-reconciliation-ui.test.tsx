/** @jest-environment jsdom */

import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TreasuryManualReconciliationDialog } from '@/components/journey/lovable/treasury-manual-reconciliation-dialog';
import { TreasuryManualReconciliationPanel } from '@/components/journey/lovable/treasury-manual-reconciliation-panel';
import type { ManualReconciliationReviewItem } from '@/lib/treasury/reconciliation/manual-link-review';

const ORG = 'org-001';
const SOURCE_ID = '11111111-1111-1111-1111-111111111111';
const TARGET_ID = '22222222-2222-2222-2222-222222222222';

const reviewItem: ManualReconciliationReviewItem = {
  reviewId: 'review-1',
  paymentLinkId: 'link-1',
  invoiceReference: 'INV-00485',
  chainStatus: 'AWAITING_EXCHANGE_IDENTIFICATION',
  exception: {
    type: 'wallet_without_exchange',
    severity: 'UNKNOWN',
    observed: 'Wallet transfer without matching exchange deposit',
    expected: 'Digital Surge deposit with matching transaction hash or provider ID',
    reason: 'No exchange deposit correlated to this wallet movement',
    suggestedAction: 'Sync Digital Surge or wait for deposit confirmation',
    relatedEventIds: [SOURCE_ID],
    paymentLinkId: 'link-1',
  },
  sourceEvent: {
    id: SOURCE_ID,
    eventType: 'WALLET_TRANSFER',
    status: 'CONFIRMED',
    asset: 'USDC',
    destinationAsset: null,
    amount: '-1500',
    destinationAmount: null,
    provider: 'blockchain',
    occurredAt: '2026-08-02T10:00:00.000Z',
    transactionHash: '0xoutbound',
    providerReference: 'wt:1',
    destinationAddress: '0xDS',
    sourceAddress: '0xMerchant',
    invoiceReference: 'INV-00485',
    paymentLinkId: 'link-1',
    existingEvidence: null,
    manualReconciliation: null,
  },
  candidateTargetEvents: [
    {
      id: TARGET_ID,
      eventType: 'EXCHANGE_DEPOSIT',
      status: 'UNKNOWN',
      asset: 'USDC',
      destinationAsset: null,
      amount: '1500',
      destinationAmount: null,
      provider: 'digital_surge',
      occurredAt: '2026-08-03T10:00:00.000Z',
      transactionHash: '0xoutbound',
      providerReference: 'ds:501:601',
      destinationAddress: null,
      sourceAddress: null,
      invoiceReference: null,
      paymentLinkId: null,
      existingEvidence: null,
      manualReconciliation: null,
    },
  ],
  autoLinkFailureReason: 'No exchange deposit correlated to this wallet movement',
};

describe('Treasury manual reconciliation UI', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  it('displays exception context and candidate event details', () => {
    render(
      <TreasuryManualReconciliationDialog
        organizationId={ORG}
        item={reviewItem}
        open
        onOpenChange={jest.fn()}
        onLinked={jest.fn()}
      />
    );

    expect(screen.getByText(/Wallet transfer without matching exchange deposit/i)).toBeInTheDocument();
    expect(screen.getByText(/Why automatic reconciliation failed/i)).toBeInTheDocument();
    expect(screen.getByText(/Source event/i)).toBeInTheDocument();
    expect(screen.getByText(/Target event/i)).toBeInTheDocument();
    expect(screen.getAllByText('0xoutbound').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/digital surge/i).length).toBeGreaterThan(0);
  });

  it('requires explicit confirmation before submitting manual link', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        linkId: 'link-row',
        auditId: 'audit-1',
        manualReconciliation: {
          linkId: 'link-row',
          auditId: 'audit-1',
          linkedAt: '2026-08-16T10:00:00.000Z',
          linkedByUserId: 'user-1',
          notes: 'Confirmed by merchant',
          linkStatus: 'INFERRED',
          manual: true,
          sourceEventId: SOURCE_ID,
          targetEventId: TARGET_ID,
        },
      }),
    });

    render(
      <TreasuryManualReconciliationDialog
        organizationId={ORG}
        item={reviewItem}
        open
        onOpenChange={jest.fn()}
        onLinked={jest.fn()}
      />
    );

    const submit = screen.getByRole('button', { name: /Confirm manual link/i });
    expect(submit).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText(/Why you are linking/i), {
      target: { value: 'Confirmed by merchant' },
    });
    fireEvent.click(screen.getByRole('checkbox'));

    expect(submit).not.toBeDisabled();
    fireEvent.click(submit);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/treasury/manual-link'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"confirmLink":true'),
        })
      );
    });
  });

  it('shows manually reconciled outcome with user and note', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        manualReconciliation: {
          linkedAt: '2026-08-16T10:00:00.000Z',
          linkedByUserId: 'user-merchant-1',
          notes: 'Confirmed deposit for INV-00485',
          linkStatus: 'INFERRED',
          manual: true,
        },
      }),
    });

    render(
      <TreasuryManualReconciliationDialog
        organizationId={ORG}
        item={reviewItem}
        open
        onOpenChange={jest.fn()}
        onLinked={jest.fn()}
      />
    );

    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.change(screen.getByPlaceholderText(/Why you are linking/i), {
      target: { value: 'Confirmed deposit for INV-00485' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Confirm manual link/i }));

    expect(await screen.findByText(/Manually reconciled/i)).toBeInTheDocument();
    expect(screen.getByText(/user-merchant-1/i)).toBeInTheDocument();
    expect(screen.getByText(/Confirmed deposit for INV-00485/i)).toBeInTheDocument();
    expect(screen.getByText(/Manual evidence preserved/i)).toBeInTheDocument();
  });

  it('opens manual-link flow from needs review panel', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ items: [reviewItem] }),
    });

    render(
      <TreasuryManualReconciliationPanel organizationId={ORG} visible onLinked={jest.fn()} />
    );

    expect(await screen.findByText(/Needs manual reconciliation/i)).toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: /Review & link/i }));
    expect(screen.getByText(/Review & link treasury events/i)).toBeInTheDocument();
  });
});
