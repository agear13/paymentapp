const WARNED = new Set<string>();

/** Dev-only — surfaces legacy coordination/KPI paths still referenced at runtime. */
export function warnLegacyOperationalPath(symbol: string, detail?: string): void {
  if (process.env.NODE_ENV === 'production') return;
  const key = detail ? `${symbol}:${detail}` : symbol;
  if (WARNED.has(key)) return;
  WARNED.add(key);
  console.warn('[LEGACY_OPERATIONAL_PATH_STILL_REFERENCED]', {
    symbol,
    detail: detail ?? null,
    at: new Date().toISOString(),
  });
}

export function resetLegacyOperationalPathWarningsForTests(): void {
  WARNED.clear();
}
