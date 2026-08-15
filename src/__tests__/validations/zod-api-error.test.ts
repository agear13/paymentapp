import { ZodError, z } from 'zod';

import {
  createZodValidationErrorBody,
  zodErrorToValidationErrors,
  zodIssuesToValidationErrors,
} from '@/lib/validations/zod-api-error';

describe('zod-api-error helpers', () => {
  it('maps Zod issues to safe field + message details without input values', () => {
    const schema = z.object({
      customerPhone: z.string().refine((val) => /^\+?[1-9]\d{1,14}$/.test(val), {
        message: 'Phone number must be in valid international format (e.g., +61412345678)',
      }),
    });

    const parsed = schema.safeParse({ customerPhone: '0412345678' });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const details = zodIssuesToValidationErrors(parsed.error.issues);
      expect(details).toEqual([
        {
          field: 'customerPhone',
          message: 'Phone number must be in valid international format (e.g., +61412345678)',
        },
      ]);
      expect(JSON.stringify(details)).not.toContain('0412345678');
    }
  });

  it('createZodValidationErrorBody uses issues, not errors', () => {
    try {
      z.string().email().parse('not-an-email');
    } catch (error) {
      expect(error).toBeInstanceOf(ZodError);
      const body = createZodValidationErrorBody(error as ZodError);
      expect(body.error).toBe('Validation error');
      expect(body.details[0]?.field).toBeTruthy();
      expect(body.details[0]?.message).toMatch(/email/i);
      expect(body.details).not.toBeUndefined();
    }
  });

  it('zodErrorToValidationErrors defaults empty path to body', () => {
    const error = new ZodError([
      {
        code: 'custom',
        message: 'Invalid payload',
        path: [],
      },
    ]);
    expect(zodErrorToValidationErrors(error)).toEqual([
      { field: 'body', message: 'Invalid payload' },
    ]);
  });
});
