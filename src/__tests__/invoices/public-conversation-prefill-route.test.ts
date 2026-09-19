import { NextRequest } from 'next/server';
import { POST } from '@/app/api/public/invoices/conversation-prefill/route';

jest.mock('@/lib/rate-limit', () => ({
  applyRateLimit: jest.fn().mockResolvedValue({ success: true, limit: 30, remaining: 29, reset: 0 }),
}));

jest.mock('@/lib/invoices/conversation-invoice-extraction.server', () => ({
  extractConversationInvoiceFromText: jest.fn(),
}));

import { applyRateLimit } from '@/lib/rate-limit';
import { extractConversationInvoiceFromText } from '@/lib/invoices/conversation-invoice-extraction.server';

const mockRateLimit = applyRateLimit as jest.Mock;
const mockExtract = extractConversationInvoiceFromText as jest.Mock;

const EXTRACTION = {
  customerName: 'Sarah',
  amount: 12000,
  currency: 'AUD',
  currencyFromConversation: true,
  description: 'Campaign delivery',
  dueDate: undefined,
  paymentTimingNote: 'within 14 days of delivery',
  timingUnresolved: true,
  uncertainties: [],
  ambiguousFields: [],
  candidates: [],
};

function request(body: unknown) {
  return new NextRequest('http://localhost/api/public/invoices/conversation-prefill', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/public/invoices/conversation-prefill', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRateLimit.mockResolvedValue({ success: true, limit: 30, remaining: 29, reset: 0 });
    mockExtract.mockResolvedValue(EXTRACTION);
  });

  it('does not require an authenticated session', async () => {
    const response = await POST(request({ conversationText: 'Invoice Sarah $12000' }));
    expect(response.status).toBe(200);
    expect(mockExtract).toHaveBeenCalledWith('Invoice Sarah $12000');
    expect(mockRateLimit).toHaveBeenCalledWith(expect.anything(), 'public');
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
    mockRateLimit.mockResolvedValue({ success: false, limit: 30, remaining: 0, reset: 0 });
    const response = await POST(request({ conversationText: 'Invoice Sarah $12000' }));
    expect(response.status).toBe(429);
    expect(mockExtract).not.toHaveBeenCalled();
  });

  it('ignores extra client fields and does not persist them', async () => {
    const response = await POST(
      request({
        conversationText: 'Please invoice Sarah $12,000 for the campaign.',
        amount: 99999,
        customerName: 'Spoofed',
        organizationId: 'org-other',
      })
    );
    expect(response.status).toBe(200);
    expect(mockExtract).toHaveBeenCalledWith('Please invoice Sarah $12,000 for the campaign.');
    const json = (await response.json()) as { extraction: { amount?: number } };
    expect(json.extraction.amount).toBe(12000);
    expect(JSON.stringify(json)).not.toContain('99999');
    expect(JSON.stringify(json)).not.toContain('org-other');
  });
});
