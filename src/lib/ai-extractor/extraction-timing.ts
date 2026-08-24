import { randomUUID } from 'crypto';

export const EXTRACTION_TIMING_LOG_PREFIX = '[ai-extractor]';
export const EXTRACTION_ATTEMPT_EVENT = 'extraction_attempt';
export const EXTRACTION_TOTAL_EVENT = 'extraction_total';

export type ExtractionAttemptResult = 'success' | 'retry' | 'failure';

export type ExtractionAttemptTiming = {
  extractionId: string;
  provider: 'anthropic';
  model: string;
  attempt: number;
  completionBudget: number;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  success: boolean;
  result: ExtractionAttemptResult;
  retryTriggered: boolean;
  retryReason?: string;
  failureReason?: string;
  stopReason?: string | null;
  inputTextLength: number;
  inputTokens?: number | null;
  outputTokens?: number | null;
};

export type ExtractionTotalTiming = {
  extractionId: string;
  provider: 'anthropic';
  model: string;
  attemptCount: number;
  startedAt: string;
  endedAt: string;
  totalDurationMs: number;
  retried: boolean;
  result: 'success' | 'failure';
};

export function createExtractionCorrelationId(): string {
  return `ext-${randomUUID()}`;
}

export function buildExtractionAttemptLog(
  timing: ExtractionAttemptTiming
): Record<string, unknown> {
  return {
    event: EXTRACTION_ATTEMPT_EVENT,
    extractionId: timing.extractionId,
    provider: timing.provider,
    model: timing.model,
    attempt: timing.attempt,
    completionBudget: timing.completionBudget,
    startedAt: timing.startedAt,
    endedAt: timing.endedAt,
    durationMs: timing.durationMs,
    success: timing.success,
    result: timing.result,
    retryTriggered: timing.retryTriggered,
    retryReason: timing.retryReason ?? null,
    failureReason: timing.failureReason ?? null,
    stopReason: timing.stopReason ?? null,
    inputTextLength: timing.inputTextLength,
    inputTokens: timing.inputTokens ?? null,
    outputTokens: timing.outputTokens ?? null,
  };
}

export function buildExtractionTotalLog(timing: ExtractionTotalTiming): Record<string, unknown> {
  return {
    event: EXTRACTION_TOTAL_EVENT,
    extractionId: timing.extractionId,
    provider: timing.provider,
    model: timing.model,
    attemptCount: timing.attemptCount,
    startedAt: timing.startedAt,
    endedAt: timing.endedAt,
    totalDurationMs: timing.totalDurationMs,
    retried: timing.retried,
    result: timing.result,
  };
}

export function emitExtractionTiming(payload: Record<string, unknown>): void {
  console.error(EXTRACTION_TIMING_LOG_PREFIX, JSON.stringify(payload));
}

export function logExtractionAttemptTiming(timing: ExtractionAttemptTiming): void {
  emitExtractionTiming(buildExtractionAttemptLog(timing));
}

export function logExtractionTotalTiming(timing: ExtractionTotalTiming): void {
  emitExtractionTiming(buildExtractionTotalLog(timing));
}

export function markAttemptWindow(startedMs: number, endedMs = Date.now()): {
  startedAt: string;
  endedAt: string;
  durationMs: number;
} {
  return {
    startedAt: new Date(startedMs).toISOString(),
    endedAt: new Date(endedMs).toISOString(),
    durationMs: Math.max(0, endedMs - startedMs),
  };
}
