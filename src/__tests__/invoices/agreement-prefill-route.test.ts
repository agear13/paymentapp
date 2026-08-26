import { NextRequest } from 'next/server';
import { GET } from '@/app/api/invoices/agreement-prefill/route';

jest.mock('@/lib/auth/session', () => ({
  getCurrentUser: jest.fn(),
}));

jest.mock('@/lib/invoices/agreement-invoice-prefill.server', () => ({
  loadAuthorizedAgreementInvoicePrefill: jest.fn(),
}));

import { getCurrentUser } from '@/lib/auth/session';
import { loadAuthorizedAgreementInvoicePrefill } from '@/lib/invoices/agreement-invoice-prefill.server';

const mockGetCurrentUser = getCurrentUser as jest.Mock;
const mockLoad = loadAuthorizedAgreementInvoicePrefill as jest.Mock;

const SARAH_PREFILL = {
  origin: 'participant_portal',
  compensationKind: 'fixed',
  amount: 6000,
  currency: 'AUD',
  customerName: 'Apex Promotions Pty Ltd',
  description: 'Producer fee — Saturday Beach Event',
  projectName: 'Saturday Beach Event',
  agreementReference: 'aiwf-saturday-beach',
  dueDate: undefined,
  paymentTimingNote: 'Payment timing not specified in agreement',
  timingUnresolved: true,
  originParticipantId: 'p-sarah-1',
  originDealId: 'aiwf-saturday-beach',
  originSourceOrganizationId: 'org-organiser',
};

function request(search = 'sourceParticipantId=p-sarah-1') {
  return new NextRequest(`http://localhost/api/invoices/agreement-prefill?${search}`);
}

describe('GET /api/invoices/agreement-prefill', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue({ id: 'user-sarah', email: 'sarah@example.com' });
    mockLoad.mockResolvedValue({ kind: 'ok', prefill: SARAH_PREFILL });
  });

  it('requires an authenticated session', async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const response = await GET(request());
    expect(response.status).toBe(401);
    expect(mockLoad).not.toHaveBeenCalled();
    const json = (await response.json()) as { error?: string };
    expect(JSON.stringify(json)).not.toContain('6000');
  });

  it('does not trust amount or agreement facts supplied in the URL', async () => {
    const response = await GET(
      request('sourceParticipantId=p-sarah-1&amount=12500&customerName=Wrong')
    );
    expect(response.status).toBe(200);
    expect(mockLoad).toHaveBeenCalledWith({
      user: { id: 'user-sarah', email: 'sarah@example.com' },
      sourceParticipantId: 'p-sarah-1',
    });
    const json = (await response.json()) as { prefill: { amount?: number } };
    expect(json.prefill.amount).toBe(6000);
    expect(json.prefill.amount).not.toBe(12500);
  });

  it('returns 404 without leaking compensation when access is denied', async () => {
    mockLoad.mockResolvedValue({ kind: 'denied' });
    const response = await GET(request());
    expect(response.status).toBe(404);
    const json = (await response.json()) as Record<string, unknown>;
    expect(JSON.stringify(json)).not.toMatch(/6000|12500|Apex|commission|payout/i);
  });

  it('is GET-only', async () => {
    const route = await import('@/app/api/invoices/agreement-prefill/route');
    expect(route).toHaveProperty('GET');
    expect(route).not.toHaveProperty('POST');
    expect(route).not.toHaveProperty('PATCH');
  });
});
