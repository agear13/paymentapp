import {
  buildPayoutTimeline,
  presentPayoutStatus,
  publicFailedReason,
} from '@/lib/payouts/payout-status-presentation';

describe('payout status presentation', () => {
  it('maps canonical states to user-facing labels without adding statuses', () => {
    expect(presentPayoutStatus({ status: 'DRAFT' }).label).toBe('Draft');
    expect(presentPayoutStatus({ status: 'SUBMITTED' }).label).toBe('Submitted');
    expect(presentPayoutStatus({ status: 'PROCESSING' }).label).toBe('Processing');
    expect(presentPayoutStatus({ status: 'PROCESSING', railId: 'cregis' }).label).toBe(
      'Processing · awaiting authorization'
    );
    expect(presentPayoutStatus({ status: 'PROCESSING', railId: 'cregis' }).code).toBe('PROCESSING');
    expect(presentPayoutStatus({ status: 'PAID' }).label).toBe('Paid');
    expect(presentPayoutStatus({ status: 'FAILED' }).label).toBe('Failed');
  });

  it('scrubs sensitive failed reasons', () => {
    expect(publicFailedReason('Cregis api_key rejected')).toMatch(/activity log/i);
    expect(publicFailedReason('Invalid destination address')).toBe('Invalid destination address');
  });

  it('builds a created → rail → submitted → processing → paid timeline', () => {
    const timeline = buildPayoutTimeline({
      status: 'PROCESSING',
      railId: 'cregis',
      createdAt: '2026-09-09T00:00:00.000Z',
    });
    expect(timeline.map((step) => step.id)).toEqual([
      'created',
      'rail',
      'submitted',
      'processing',
      'terminal',
    ]);
    expect(timeline.find((step) => step.id === 'processing')?.label).toBe(
      'Processing · awaiting authorization'
    );
    expect(timeline.find((step) => step.id === 'processing')?.state).toBe('current');
    expect(timeline.find((step) => step.id === 'terminal')?.state).toBe('upcoming');
  });

  it('shows a public failure explanation on the terminal step', () => {
    const timeline = buildPayoutTimeline({
      status: 'FAILED',
      railId: 'manual',
      failedReason: 'Invalid destination address',
    });
    expect(timeline.find((step) => step.id === 'terminal')).toMatchObject({
      label: 'Failed',
      state: 'current',
      detail: 'Invalid destination address',
    });
  });
});
