import { z } from 'zod';
import {
  collectZodEnvValidationFailures,
} from '@/lib/config/env-validation-diagnostics';

describe('env-validation-diagnostics', () => {
  it('reports missing vs invalid without exposing values', () => {
    const schema = z.object({
      DATABASE_URL: z.string().min(1),
      NEXT_PUBLIC_APP_URL: z.string().url(),
    });

    const env = {
      DATABASE_URL: 'postgresql://localhost/db',
      NEXT_PUBLIC_APP_URL: '',
    } as NodeJS.ProcessEnv;

    let caught: z.ZodError | undefined;
    try {
      schema.parse(env);
    } catch (e) {
      caught = e as z.ZodError;
    }

    expect(caught).toBeDefined();
    const lines = collectZodEnvValidationFailures(caught!, env);
    const byVar = Object.fromEntries(lines.map((l) => [l.variable, l.status]));

    expect(byVar.NEXT_PUBLIC_APP_URL).toBe('missing');
    expect(lines.some((l) => l.variable === 'DATABASE_URL')).toBe(false);

    const badUrlEnv = {
      DATABASE_URL: 'postgresql://localhost/db',
      NEXT_PUBLIC_APP_URL: 'not-a-valid-url',
    } as NodeJS.ProcessEnv;
    try {
      schema.parse(badUrlEnv);
    } catch (e) {
      const badLines = collectZodEnvValidationFailures(e as z.ZodError, badUrlEnv);
      expect(badLines.find((l) => l.variable === 'NEXT_PUBLIC_APP_URL')?.status).toMatch(
        /invalid/
      );
      expect(JSON.stringify(badLines)).not.toContain('postgresql');
    }
  });
});
