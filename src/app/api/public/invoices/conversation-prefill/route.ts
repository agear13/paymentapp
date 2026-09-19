import { NextRequest } from 'next/server';
import { apiError, apiResponse } from '@/lib/api/middleware';
import { applyRateLimit } from '@/lib/rate-limit';
import { extractConversationInvoiceFromText } from '@/lib/invoices/conversation-invoice-extraction.server';
import { CONVERSATION_INVOICE_MAX_CHARS } from '@/lib/invoices/conversation-invoice-extraction';

export const dynamic = 'force-dynamic';

/**
 * POST /api/public/invoices/conversation-prefill
 * Unauthenticated, ephemeral conversation → invoice extraction for the free
 * invoice acquisition page. Does not persist the paste. Does not write payment_links.
 */
export async function POST(request: NextRequest) {
  const rateLimitResult = await applyRateLimit(request, 'public');
  if (!rateLimitResult.success) {
    return apiError('Rate limit exceeded', 429);
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return apiError('Invalid JSON body', 400);
  }

  const conversationText =
    rawBody && typeof rawBody === 'object' && !Array.isArray(rawBody)
      ? typeof (rawBody as { conversationText?: unknown }).conversationText === 'string'
        ? (rawBody as { conversationText: string }).conversationText
        : ''
      : '';

  const trimmed = conversationText.trim();
  if (!trimmed) {
    return apiError('Paste a conversation to continue.', 400);
  }
  if (conversationText.length > CONVERSATION_INVOICE_MAX_CHARS) {
    return apiError('Conversation text is too long (max 50,000 characters)', 400);
  }

  const extraction = await extractConversationInvoiceFromText(trimmed);

  return apiResponse({ extraction });
}
