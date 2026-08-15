import { ZodError, type ZodIssue } from 'zod';

import type { ValidationError } from '@/lib/validations/middleware';

/** Map Zod issues to safe API validation details (field path + message only). */
export function zodIssuesToValidationErrors(issues: ZodIssue[]): ValidationError[] {
  return issues.map((issue) => ({
    field: issue.path.length > 0 ? issue.path.map(String).join('.') : 'body',
    message: issue.message,
  }));
}

export function zodErrorToValidationErrors(error: ZodError): ValidationError[] {
  return zodIssuesToValidationErrors(error.issues);
}

export function createZodValidationErrorBody(
  error: ZodError,
  errorLabel = 'Validation error'
): { error: string; details: ValidationError[] } {
  return {
    error: errorLabel,
    details: zodErrorToValidationErrors(error),
  };
}
