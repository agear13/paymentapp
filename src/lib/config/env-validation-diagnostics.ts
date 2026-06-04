/**
 * Human-readable env validation diagnostics (no secret values).
 */
import type { ZodError, ZodIssue } from 'zod';

function envVarName(issue: ZodIssue): string {
  return issue.path.length > 0 ? issue.path.map(String).join('.') : '(root)';
}

function isEnvVarAbsent(key: string, processEnv: NodeJS.ProcessEnv): boolean {
  const raw = processEnv[key];
  return raw === undefined || raw === '';
}

function ruleLabel(issue: ZodIssue): string {
  switch (issue.code) {
    case 'invalid_type':
      return issue.expected ? `expected ${String(issue.expected)}` : 'invalid type';
    case 'invalid_format':
      return 'invalid format';
    case 'invalid_value':
      return 'invalid value';
    case 'too_small':
      return 'too short or empty';
    case 'too_big':
      return 'too long';
    case 'invalid_union':
      return 'invalid union';
    default:
      return issue.message || issue.code;
  }
}

function statusLabel(key: string, issue: ZodIssue, processEnv: NodeJS.ProcessEnv): string {
  if (isEnvVarAbsent(key, processEnv)) {
    return 'missing';
  }
  const rule = ruleLabel(issue);
  if (rule.includes('url') || issue.code === 'invalid_format') {
    return 'invalid format';
  }
  if (issue.code === 'invalid_type') {
    return 'invalid';
  }
  return `invalid (${rule})`;
}

export type EnvValidationFailureLine = {
  variable: string;
  status: string;
  rule: string;
};

export function collectZodEnvValidationFailures(
  error: ZodError,
  processEnv: NodeJS.ProcessEnv = process.env
): EnvValidationFailureLine[] {
  const issues = error.issues ?? [];
  return issues.map((issue) => {
    const variable = envVarName(issue);
    return {
      variable,
      status: statusLabel(variable, issue, processEnv),
      rule: ruleLabel(issue),
    };
  });
}

export function printZodEnvValidationFailures(
  error: ZodError,
  processEnv: NodeJS.ProcessEnv = process.env
): void {
  const lines = collectZodEnvValidationFailures(error, processEnv);
  for (const line of lines) {
    console.error(`  ${line.variable} -> ${line.status} (${line.rule})`);
  }
}

export function printProductionGuardFailures(messages: string[]): void {
  for (const msg of messages) {
    const match = msg.match(/^([A-Z][A-Z0-9_]+)/);
    const variable = match?.[1] ?? 'production_guard';
    console.error(`  ${variable} -> invalid (${msg})`);
  }
}
