const fs = require('fs');
const path = require('path');

const {
  buildPaidTransitionBlockedPayload,
  getStatusApiAllowedNextStates,
  isStatusBlockedViaStatusApi,
  PAID_TRANSITION_BLOCKED_CODE,
  STATUSES_BLOCKED_VIA_STATUS_API,
} = require('../../lib/payments/payment-link-status-api-policy');

const STATUS_ROUTE_PATH = path.join(
  __dirname,
  '..',
  '..',
  'app',
  'api',
  'payment-links',
  '[id]',
  'status',
  'route.ts'
);

const CONFIRM_PAYMENT_PATH = path.join(
  __dirname,
  '..',
  '..',
  'lib',
  'services',
  'payment-confirmation.ts'
);

describe('payment-link-status-api-policy (R2)', () => {
  it('blocks only PAID via status API', () => {
    expect(STATUSES_BLOCKED_VIA_STATUS_API.has('PAID')).toBe(true);
    expect(isStatusBlockedViaStatusApi('PAID')).toBe(true);
    expect(isStatusBlockedViaStatusApi('OPEN')).toBe(false);
    expect(isStatusBlockedViaStatusApi('PAID_UNVERIFIED')).toBe(false);
    expect(isStatusBlockedViaStatusApi('EXPIRED')).toBe(false);
  });

  it('excludes PAID from allowed next states for OPEN', () => {
    const allowed = getStatusApiAllowedNextStates('OPEN');
    expect(allowed).not.toContain('PAID');
    expect(allowed).toContain('PAID_UNVERIFIED');
    expect(allowed).toContain('REQUIRES_REVIEW');
    expect(allowed).toContain('EXPIRED');
    expect(allowed).toContain('CANCELED');
  });

  it('excludes PAID from allowed next states for PAID_UNVERIFIED and REQUIRES_REVIEW', () => {
    expect(getStatusApiAllowedNextStates('PAID_UNVERIFIED')).not.toContain('PAID');
    expect(getStatusApiAllowedNextStates('PAID_UNVERIFIED')).toContain('OPEN');
    expect(getStatusApiAllowedNextStates('REQUIRES_REVIEW')).not.toContain('PAID');
  });

  it('buildPaidTransitionBlockedPayload includes code and canonical guidance', () => {
    const payload = buildPaidTransitionBlockedPayload('OPEN');
    expect(payload.code).toBe(PAID_TRANSITION_BLOCKED_CODE);
    expect(payload.attemptedTransition).toEqual({ from: 'OPEN', to: 'PAID' });
    expect(payload.validTransitions).not.toContain('PAID');
    expect(payload.canonicalSettlement.automatedRails.some((s) => s.includes('confirmPayment'))).toBe(
      true
    );
    expect(
      payload.canonicalSettlement.operatorFlows.some((s) => s.includes('manual-settlement'))
    ).toBe(true);
  });
});

describe('payment-link status route (R2 integration)', () => {
  const routeSource = fs.readFileSync(STATUS_ROUTE_PATH, 'utf-8');

  it('POST handler rejects PAID via status API policy before transition', () => {
    expect(routeSource).toContain('isStatusBlockedViaStatusApi(newStatus)');
    expect(routeSource).toContain('buildPaidTransitionBlockedPayload');
    expect(routeSource).toContain('STATUS_TRANSITION_BLOCKED');
    expect(routeSource).toContain('status: 409');
    expect(routeSource).toContain('payment_link_status_api_paid_blocked');
  });

  it('GET handler exposes status-api allowed transitions without PAID', () => {
    expect(routeSource).toContain('getStatusApiAllowedNextStates(currentStatus)');
  });

  it('confirmPayment remains unchanged by R2', () => {
    const confirmSource = fs.readFileSync(CONFIRM_PAYMENT_PATH, 'utf-8');
    expect(confirmSource).toContain("targetState: 'PAID'");
    expect(confirmSource).toContain('export async function confirmPayment');
  });
});
