import {
  buildExtractionAttemptLog,
  buildExtractionTotalLog,
  EXTRACTION_ATTEMPT_EVENT,
  EXTRACTION_TOTAL_EVENT,
  markAttemptWindow,
} from '@/lib/ai-extractor/extraction-timing';

const mockCreate = jest.fn();

jest.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    messages: {
      create: (...args: unknown[]) => mockCreate(...args),
    },
  })),
}));

import { extractAgreementFromText } from '@/lib/ai-extractor/extraction-service';
import {
  DEFAULT_EXTRACTOR_MAX_TOKENS,
  EXTRACTOR_MAX_TOKENS_RETRY,
} from '@/lib/ai-extractor/extraction-config';

const SECRET_AGREEMENT_TEXT =
  'CONFIDENTIAL_AGREEMENT_BODY_DO_NOT_LOG Island DJs fee is AUD 2500';

function validExtractionJson(): string {
  return JSON.stringify({
    projectName: { value: 'Beach Event', confidence: 'high' },
    projectDescription: { value: null, confidence: 'absent' },
    projectValue: { value: 2500, confidence: 'high' },
    currency: { value: 'AUD', confidence: 'high' },
    counterparty: { value: 'Venue', confidence: 'high' },
    parties: [
      {
        id: 'ep-1',
        name: { value: 'Island DJs', confidence: 'high' },
        email: { value: null, confidence: 'absent' },
        role: { value: 'DJ', confidence: 'high' },
        participationModel: { value: 'fixed_payout', confidence: 'high' },
        fixedAmount: { value: 2500, confidence: 'high' },
        revenueSharePct: { value: null, confidence: 'absent' },
        notes: { value: null, confidence: 'absent' },
      },
    ],
    paymentTerms: [],
    uncertainties: [],
    overallConfidence: 'high',
    sourceHint: null,
    extractedAt: '2026-08-24T00:00:00.000Z',
    schemaVersion: 'v5',
  });
}

function anthropicMessage(overrides: {
  text: string;
  stopReason: string | null;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
}) {
  return {
    model: overrides.model ?? 'claude-sonnet-4-6',
    stop_reason: overrides.stopReason,
    usage: {
      input_tokens: overrides.inputTokens ?? 100,
      output_tokens: overrides.outputTokens ?? 200,
    },
    content: [{ type: 'text', text: overrides.text }],
  };
}

function parseTimingLogs(): Array<Record<string, unknown>> {
  return (console.error as jest.Mock).mock.calls
    .filter((call) => call[0] === '[ai-extractor]' && typeof call[1] === 'string')
    .map((call) => JSON.parse(call[1] as string) as Record<string, unknown>);
}

