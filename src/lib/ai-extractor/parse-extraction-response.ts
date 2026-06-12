import { EXTRACTION_TRUNCATION_USER_MESSAGE } from './extraction-config';

export type ExtractionParseFailureReason = 'truncated' | 'parse_failed';

export class ExtractionResponseError extends Error {
  readonly code: ExtractionParseFailureReason;

  constructor(code: ExtractionParseFailureReason, message: string) {
    super(message);
    this.name = 'ExtractionResponseError';
    this.code = code;
  }
}

export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}

export function stripJsonCodeFences(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return fenced?.[1]?.trim() ?? trimmed;
}

function countUnescapedDoubleQuotes(text: string): number {
  let count = 0;
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] !== '"') continue;
    let escapes = 0;
    for (let j = i - 1; j >= 0 && text[j] === '\\'; j -= 1) {
      escapes += 1;
    }
    if (escapes % 2 === 0) count += 1;
  }
  return count;
}

export function isLikelyTruncatedJson(text: string, stopReason?: string | null): boolean {
  if (stopReason === 'max_tokens') return true;

  const candidate = stripJsonCodeFences(text);
  if (!candidate.startsWith('{')) return true;
  if (!candidate.endsWith('}')) return true;
  if (countUnescapedDoubleQuotes(candidate) % 2 !== 0) return true;

  try {
    JSON.parse(candidate);
    return false;
  } catch (err) {
    const message = err instanceof Error ? err.message : '';
    return /Unterminated string|Unexpected end of JSON input|Expected ','|Unexpected token/.test(
      message
    );
  }
}

export function attemptTruncatedJsonRepair(text: string): string | null {
  let repaired = stripJsonCodeFences(text).trimEnd();
  if (!repaired.startsWith('{')) return null;

  if (countUnescapedDoubleQuotes(repaired) % 2 !== 0) {
    repaired += '"';
  }

  const stack: Array<'>' | '}'> = [];
  let inString = false;
  for (let i = 0; i < repaired.length; i += 1) {
    const char = repaired[i];
    if (char === '"') {
      let escapes = 0;
      for (let j = i - 1; j >= 0 && repaired[j] === '\\'; j -= 1) {
        escapes += 1;
      }
      if (escapes % 2 === 0) inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === '{') stack.push('}');
    else if (char === '[') stack.push('>');
    else if (char === '}' || char === ']') stack.pop();
  }

  while (stack.length > 0) {
    const closer = stack.pop();
    repaired += closer === '>' ? ']' : '}';
  }

  try {
    JSON.parse(repaired);
    return repaired;
  } catch {
    return null;
  }
}

export type ExtractionParseResult =
  | { ok: true; parsed: unknown; repaired: boolean }
  | { ok: false; reason: ExtractionParseFailureReason; detail: string };

export function shouldRejectTruncatedExtraction(
  stopReason: string | null,
  parseResult: ExtractionParseResult
): boolean {
  if (!parseResult.ok) {
    return parseResult.reason === 'truncated' || stopReason === 'max_tokens';
  }
  return stopReason === 'max_tokens' && parseResult.repaired;
}

export function parseExtractionModelResponse(
  raw: string,
  options?: { stopReason?: string | null }
): ExtractionParseResult {
  const candidate = stripJsonCodeFences(raw);
  const truncated = isLikelyTruncatedJson(candidate, options?.stopReason);

  try {
    return { ok: true, parsed: JSON.parse(candidate), repaired: false };
  } catch (parseErr) {
    const detail = parseErr instanceof Error ? parseErr.message : 'Unknown parse error';

    if (truncated) {
      const repaired = attemptTruncatedJsonRepair(candidate);
      if (repaired) {
        try {
          return { ok: true, parsed: JSON.parse(repaired), repaired: true };
        } catch {
          // fall through to truncated failure
        }
      }

      return {
        ok: false,
        reason: 'truncated',
        detail: EXTRACTION_TRUNCATION_USER_MESSAGE,
      };
    }

    return { ok: false, reason: 'parse_failed', detail };
  }
}
