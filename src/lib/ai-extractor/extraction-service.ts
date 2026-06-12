import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import type { ExtractionResult } from './extraction-types';
import {
  EXTRACTOR_MAX_TOKENS_RETRY,
  EXTRACTION_TRUNCATION_USER_MESSAGE,
  getExtractorMaxTokens,
  getExtractorModel,
} from './extraction-config';
import { buildExtractionSystemPrompt, buildExtractionUserPrompt } from './extraction-prompt';
import { normalizeExtractionResult } from './normalize-extraction-result';
import {
  estimateTokenCount,
  ExtractionResponseError,
  parseExtractionModelResponse,
  shouldRejectTruncatedExtraction,
} from './parse-extraction-response';

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

const ObligationStatusSchema = z.enum([
  'draft',
  'confirmed',
  'pending',
  'conditional',
  'fulfilled',
  'disputed',
]);

const ExtractedMilestoneSchema = z.object({
  description: ExtractionFieldSchema(z.string()),
  deadline: ExtractionFieldSchema(z.string().nullable()),
  category: ExtractionFieldSchema(z.enum(['financial', 'performance'])),
  status: ObligationStatusSchema.optional(),
});

const ExtractedConditionSchema = z.object({
  description: ExtractionFieldSchema(z.string()),
  dependsOn: ExtractionFieldSchema(z.string().nullable()),
  status: ObligationStatusSchema.optional(),
});

const ExtractedDependencySchema = z.object({
  obligation: ExtractionFieldSchema(z.string()),
  dependsOn: ExtractionFieldSchema(z.string()),
  status: ObligationStatusSchema.optional(),
});

const ExtractedSettlementEventSchema = z.object({
  partyId: ExtractionFieldSchema(z.string()),
  partyName: ExtractionFieldSchema(z.string()),
  type: ExtractionFieldSchema(
    z.enum(['fixed_fee', 'revenue_share', 'bonus', 'milestone', 'attribution'])
  ),
  amount: ExtractionFieldSchema(z.number().nullable()),
  percentage: ExtractionFieldSchema(z.number().nullable()),
  trigger: ExtractionFieldSchema(z.string().nullable()),
  condition: ExtractionFieldSchema(z.string().nullable()),
  status: ObligationStatusSchema,
});

const ExtractedPartySchema = z.object({
  id: z.string(),
  name: ExtractionFieldSchema(z.string()),
  email: ExtractionFieldSchema(z.string().nullable()),
  role: ExtractionFieldSchema(z.string()),
  participationModel: ExtractionFieldSchema(
    z.enum(['fixed_payout', 'revenue_share', 'hybrid', 'customer_attribution'])
  ),
  fixedAmount: ExtractionFieldSchema(z.number().nullable()),
  revenueSharePct: ExtractionFieldSchema(z.number().nullable()),
  deliverables: ExtractionFieldSchema(z.array(z.string())).optional(),
  milestones: z.array(ExtractedMilestoneSchema).optional(),
  serviceCategories: ExtractionFieldSchema(z.array(z.string())).optional(),
  conditions: z.array(ExtractedConditionSchema).optional(),
  dependencies: z.array(ExtractedDependencySchema).optional(),
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
  settlementEvents: z.array(ExtractedSettlementEventSchema).optional(),
  uncertainties: z.array(ExtractionUncertaintySchema),
  overallConfidence: z.enum(['high', 'medium', 'low', 'absent']),
  sourceHint: z.string().nullable(),
  extractedAt: z.string(),
  schemaVersion: z.enum(['v1', 'v2', 'v3']).optional(),
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

type ExtractionCompletion = {
  responseText: string;
  model: string;
  stopReason: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  maxTokens: number;
};

function logExtractionObservability(
  event: string,
  rawText: string,
  completion: ExtractionCompletion,
  extra?: Record<string, unknown>
): void {
  console.error(
    '[ai-extractor]',
    JSON.stringify({
      event,
      model: completion.model,
      stopReason: completion.stopReason,
      maxTokens: completion.maxTokens,
      inputTextLength: rawText.length,
      responseLength: completion.responseText.length,
      estimatedOutputTokens: estimateTokenCount(completion.responseText),
      inputTokens: completion.inputTokens,
      outputTokens: completion.outputTokens,
      ...extra,
    })
  );
}

async function requestExtractionCompletion(
  rawText: string,
  maxTokens: number
): Promise<ExtractionCompletion> {
  const client = getClient();
  const message = await client.messages.create({
    model: getExtractorModel(),
    max_tokens: maxTokens,
    temperature: 0,
    system: buildExtractionSystemPrompt(),
    messages: [{ role: 'user', content: buildExtractionUserPrompt(rawText) }],
  });

  const block = message.content[0];
  if (!block || block.type !== 'text') {
    throw new Error('AI returned an unexpected response format.');
  }

  return {
    responseText: block.text.trim(),
    model: message.model,
    stopReason: message.stop_reason,
    inputTokens: message.usage?.input_tokens ?? null,
    outputTokens: message.usage?.output_tokens ?? null,
    maxTokens,
  };
}

export async function extractAgreementFromText(rawText: string): Promise<ExtractionResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return degradedResult('Extraction service not configured. Please fill in all fields manually.');
  }

  const initialMaxTokens = getExtractorMaxTokens();
  let completion: ExtractionCompletion;

  try {
    completion = await requestExtractionCompletion(rawText, initialMaxTokens);
    logExtractionObservability('extraction_response', rawText, completion);

    if (completion.stopReason === 'max_tokens') {
      console.error(
        '[ai-extractor]',
        JSON.stringify({
          event: 'extraction_retry',
          reason: 'max_tokens',
          initialMaxTokens,
          retryMaxTokens: EXTRACTOR_MAX_TOKENS_RETRY,
        })
      );
      completion = await requestExtractionCompletion(rawText, EXTRACTOR_MAX_TOKENS_RETRY);
      logExtractionObservability('extraction_response_retry', rawText, completion, {
        retried: true,
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return degradedResult(`AI service error: ${message}. Please fill in all fields manually.`);
  }

  const parseResult = parseExtractionModelResponse(completion.responseText, {
    stopReason: completion.stopReason,
  });

  if (shouldRejectTruncatedExtraction(completion.stopReason, parseResult)) {
    logExtractionObservability('extraction_parse_failed', rawText, completion, {
      parseReason: parseResult.ok ? 'repaired_after_max_tokens' : parseResult.reason,
      parseDetail: parseResult.ok ? undefined : parseResult.detail,
      truncated: true,
      repaired: parseResult.ok ? parseResult.repaired : false,
    });
    throw new ExtractionResponseError('truncated', EXTRACTION_TRUNCATION_USER_MESSAGE);
  }

  if (!parseResult.ok) {
    logExtractionObservability('extraction_parse_failed', rawText, completion, {
      parseReason: parseResult.reason,
      parseDetail: parseResult.detail,
      truncated: false,
    });
    return degradedResult('Could not parse AI response. Please fill in all fields manually.');
  }

  logExtractionObservability('extraction_parse_succeeded', rawText, completion, {
    repaired: parseResult.repaired,
    topLevelKeys: Object.keys(parseResult.parsed as object),
  });

  try {
    return normalizeExtractionResult(validateExtractionResult(parseResult.parsed));
  } catch (validationErr) {
    console.error('[ai-extractor] Zod validation failed.');
    console.error('[ai-extractor] parsed object:', JSON.stringify(parseResult.parsed, null, 2));
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