describe('extraction timing instrumentation', () => {
  const originalApiKey = process.env.ANTHROPIC_API_KEY;
  const originalMaxTokens = process.env.EXTRACTOR_MAX_TOKENS;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ANTHROPIC_API_KEY = 'test-key';
    delete process.env.EXTRACTOR_MAX_TOKENS;
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    process.env.ANTHROPIC_API_KEY = originalApiKey;
    if (originalMaxTokens === undefined) delete process.env.EXTRACTOR_MAX_TOKENS;
    else process.env.EXTRACTOR_MAX_TOKENS = originalMaxTokens;
    jest.restoreAllMocks();
  });

  it('builds attempt and total payloads without agreement text fields', () => {
    const attempt = buildExtractionAttemptLog({
      extractionId: 'ext-1',
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      attempt: 1,
      completionBudget: 4096,
      startedAt: '2026-08-24T00:00:00.000Z',
      endedAt: '2026-08-24T00:01:25.200Z',
      durationMs: 85_200,
      success: true,
      result: 'retry',
      retryTriggered: true,
      retryReason: 'max_tokens',
      stopReason: 'max_tokens',
      inputTextLength: SECRET_AGREEMENT_TEXT.length,
      inputTokens: 10,
      outputTokens: 20,
    });
    const total = buildExtractionTotalLog({
      extractionId: 'ext-1',
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      attemptCount: 2,
      startedAt: '2026-08-24T00:00:00.000Z',
      endedAt: '2026-08-24T00:02:59.900Z',
      totalDurationMs: 179_900,
      retried: true,
      result: 'success',
    });

    expect(attempt.event).toBe(EXTRACTION_ATTEMPT_EVENT);
    expect(total.event).toBe(EXTRACTION_TOTAL_EVENT);
    expect(JSON.stringify(attempt)).not.toContain(SECRET_AGREEMENT_TEXT);
    expect(JSON.stringify(total)).not.toContain(SECRET_AGREEMENT_TEXT);
    expect(attempt).not.toHaveProperty('rawText');
    expect(attempt).not.toHaveProperty('responseText');
    expect(attempt).not.toHaveProperty('text');
    expect(attempt.inputTextLength).toBe(SECRET_AGREEMENT_TEXT.length);
  });

  it('records timing for a single successful attempt', async () => {
    let now = 1_700_000_000_000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    mockCreate.mockImplementation(async () => {
      now += 85_200;
      return anthropicMessage({
        text: validExtractionJson(),
        stopReason: 'end_turn',
      });
    });

    const result = await extractAgreementFromText(SECRET_AGREEMENT_TEXT);
    expect(result.parties).toHaveLength(1);
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate.mock.calls[0][0].max_tokens).toBe(DEFAULT_EXTRACTOR_MAX_TOKENS);

    const logs = parseTimingLogs();
    const attempt = logs.find((row) => row.event === EXTRACTION_ATTEMPT_EVENT);
    const total = logs.find((row) => row.event === EXTRACTION_TOTAL_EVENT);
    expect(attempt).toMatchObject({
      attempt: 1,
      completionBudget: DEFAULT_EXTRACTOR_MAX_TOKENS,
      durationMs: 85_200,
      result: 'success',
      retryTriggered: false,
      success: true,
    });
    expect(total).toMatchObject({
      attemptCount: 1,
      totalDurationMs: 85_200,
      retried: false,
      result: 'success',
      extractionId: attempt?.extractionId,
    });
    expect(total?.totalDurationMs).toBe(attempt?.durationMs);
  });

  it('records separate timing for a 4096 → 8192 retry and a total covering both attempts', async () => {
    let now = 1_700_000_000_000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    mockCreate
      .mockImplementationOnce(async () => {
        now += 85_200;
        return anthropicMessage({
          text: '{"partial":true',
          stopReason: 'max_tokens',
        });
      })
      .mockImplementationOnce(async () => {
        now += 94_700;
        return anthropicMessage({
          text: validExtractionJson(),
          stopReason: 'end_turn',
        });
      });

    await extractAgreementFromText(SECRET_AGREEMENT_TEXT);
    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(mockCreate.mock.calls[0][0].max_tokens).toBe(DEFAULT_EXTRACTOR_MAX_TOKENS);
    expect(mockCreate.mock.calls[1][0].max_tokens).toBe(EXTRACTOR_MAX_TOKENS_RETRY);

    const logs = parseTimingLogs();
    const attempts = logs.filter((row) => row.event === EXTRACTION_ATTEMPT_EVENT);
    const total = logs.find((row) => row.event === EXTRACTION_TOTAL_EVENT);
    expect(attempts).toHaveLength(2);
    expect(attempts[0]).toMatchObject({
      attempt: 1,
      completionBudget: DEFAULT_EXTRACTOR_MAX_TOKENS,
      durationMs: 85_200,
      result: 'retry',
      retryTriggered: true,
      retryReason: 'max_tokens',
    });
    expect(attempts[1]).toMatchObject({
      attempt: 2,
      completionBudget: EXTRACTOR_MAX_TOKENS_RETRY,
      durationMs: 94_700,
      result: 'success',
      retryTriggered: false,
    });
    expect(attempts[0].extractionId).toBe(attempts[1].extractionId);
    expect(total).toMatchObject({
      extractionId: attempts[0].extractionId,
      attemptCount: 2,
      retried: true,
      result: 'success',
    });
    expect(total?.totalDurationMs).toBeGreaterThanOrEqual(85_200 + 94_700);
  });

  it('does not log the agreement text or extracted party content', async () => {
    mockCreate.mockResolvedValue(
      anthropicMessage({
        text: validExtractionJson(),
        stopReason: 'end_turn',
      })
    );

    await extractAgreementFromText(SECRET_AGREEMENT_TEXT);

    const serialized = JSON.stringify((console.error as jest.Mock).mock.calls);
    expect(serialized).not.toContain(SECRET_AGREEMENT_TEXT);
    expect(serialized).not.toContain('Island DJs fee is AUD 2500');
    expect(serialized).not.toContain(validExtractionJson());
  });

  it('computes attempt windows from start and end timestamps', () => {
    const window = markAttemptWindow(1_000, 1_250);
    expect(window.durationMs).toBe(250);
    expect(window.startedAt).toBe(new Date(1_000).toISOString());
    expect(window.endedAt).toBe(new Date(1_250).toISOString());
  });
});
