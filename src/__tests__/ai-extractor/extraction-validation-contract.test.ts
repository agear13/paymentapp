/**
 * Executable contract tests: AI extraction prompt vs Zod validation.
 *
 * Currency fields accept null per prompt rule 4. Name/role nulls remain
 * documented mismatches until separately addressed.
 */
import { ZodError } from 'zod';
import { validateExtractionResult } from '@/lib/ai-extractor/extraction-service';
import { buildExtractionSummary } from '@/lib/ai-extractor/extraction-summary';
import { reviewFormFromExtraction } from '@/lib/ai-extractor/review-form-types';

type ValidationAttempt = {
  passes: boolean;
  issues: ZodError['issues'];
};

function field<T>(value: T, confidence: 'high' | 'medium' | 'low' | 'absent' = 'high') {
  return { value, confidence };
}

/** Minimal valid extraction shape — all other cases override one field. */
function baselineExtractionPayload(): Record<string, unknown> {
  return {
    projectName: field('Summer Fest'),
    projectDescription: field(null),
    projectValue: field(50000),
    currency: field('AUD'),
    counterparty: field(null),
    parties: [
      {
        id: 'ep-1',
        name: field('Alex DJ'),
        email: field(null),
        role: field('Contractor'),
        participationModel: field('revenue_share'),
        fixedAmount: field(null),
        revenueSharePct: field(10),
        notes: field(null),
      },
    ],
    paymentTerms: [],
    uncertainties: [],
    overallConfidence: 'high',
    sourceHint: null,
    extractedAt: '2026-05-20T12:00:00.000Z',
  };
}

function attemptValidation(raw: unknown): ValidationAttempt {
  try {
    validateExtractionResult(raw);
    return { passes: true, issues: [] };
  } catch (err) {
    if (err instanceof ZodError) {
      return { passes: false, issues: err.issues };
    }
    throw err;
  }
}

function issuePaths(issues: ZodError['issues']): string[] {
  return issues.map((i) => i.path.join('.'));
}

function issuesMatchingPath(
  issues: ZodError['issues'],
  pathPrefix: string
): ZodError['issues'] {
  return issues.filter(
    (i) => i.path.join('.') === pathPrefix || i.path.join('.').startsWith(`${pathPrefix}.`)
  );
}

/** Zod 4 may omit `received` on issues; message still documents null rejection. */
function expectInvalidStringNullIssue(
  issue: ZodError['issues'][number],
  path: (string | number)[]
) {
  expect(issue.code).toBe('invalid_type');
  expect(issue.path).toEqual(path);
  if ('expected' in issue) {
    expect(issue.expected).toBe('string');
  }
  const received = 'received' in issue ? issue.received : undefined;
  if (received !== undefined) {
    expect(received).toBe('null');
  } else {
    expect(issue.message.toLowerCase()).toMatch(/null/);
  }
}

