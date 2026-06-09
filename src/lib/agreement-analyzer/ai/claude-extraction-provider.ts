import Anthropic from '@anthropic-ai/sdk';

import type { AgreementAllowedMime } from '@/lib/agreement-analyzer/validation';
import { parseJsonFromModelResponse } from '@/lib/agreement-analyzer/ai/parse-json-response';
import {
  getClaudeAgreementExtractionModel,
  getClaudeAgreementVisionModel,
} from '@/lib/agreement-analyzer/ai/provider-config';
import { parseExecutiveSummaryResponse } from '@/lib/agreement-analyzer/ai/parse-executive-summary-response';
import type {
  AIExtractionProvider,
  ExecutiveSummaryGenerationInput,
  ExecutiveSummaryGenerationResult,
  ImageTranscriptionResult,
  RelationshipClassificationResult,
  StructuredExtractionResult,
} from '@/lib/agreement-analyzer/ai/types';
import { buildExecutiveSummaryStructuredInput } from '@/lib/agreement-analyzer/extraction/core/build-executive-summary-input';
import { AgreementExtractionResultSchema } from '@/lib/agreement-analyzer/extraction/extraction-types';
import {
  AGREEMENT_EXECUTIVE_SUMMARY_SYSTEM_PROMPT,
  AGREEMENT_RELATIONSHIP_CLASSIFICATION_SYSTEM_PROMPT,
  AGREEMENT_STRUCTURED_EXTRACTION_SYSTEM_PROMPT,
  AGREEMENT_VISION_TEXT_SYSTEM_PROMPT,
  buildExecutiveSummaryUserPrompt,
  buildRelationshipClassificationUserPrompt,
  buildStructuredExtractionUserPrompt,
} from '@/lib/agreement-analyzer/extraction/extraction-prompt';

const STRUCTURED_EXTRACTION_MAX_TOKENS = 4096;
const VISION_MAX_TOKENS = 4096;
const CLASSIFICATION_MAX_TOKENS = 256;
const EXECUTIVE_SUMMARY_MAX_TOKENS = 768;

let cachedClient: Anthropic | null = null;

function getAnthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured');
  }
  if (!cachedClient) {
    cachedClient = new Anthropic({ apiKey });
  }
  return cachedClient;
}

function anthropicImageMediaType(
  mimeType: AgreementAllowedMime
): 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' {
  if (mimeType === 'image/png') {
    return 'image/png';
  }
  return 'image/jpeg';
}

function readAnthropicTextResponse(message: Anthropic.Messages.Message): string {
  const block = message.content[0];
  if (!block || block.type !== 'text' || !block.text.trim()) {
    throw new Error('Claude returned an empty response.');
  }
  return block.text.trim();
}

export class ClaudeExtractionProvider implements AIExtractionProvider {
  readonly id = 'claude' as const;
  readonly modelName: string;
  private readonly visionModelName: string;

  constructor(modelName = getClaudeAgreementExtractionModel()) {
    this.modelName = modelName;
    this.visionModelName = getClaudeAgreementVisionModel();
  }

  isConfigured(): boolean {
    return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
  }

  async extractStructuredObligations(normalizedText: string): Promise<StructuredExtractionResult> {
    const client = getAnthropicClient();
    const message = await client.messages.create({
      model: this.modelName,
      max_tokens: STRUCTURED_EXTRACTION_MAX_TOKENS,
      temperature: 0,
      system: AGREEMENT_STRUCTURED_EXTRACTION_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildStructuredExtractionUserPrompt(normalizedText) }],
    });

    const parsed = parseJsonFromModelResponse(readAnthropicTextResponse(message));
    const extraction = AgreementExtractionResultSchema.parse(parsed);
    return { extraction, modelName: message.model };
  }

  async transcribeImage(
    bytes: Buffer,
    mimeType: AgreementAllowedMime
  ): Promise<ImageTranscriptionResult> {
    const client = getAnthropicClient();
    const message = await client.messages.create({
      model: this.visionModelName,
      max_tokens: VISION_MAX_TOKENS,
      temperature: 0,
      system: AGREEMENT_VISION_TEXT_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: anthropicImageMediaType(mimeType),
                data: bytes.toString('base64'),
              },
            },
            {
              type: 'text',
              text: 'Transcribe all readable text from this commercial agreement image.',
            },
          ],
        },
      ],
    });

    return {
      text: readAnthropicTextResponse(message),
      modelName: message.model,
    };
  }

  async classifyRelationship(normalizedText: string): Promise<RelationshipClassificationResult> {
    const client = getAnthropicClient();
    const message = await client.messages.create({
      model: this.modelName,
      max_tokens: CLASSIFICATION_MAX_TOKENS,
      temperature: 0,
      system: AGREEMENT_RELATIONSHIP_CLASSIFICATION_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildRelationshipClassificationUserPrompt(normalizedText) }],
    });

    const parsed = parseJsonFromModelResponse(readAnthropicTextResponse(message)) as {
      documentType?: unknown;
    };
    const relationshipType =
      typeof parsed.documentType === 'string' ? parsed.documentType.trim() : '';
    if (!relationshipType) {
      throw new Error('Claude returned an invalid relationship classification response.');
    }

    return { relationshipType, modelName: message.model };
  }

  async generateExecutiveSummary(
    input: ExecutiveSummaryGenerationInput
  ): Promise<ExecutiveSummaryGenerationResult> {
    const structuredInput = buildExecutiveSummaryStructuredInput(input);
    const client = getAnthropicClient();
    const message = await client.messages.create({
      model: this.modelName,
      max_tokens: EXECUTIVE_SUMMARY_MAX_TOKENS,
      temperature: 0,
      system: AGREEMENT_EXECUTIVE_SUMMARY_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: buildExecutiveSummaryUserPrompt(JSON.stringify(structuredInput, null, 2)),
        },
      ],
    });

    const summary = parseExecutiveSummaryResponse(readAnthropicTextResponse(message));
    return { summary, modelName: message.model };
  }
}
