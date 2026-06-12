export const DEFAULT_EXTRACTOR_MODEL = 'claude-sonnet-4-6';

/** Default output token budget — agreement analyzer structured extraction uses 4096. */
export const DEFAULT_EXTRACTOR_MAX_TOKENS = 4096;

/** Retry budget when the first completion hits max_tokens. */
export const EXTRACTOR_MAX_TOKENS_RETRY = 8192;

export const EXTRACTION_TRUNCATION_USER_MESSAGE =
  'Extraction exceeded response limits. Please retry or shorten the conversation.';

export function getExtractorModel(): string {
  return process.env.EXTRACTOR_MODEL?.trim() || DEFAULT_EXTRACTOR_MODEL;
}

export function getExtractorMaxTokens(): number {
  const raw = process.env.EXTRACTOR_MAX_TOKENS?.trim();
  if (!raw) return DEFAULT_EXTRACTOR_MAX_TOKENS;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_EXTRACTOR_MAX_TOKENS;
}