describe('extraction validation contract (prompt vs Zod)', () => {
  it('baseline valid payload passes validation', () => {
    const result = attemptValidation(baselineExtractionPayload());
    expect(result.passes).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  describe('1. currency.value = null, confidence = absent (prompt rule 4)', () => {
    it('validateExtractionResult() passes — aligned with prompt', () => {
      const payload = {
        ...baselineExtractionPayload(),
        currency: field(null, 'absent'),
      };
      const result = attemptValidation(payload);

      expect(result.passes).toBe(true);
      expect(result.issues).toHaveLength(0);

      const parsed = validateExtractionResult(payload);
      expect(parsed.currency.value).toBeNull();
      expect(parsed.currency.confidence).toBe('absent');
    });
  });

  describe('2. paymentTerms[].currency.value = null', () => {
    it('validateExtractionResult() passes when payment term currency is null', () => {
      const payload = {
        ...baselineExtractionPayload(),
        paymentTerms: [
          {
            description: field('Deposit'),
            amount: field(1000),
            currency: field(null, 'absent'),
            dueCondition: field(null, 'absent'),
          },
        ],
      };
      const result = attemptValidation(payload);

      expect(result.passes).toBe(true);
      expect(result.issues).toHaveLength(0);

      const parsed = validateExtractionResult(payload);
      expect(parsed.paymentTerms[0]?.currency.value).toBeNull();
      expect(parsed.paymentTerms[0]?.currency.confidence).toBe('absent');
    });
  });

  describe('3. parties[].name.value = null', () => {
    it('CURRENT: validateExtractionResult() FAILS when party name is null', () => {
      const payload = {
        ...baselineExtractionPayload(),
        parties: [
          {
            id: 'ep-1',
            name: field(null, 'absent'),
            email: field(null, 'absent'),
            role: field('Contractor'),
            participationModel: field('revenue_share'),
            fixedAmount: field(null),
            revenueSharePct: field(null, 'absent'),
            notes: field(null),
          },
        ],
      };
      const result = attemptValidation(payload);

      expect(result.passes).toBe(false);
      expect(issuePaths(result.issues)).toContain('parties.0.name.value');

      expectInvalidStringNullIssue(
        issuesMatchingPath(result.issues, 'parties.0.name.value')[0],
        ['parties', 0, 'name', 'value']
      );
    });
  });

  describe('4. parties[].role.value = null', () => {
    it('CURRENT: validateExtractionResult() FAILS when party role is null', () => {
      const payload = {
        ...baselineExtractionPayload(),
        parties: [
          {
            id: 'ep-1',
            name: field('Alex'),
            email: field(null),
            role: field(null, 'absent'),
            participationModel: field('customer_attribution'),
            fixedAmount: field(null),
            revenueSharePct: field(null),
            notes: field(null),
          },
        ],
      };
      const result = attemptValidation(payload);

      expect(result.passes).toBe(false);
      expect(issuePaths(result.issues)).toContain('parties.0.role.value');

      expectInvalidStringNullIssue(
        issuesMatchingPath(result.issues, 'parties.0.role.value')[0],
        ['parties', 0, 'role', 'value']
      );
    });
  });

  describe('5. currency.value: empty string vs null (prompt ambiguity)', () => {
    it('currency.value = "" PASSES validation', () => {
      const payload = {
        ...baselineExtractionPayload(),
        currency: field('', 'absent'),
      };
      const result = attemptValidation(payload);

      expect(result.passes).toBe(true);
      expect(result.issues).toHaveLength(0);
      const parsed = validateExtractionResult(payload);
      expect(parsed.currency.value).toBe('');
      expect(parsed.currency.confidence).toBe('absent');
    });

    it('currency.value = null PASSES validation (aligned with prompt rule 4)', () => {
      const emptyResult = attemptValidation({
        ...baselineExtractionPayload(),
        currency: field('', 'absent'),
      });
      const nullResult = attemptValidation({
        ...baselineExtractionPayload(),
        currency: field(null, 'absent'),
      });

      expect(emptyResult.passes).toBe(true);
      expect(nullResult.passes).toBe(true);
    });
  });

  describe('regression: realistic payload with absent currency', () => {
    it('validates, preserves parties, and does not produce degraded shape', () => {
      const payload = {
        projectName: field('NYE event at Ku De Ta'),
        projectDescription: field('Performance 10pm-2am Dec 31'),
        projectValue: field(15_000_000, 'medium'),
        currency: field(null, 'absent'),
        counterparty: field('Mike / Ku De Ta'),
        parties: [
          {
            id: 'ep-1',
            name: field('Alex'),
            email: field(null, 'absent'),
            role: field('Contractor'),
            participationModel: field('fixed_payout'),
            fixedAmount: field(15_000_000, 'high'),
            revenueSharePct: field(null, 'absent'),
            notes: field(null, 'absent'),
          },
          {
            id: 'ep-2',
            name: field('Sarah'),
            email: field(null, 'absent'),
            role: field('Referrer'),
            participationModel: field('revenue_share'),
            fixedAmount: field(null, 'absent'),
            revenueSharePct: field(10, 'high'),
            notes: field('10% bar revenue', 'medium'),
          },
        ],
        paymentTerms: [],
        uncertainties: [],
        overallConfidence: 'medium',
        sourceHint: 'whatsapp',
        extractedAt: '2026-06-02T00:00:00.000Z',
      };

      const result = attemptValidation(payload);
      expect(result.passes).toBe(true);

      const parsed = validateExtractionResult(payload);
      expect(parsed.parties).toHaveLength(2);
      expect(parsed.currency.value).toBeNull();
      expect(parsed.currency.confidence).toBe('absent');
      expect(parsed.uncertainties.some((u) => u.field === 'all')).toBe(false);

      const summary = buildExtractionSummary(parsed);
      expect(summary.participantCount).toBe(2);
      expect(summary.oneLiner).not.toContain('No agreement details detected');

      const form = reviewFormFromExtraction(parsed, 'project_create', 'whatsapp', undefined, {
        workspaceCurrency: 'AUD',
      });
      expect(form.parties).toHaveLength(2);
      expect(form.currency).toBe('AUD');
    });
  });

  describe('contract mismatch summary (remaining non-nullable string fields)', () => {
    it('records exact Zod issues for prompt-allowed nulls on name/role only', () => {
      const cases: Array<{ label: string; payload: Record<string, unknown> }> = [
        {
          label: 'parties[0].name null',
          payload: {
            ...baselineExtractionPayload(),
            parties: [
              {
                id: 'ep-1',
                name: field(null, 'absent'),
                email: field(null),
                role: field('Contributor'),
                participationModel: field('fixed_payout'),
                fixedAmount: field(null),
                revenueSharePct: field(null),
                notes: field(null),
              },
            ],
          },
        },
        {
          label: 'parties[0].role null',
          payload: {
            ...baselineExtractionPayload(),
            parties: [
              {
                id: 'ep-1',
                name: field('Alex'),
                email: field(null),
                role: field(null, 'absent'),
                participationModel: field('fixed_payout'),
                fixedAmount: field(500),
                revenueSharePct: field(null),
                notes: field(null),
              },
            ],
          },
        },
      ];

      for (const { label, payload } of cases) {
        const result = attemptValidation(payload);
        expect(result.passes).toBe(false);
        expect(result.issues.length).toBeGreaterThan(0);
        const serialized = result.issues.map((i) => ({
          path: i.path.join('.'),
          code: i.code,
          message: i.message,
          expected: 'expected' in i ? i.expected : undefined,
          received: 'received' in i ? i.received : undefined,
        }));
        expect(serialized[0]?.code).toBe('invalid_type');
        expect(serialized[0]?.expected).toBe('string');
        expect(serialized[0]?.message.toLowerCase()).toMatch(/null/);
        if (!result.passes) {
          // eslint-disable-next-line no-console -- contract documentation in test output
          console.info(`[extraction-contract] ${label}:`, JSON.stringify(serialized, null, 2));
        }
      }
    });
  });
});
