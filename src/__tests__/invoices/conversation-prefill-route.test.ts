import { NextRequest } from 'next/server';
import { POST } from '@/app/api/invoices/conversation-prefill/route';

jest.mock('@/lib/auth/api-session.server', () => ({
  getCurrentUserForApi: jest.fn(),
}));

jest.mock('@/lib/auth/get-org', () => ({
  getOrganizationForAuthenticatedUser: jest.fn(),
}));

jest.mock('@/lib/rate-limit', () => ({
  applyRateLimit: jest.fn().mockResolvedValue({ success: true, limit: 60, remaining: 59, reset: 0 }),
}));

jest.mock('@/lib/invoices/conversation-invoice-extraction.server', () => ({
  extractConversationInvoiceFromText: jest.fn(),
}));

import { getCurrentUserForApi } from '@/lib/auth/api-session.server';
import { getOrganizationForAuthenticatedUser } from '@/lib/auth/get-org';
import { applyRateLimit } from '@/lib/rate-limit';
import { extractConversationInvoiceFromText } from '@/lib/invoices/conversation-invoice-extraction.server';

const mockAuth = getCurrentUserForApi as jest.Mock;
const mockOrg = getOrganizationForAuthenticatedUser as jest.Mock;
const mockRateLimit = applyRateLimit as jest.Mock;
const mockExtract = extractConversationInvoiceFromText as jest.Mock;

const EXTRACTION = {
  customerName: 'Apex Promotions',
  amount: 5000,
  currency: 'AUD',
  currencyFromConversation: true,
  description: 'Event production services',
  dueDate: '2026-09-15',
  timingUnresolved: false,
  uncertainties: [],
  ambiguousFields: [],
  candidates: [],
};

function request(body: unknown) {
  return new NextRequest('http://localhost/api/invoices/conversation-prefill', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/invoices/conversation-prefill', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue({
      user: { id: 'user-1', email: 'owner@apex.test' },
      response: null,
    });
    mockOrg.mockResolvedValue({ id: 'org-workspace' });
    mockRateLimit.mockResolvedValue({ success: true, limit: 60, remaining: 59, reset: 0 });
    mockExtract.mockResolvedValue(EXTRACTION);
  });

  it('requires an authenticated session', async () => {
    mockAuth.mockResolvedValue({
      user: null,
      response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    });
    const response = await POST(request({ conversationText: 'Invoice Apex $5000' }));
    expect(response.status).toBe(401);
    expect(mockExtract).not.toHaveBeenCalled();
  });

  it('rejects empty input', async () => {
    const response = await POST(request({ conversationText: '   ' }));
    expect(response.status).toBe(400);
    expect(mockExtract).not.toHaveBeenCalled();
  });

  it('rejects conversation text over 50,000 characters', async () => {
    const response = await POST(request({ conversationText: 'x'.repeat(50_001) }));
    expect(response.status).toBe(400);
    expect(mockExtract).not.toHaveBeenCalled();
  });

  it('returns 429 when rate limited', async () => {
    mockRateLimit.mockResolvedValue({ success: false, limit: 60, remaining: 0, reset: 0 });
    const response = await POST(request({ conversationText: 'Invoice Apex $5000' }));
    expect(response.status).toBe(429);
    expect(mockExtract).not.toHaveBeenCalled();
  });

  it('ignores extra client fields and does not let them bypass extraction', async () => {
    const response = await POST(
      request({
        conversationText: 'Please invoice Apex Promotions $5,000 for production.',
        amount: 99999,
        customerName: 'Spoofed',
        invoiceOrigin: 'participant_portal',
        organizationId: 'org-other',
        sourceParticipantId: 'p-sarah-1',
      })
    );
    expect(response.status).toBe(200);
    expect(mockExtract).toHaveBeenCalledWith(
      'Please invoice Apex Promotions $5,000 for production.',
      { organizationId: 'org-workspace' }
    );
    expect(mockOrg).toHaveBeenCalledWith('user-1');
    const json = (await response.json()) as { extraction: { amount?: number } };
    expect(json.extraction.amount).toBe(5000);
    expect(json.extraction).not.toHaveProperty('projectValue');
    expect(json.extraction).not.toHaveProperty('parties');
    expect(JSON.stringify(json)).not.toContain('99999');
    expect(JSON.stringify(json)).not.toContain('participant_portal');
  });

  it('returns only the invoice extraction contract', async () => {
    const response = await POST(request({ conversationText: 'Invoice Apex $5000' }));
    expect(response.status).toBe(200);
    const json = (await response.json()) as Record<string, unknown>;
    expect(Object.keys(json)).toEqual(['extraction']);
  });

  it('accepts conversation text at the 50,000 character maximum', async () => {
    const response = await POST(request({ conversationText: 'x'.repeat(50_000) }));
    expect(response.status).toBe(200);
    expect(mockExtract).toHaveBeenCalled();
  });
});
