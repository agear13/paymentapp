import mammoth from 'mammoth';

import type { AgreementAllowedMime } from '@/lib/agreement-analyzer/validation';
import {
  isAgreementImageMime,
  type DocumentTextExtractionResult,
} from '@/lib/agreement-analyzer/extraction/extraction-types';
import type { AgreementExtractionProviderId } from '@/lib/agreement-analyzer/ai/types';
import { extractAgreementTextFromImage } from '@/lib/agreement-analyzer/extraction/core/image-transcription';

export class AgreementDocumentParseError extends Error {
  readonly stage = 'text_extraction' as const;

  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'AgreementDocumentParseError';
  }
}

async function parsePdf(bytes: Buffer): Promise<string> {
  const { PDFParse } = await import('pdf-parse');
  const parser = new PDFParse({ data: bytes });
  try {
    const result = await parser.getText();
    const text = typeof result.text === 'string' ? result.text : '';
    if (!text.trim()) {
      throw new AgreementDocumentParseError('No readable text found in PDF.');
    }
    return text;
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}

async function parseDocx(bytes: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer: bytes });
  const text = result.value?.trim() ?? '';
  if (!text) {
    throw new AgreementDocumentParseError('No readable text found in DOCX.');
  }
  return text;
}

function parseTxt(bytes: Buffer): string {
  const text = bytes.toString('utf8').trim();
  if (!text) {
    throw new AgreementDocumentParseError('Text file is empty.');
  }
  return text;
}

export async function extractDocumentText(
  bytes: Buffer,
  mimeType: AgreementAllowedMime,
  providerId?: AgreementExtractionProviderId | string | null
): Promise<DocumentTextExtractionResult> {
  if (isAgreementImageMime(mimeType)) {
    const vision = await extractAgreementTextFromImage(bytes, mimeType, providerId);
    return { kind: 'image', text: vision.text, modelName: vision.modelName };
  }

  let text: string;
  switch (mimeType) {
    case 'application/pdf':
      text = await parsePdf(bytes);
      break;
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      text = await parseDocx(bytes);
      break;
    case 'text/plain':
      text = parseTxt(bytes);
      break;
    default:
      throw new AgreementDocumentParseError(`Unsupported document type: ${mimeType}`);
  }

  return { kind: 'text', text };
}
