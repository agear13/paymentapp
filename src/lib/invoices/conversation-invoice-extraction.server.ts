import 'server-only';

import Anthropic from '@anthropic-ai/sdk';
import { getExtractorModel } from '@/lib/ai-extractor/extraction-config';
import { parseExtractionModelResponse } from '@/lib/ai-extractor/parse-extraction-response';
import { log } from '@/lib/logger';
import {
  emptyConversationInvoiceExtraction,
  sanitizeConversationInvoiceExtraction,
  type ConversationInvoiceExtraction,
} from '@/lib/invoices/conversation-invoice-extraction';

const MAX_TOKENS = 2048;

const SYSTEM_PROMPT = `You extract a single receivable invoice from a pasted conversation for Provvy Create Invoice.

Question to answer: What is the single receivable invoice that the workspace owner is clearly being asked or expected to issue?

Return ONLY a JSON object. No markdown, no code fences, no prose.

Schema:
{
  "customerName": string | null,
  "customerEmail": string | null,
  "description": string | null,
  "amount": number | null,
  "currency": string | null,
  "invoiceDate": string | null,
  "dueDate": string | null,
  "paymentTimingNote": string | null,
  "timingUnresolved": boolean,
  "taxNote": string | null,
  "amountAmbiguous": boolean,
  "customerAmbiguous": boolean,
  "currencyAmbiguous": boolean,
  "amountCandidates": [{ "kind": "amount", "label": string, "amount": number }],
  "customerCandidates": [{ "kind": "customer", "label": string }],
  "uncertainties": [{ "field": "customer|amount|currency|dueDate|description|tax|general", "message": string }]
}

Rules — prefer uncertainty over guessing:
1. Amount is the invoice TOTAL to issue now. Never use project value, deal value, a historical quote, a deposit, an instalment, or a percentage without an explicit base. If more than one plausible amount exists, set amount null, amountAmbiguous true, and list amountCandidates.
2. Customer is the payer. Do not use the first sender, a WhatsApp/Slack display name, a participant, or a vendor/supplier. If more than one plausible payer exists, set customerName null and customerAmbiguous true.
3. Currency only if an explicit ISO-4217 code or unambiguous symbol+region is in the text (AUD, USD, GBP, EUR, NZD, SGD, IDR, CAD, JPY). Otherwise currency null and currencyAmbiguous true. Never default to AUD.
4. dueDate only as yyyy-MM-dd when an actual calendar date is stated. Narrative timing ("after the event", "once approved", "within 7 days", "next month", "on completion", "when payment comes through") is NOT a due date — put it in paymentTimingNote and set timingUnresolved true, dueDate null.
5. invoiceDate only as yyyy-MM-dd when explicitly stated. Otherwise null.
6. description is a concise invoice line (what is being billed), max 200 characters. Never copy the conversation, timestamps, or chat names.
7. taxNote is informational GST/tax wording only. Do not change amount for inclusive/exclusive tax.
8. Distinguish quoted price vs amount to invoice now; deposit vs total; multiple jobs vs one invoice.`;

function buildUserPrompt(): string {
  return 'Extract the single receivable invoice from the following conversation. Return JSON only.';
}

function emptyWithReason(message: string): ConversationInvoiceExtraction {
  return emptyConversationInvoiceExtraction({
    uncertainties: [{ field: 'general', message }],
  });
}

export async function extractConversationInvoiceFromText(
  conversationText: string,
  options?: { organizationId?: string }
): Promise<ConversationInvoiceExtraction> {
  const inputTextLength = conversationText.length;
  const startedAt = Date.now();
  const model = getExtractorModel();

  if (!process.env.ANTHROPIC_API_KEY) {
    log.info('conversation invoice extraction skipped', {
      event: 'conversation_invoice_extraction',
      organizationId: options?.organizationId,
      inputTextLength,
      model,
      durationMs: Date.now() - startedAt,
      success: false,
      reason: 'not_configured',
    });
    return emptyWithReason('Extraction service is not configured. Enter the invoice details manually.');
  }

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const message = await client.messages.create({
      model,
      max_tokens: MAX_TOKENS,
      temperature: 0,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `${buildUserPrompt()}\n\n---\n${conversationText}`,
        },
      ],
    });

    const block = message.content[0];
    const responseText = block && block.type === 'text' ? block.text.trim() : '';
    const parsed = parseExtractionModelResponse(responseText, {
      stopReason: message.stop_reason,
    });

    log.info('conversation invoice extraction', {
      event: 'conversation_invoice_extraction',
      organizationId: options?.organizationId,
      inputTextLength,
      model: message.model,
      durationMs: Date.now() - startedAt,
      success: parsed.ok,
      stopReason: message.stop_reason,
    });

    if (!parsed.ok) {
      return emptyWithReason('Could not read invoice details from that conversation. Enter them manually.');
    }

    return sanitizeConversationInvoiceExtraction(parsed.parsed, { conversationText });
  } catch {
    log.info('conversation invoice extraction', {
      event: 'conversation_invoice_extraction',
      organizationId: options?.organizationId,
      inputTextLength,
      model,
      durationMs: Date.now() - startedAt,
      success: false,
      reason: 'provider_error',
    });
    return emptyWithReason('Could not extract invoice details. Enter them manually.');
  }
}
