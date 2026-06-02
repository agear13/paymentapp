import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import type { ExtractionResult } from './extraction-types';
import { buildExtractionSystemPrompt, buildExtractionUserPrompt } from './extraction-prompt';

const MODEL = process.env.EXTRACTOR_MODEL ?? 'claude-sonnet-4-6';
const MAX_TOKENS = 2048;

let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set');
    _client = new Anthropic({ apiKey });
  }
  return _client;
}

const ExtractionFieldSchema = <T extends z.ZodTypeAny>(valueSchema: T) =>
  z.object({
    value: valueSchema,
    confidence: z.enum(['high', 'medium', 'low', 'absent']),
    rawSnippet: z.string().nullable().optional(),
  });

const ExtractedPartySchema = z.object({
  id: z.string(),
  name: ExtractionFieldSchema(z.string()),
  email: ExtractionFieldSchema(z.string().nullable()),
  role: ExtractionFieldSchema(z.string()),
  participationModel: ExtractionFieldSchema(
    z.enum(['fixed_payout', 'revenue_share', 'customer_attribution'])
  ),
  fixedAmount: ExtractionFieldSchema(z.number().nullable()),
  revenueSharePct: ExtractionFieldSchema(z.number().nullable()),
  notes: ExtractionFieldSchema(z.string().nullable()),
});

const ExtractedPaymentTermSchema = z.object({
  description: ExtractionFieldSchema(z.string()),
  amount: ExtractionFieldSchema(z.number().nullable()),
  currency: ExtractionFieldSchema(z.string().nullable()),
  dueCondition: ExtractionFieldSchema(z.string().nullable()),
});

const ExtractionUncertaintySchema = z.object({
  field: z.string(),
  issue: z.string(),
  snippet: z.string().nullable().optional(),
});

const ExtractionResultSchema = z.object({
  projectName: ExtractionFieldSchema(z.string().nullable()),
  projectDescription: ExtractionFieldSchema(z.string().nullable()),
  projectValue: ExtractionFieldSchema(z.number().nullable()),
  currency: ExtractionFieldSchema(z.string().nullable()),
  counterparty: ExtractionFieldSchema(z.string().nullable()),
  parties: z.array(ExtractedPartySchema),
  paymentTerms: z.array(ExtractedPaymentTermSchema),
  uncertainties: z.array(ExtractionUncertaintySchema),
  overallConfidence: z.enum(['high', 'medium', 'low', 'absent']),
  sourceHint: z.string().nullable(),
  extractedAt: z.string(),
});

export function validateExtractionResult(raw: unknown): ExtractionResult {
  return ExtractionResultSchema.parse(raw) as ExtractionResult;
}

function degradedResult(reason: string): ExtractionResult {
  const now = new Date().toISOString();
  return {
    projectName: { value: null, confidence: 'absent' },
    projectDescription: { value: null, confidence: 'absent' },
    projectValue: { value: null, confidence: 'absent' },
    currency: { value: null, confidence: 'absent' },
    counterparty: { value: null, confidence: 'absent' },
    parties: [],
    paymentTerms: [],
    uncertainties: [
      {
        field: 'all',
        issue: reason,
      },
    ],
    overallConfidence: 'low',
    sourceHint: null,
    extractedAt: now,
  };
}

export async function extractAgreementFromText(rawText: string): Promise<ExtractionResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return degradedResult('Extraction service not configured. Please fill in all fields manually.');
  }

  let responseText: string;
  try {
    const client = getClient();
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      temperature: 0,
      system: buildExtractionSystemPrompt(),
      messages: [{ role: 'user', content: buildExtractionUserPrompt(rawText) }],
    });

    const block = message.content[0];
    if (!block || block.type !== 'text') {
      return degradedResult('AI returned an unexpected response format. Please fill in all fields manually.');
    }
    responseText = block.text.trim();
    console.error('[ai-extractor] raw response length:', responseText.length);
    console.error('[ai-extractor] raw response text:', responseText);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return degradedResult(`AI service error: ${message}. Please fill in all fields manually.`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(responseText);
    console.error('[ai-extractor] JSON.parse succeeded. Top-level keys:', Object.keys(parsed as object));
  } catch (parseErr) {
    console.error('[ai-extractor] JSON.parse failed:', parseErr);
    console.error('[ai-extractor] raw text that failed to parse:', responseText);
    return degradedResult('Could not parse AI response. Please fill in all fields manually.');
  }

  try {
    return validateExtractionResult(parsed);
  } catch (validationErr) {
    console.error('[ai-extractor] Zod validation failed.');
    console.error('[ai-extractor] parsed object:', JSON.stringify(parsed, null, 2));
    if (
      validationErr &&
      typeof validationErr === 'object' &&
      'issues' in validationErr
    ) {
      console.error(
        '[ai-extractor] Zod issues:',
        JSON.stringify((validationErr as { issues: unknown[] }).issues, null, 2)
      );
    } else {
      console.error('[ai-extractor] validation error (non-Zod):', validationErr);
    }
    return degradedResult('AI response did not match expected format. Please fill in all fields manually.');
  }
}