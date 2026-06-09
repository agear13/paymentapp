import OpenAI from 'openai';

import type { AgreementAllowedMime } from '@/lib/agreement-analyzer/validation';
import { parseJsonFromModelResponse } from '@/lib/agreement-analyzer/ai/parse-json-response';
import {
  getOpenAIAgreementExtractionModel,
  getOpenAIAgreementVisionModel,
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

let cachedClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }
  if (!cachedClient) {
    cachedClient = new OpenAI({ apiKey });
  }
  return cachedClient;
}

function imageDataUrl(bytes: Buffer, mimeType: AgreementAllowedMime): string {
  return `data:${mimeType};base64,${bytes.toString('base64')}`;
}

export class OpenAIExtractionProvider implements AIExtractionProvider {
  readonly id = 'openai' as const;
  readonly modelName: string;
  private readonly visionModelName: string;

  constructor(modelName = getOpenAIAgreementExtractionModel()) {
    this.modelName = modelName;
    this.visionModelName = getOpenAIAgreementVisionModel();
  }

  isConfigured(): boolean {
    return Boolean(process.env.OPENAI_API_KEY?.trim());
  }

  async extractStructuredObligations(normalizedText: string): Promise<StructuredExtractionResult> {
    const client = getOpenAIClient();
    const response = await client.chat.completions.create({
      model: this.modelName,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: AGREEMENT_STRUCTURED_EXTRACTION_SYSTEM_PROMPT },
        { role: 'user', content: buildStructuredExtractionUserPrompt(normalizedText) },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('OpenAI returned an empty extraction response.');
    }

    const parsed = parseJsonFromModelResponse(content);
    const extraction = AgreementExtractionResultSchema.parse(parsed);
    return { extraction, modelName: response.model ?? this.modelName };
  }

  async transcribeImage(
    bytes: Buffer,
    mimeType: AgreementAllowedMime
  ): Promise<ImageTranscriptionResult> {
    const client = getOpenAIClient();
    const response = await client.chat.completions.create({
      model: this.visionModelName,
      temperature: 0,
      messages: [
        { role: 'system', content: AGREEMENT_VISION_TEXT_SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Transcribe all readable text from this commercial agreement image.',
            },
            {
              type: 'image_url',
              image_url: { url: imageDataUrl(bytes, mimeType) },
            },
          ],
        },
      ],
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      throw new Error('OpenAI Vision returned an empty transcription.');
    }

    return { text: content, modelName: response.model ?? this.visionModelName };
  }

  async classifyRelationship(normalizedText: string): Promise<RelationshipClassificationResult> {
    const client = getOpenAIClient();
    const response = await client.chat.completions.create({
      model: this.modelName,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: AGREEMENT_RELATIONSHIP_CLASSIFICATION_SYSTEM_PROMPT },
        { role: 'user', content: buildRelationshipClassificationUserPrompt(normalizedText) },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('OpenAI returned an empty relationship classification response.');
    }

    const parsed = parseJsonFromModelResponse(content) as { documentType?: unknown };
    const relationshipType =
      typeof parsed.documentType === 'string' ? parsed.documentType.trim() : '';
    if (!relationshipType) {
      throw new Error('OpenAI returned an invalid relationship classification response.');
    }

    return { relationshipType, modelName: response.model ?? this.modelName };
  }

  async generateExecutiveSummary(
    input: ExecutiveSummaryGenerationInput
  ): Promise<ExecutiveSummaryGenerationResult> {
    const structuredInput = buildExecutiveSummaryStructuredInput(input);
    const client = getOpenAIClient();
    const response = await client.chat.completions.create({
      model: this.modelName,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: AGREEMENT_EXECUTIVE_SUMMARY_SYSTEM_PROMPT },
        {
          role: 'user',
          content: buildExecutiveSummaryUserPrompt(JSON.stringify(structuredInput, null, 2)),
        },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('OpenAI returned an empty executive summary response.');
    }

    const summary = parseExecutiveSummaryResponse(content);
    return { summary, modelName: response.model ?? this.modelName };
  }
}
