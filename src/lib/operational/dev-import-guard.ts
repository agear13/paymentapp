/**
 * Development-only warnings for undefined UI dependencies.
 */

export function warnIfUndefined<T>(
  symbolName: string,
  value: T | undefined | null,
  context: string
): T {
  if (process.env.NODE_ENV === 'development' && (value === undefined || value === null)) {
    console.warn('[Operational UI Warning]', `${symbolName} imported as undefined in ${context}`);
  }
  return value as T;
}

export function assertUiBinding<T>(
  symbolName: string,
  value: T | undefined | null,
  context: string
): asserts value is T {
  if (process.env.NODE_ENV === 'development' && (value === undefined || value === null)) {
    console.warn('[Operational UI Warning]', `${symbolName} is undefined in ${context}`);
  }
}
