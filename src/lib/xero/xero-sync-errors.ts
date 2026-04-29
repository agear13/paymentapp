/**
 * Normalize Xero / xero-node / axios errors into operator-facing strings.
 */

function collectValidationMessages(obj: Record<string, unknown>): string[] {
  const out: string[] = [];

  if (Array.isArray(obj.Elements)) {
    for (const el of obj.Elements) {
      if (!el || typeof el !== 'object') continue;
      const row = el as Record<string, unknown>;
      const errs = row.ValidationErrors;
      if (Array.isArray(errs)) {
        for (const ve of errs) {
          if (ve && typeof ve === 'object' && typeof (ve as Record<string, unknown>).Message === 'string') {
            out.push(String((ve as Record<string, unknown>).Message));
          }
        }
      }
      if (Array.isArray(row.ValidationErrors) && row.Invoices && Array.isArray(row.Invoices)) {
        // no-op — defensive
      }
    }
  }

  if (Array.isArray(obj.ValidationErrors)) {
    for (const ve of obj.ValidationErrors) {
      if (ve && typeof ve === 'object' && typeof (ve as Record<string, unknown>).Message === 'string') {
        out.push(String((ve as Record<string, unknown>).Message));
      }
    }
  }

  return out;
}

function extractFromParsedBody(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const o = body as Record<string, unknown>;

  const msgs = collectValidationMessages(o);
  if (msgs.length > 0) {
    return msgs.join('; ');
  }

  if (typeof o.Message === 'string' && o.Message.trim()) {
    const detail =
      typeof o.Detail === 'string' && o.Detail.trim() ? ` — ${o.Detail}` : '';
    return `${o.Message}${detail}`;
  }

  return null;
}

function tryParseJson(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const s = value.trim();
  if (!s.startsWith('{') && !s.startsWith('[')) return value;
  try {
    return JSON.parse(s) as unknown;
  } catch {
    return value;
  }
}

/**
 * Walk common xero-node / axios shapes and return the first useful Xero message.
 */
export function extractXeroApiMessage(error: unknown): string | null {
  if (!error || typeof error !== 'object') return null;
  const e = error as Record<string, unknown>;

  const candidates: unknown[] = [
    e.body,
    e.response,
    typeof e.response === 'object' && e.response !== null
      ? (e.response as Record<string, unknown>).body
      : undefined,
    typeof e.response === 'object' && e.response !== null
      ? (e.response as Record<string, unknown>).data
      : undefined,
  ];

  for (const raw of candidates) {
    const parsed = tryParseJson(raw);
    if (parsed && typeof parsed === 'object') {
      const msg = extractFromParsedBody(parsed);
      if (msg) return msg;
    }
  }

  return null;
}

function friendlyHint(detail: string): string | null {
  const d = detail.toLowerCase();
  if (d.includes('not subscribed to currency')) {
    return `${detail}. In Xero: enable multi-currency and add the invoice currency, or invoice in your org base currency only.`;
  }
  if (d.includes('currencyrate') || d.includes('currency rate')) {
    return `${detail}. A valid exchange rate is required when the invoice currency differs from your Xero base currency.`;
  }
  if (d.includes('not a valid code')) {
    return `${detail}. Check Settings → Integrations → Xero account codes (use chart codes like 200, not UUIDs).`;
  }
  return null;
}

/**
 * Full message for sync failure logs and `xero_syncs.error_message`.
 */
export function formatXeroSyncError(error: unknown): string {
  const fromApi = extractXeroApiMessage(error);
  if (fromApi) {
    const hint = friendlyHint(fromApi);
    return hint ? `Xero: ${hint}` : `Xero: ${fromApi}`;
  }

  if (error instanceof Error && error.message) {
    const hint = friendlyHint(error.message);
    return hint ?? error.message;
  }

  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  return 'Unknown error occurred during Xero sync';
}
