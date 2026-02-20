/**
 * Wise status mapping – map Wise API statuses to internal PENDING | PAID | FAILED
 */
import { mapWiseStatusToInternal } from '@/lib/wise/status-mapping';

describe('mapWiseStatusToInternal', () => {
  it('maps created/pending to PENDING', () => {
    expect(mapWiseStatusToInternal('created')).toBe('PENDING');
    expect(mapWiseStatusToInternal('pending')).toBe('PENDING');
    expect(mapWiseStatusToInternal('incoming_payment_waiting')).toBe('PENDING');
    expect(mapWiseStatusToInternal('processing')).toBe('PENDING');
    expect(mapWiseStatusToInternal('')).toBe('PENDING');
    expect(mapWiseStatusToInternal(null)).toBe('PENDING');
    expect(mapWiseStatusToInternal(undefined)).toBe('PENDING');
  });

  it('maps funded/paid/completed to PAID', () => {
    expect(mapWiseStatusToInternal('funded')).toBe('PAID');
    expect(mapWiseStatusToInternal('paid')).toBe('PAID');
    expect(mapWiseStatusToInternal('completed')).toBe('PAID');
    expect(mapWiseStatusToInternal('outgoing_payment_sent')).toBe('PAID');
    expect(mapWiseStatusToInternal('credited')).toBe('PAID');
    expect(mapWiseStatusToInternal('delivered')).toBe('PAID');
  });

  it('maps cancelled/failed/rejected to FAILED', () => {
    expect(mapWiseStatusToInternal('cancelled')).toBe('FAILED');
    expect(mapWiseStatusToInternal('failed')).toBe('FAILED');
    expect(mapWiseStatusToInternal('rejected')).toBe('FAILED');
    expect(mapWiseStatusToInternal('refunded')).toBe('FAILED');
    expect(mapWiseStatusToInternal('expired')).toBe('FAILED');
  });

  it('is case insensitive', () => {
    expect(mapWiseStatusToInternal('PAID')).toBe('PAID');
    expect(mapWiseStatusToInternal('Cancelled')).toBe('FAILED');
    expect(mapWiseStatusToInternal('  funded  ')).toBe('PAID');
  });
});
