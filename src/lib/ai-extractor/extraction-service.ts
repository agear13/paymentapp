import Anthropic from '@anthropic-ai/sdk';
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
import { validateExtractionResult } from './validate-extraction-result';

export { validateExtractionResult } from './validate-extraction-result';

let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set');
    _client = new Anthropic({ apiKey });
  }
  return _client;
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

  const validated = validateExtractionResult(parseResult.parsed);
  return normalizeExtractionResult(validated);
}
