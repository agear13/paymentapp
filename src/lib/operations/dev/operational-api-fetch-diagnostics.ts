/** Client-side fail-safe fetch diagnostics for production 502/499 diagnosis. */

export type OperationalApiFetchDiagnostics = {
  ok: boolean;
  status: number;
  contentType: string | null;
  isJsonContentType: boolean;
  bodyText: string;
  bodyPreview: string;
  shouldParseJson: boolean;
};

export type OperationalPageLoadEntry = {
  order: number;
  label: 'A-activation' | 'B-coordination-snapshot' | 'C-obligations' | string;
  route: string;
  status: number;
  durationMs: number;
  ok: boolean;
  isJsonContentType: boolean;
  failed: boolean;
  relativeStartMs: number;
};

type PageLoadTrace = {
  page: string;
  startedAt: number;
  entries: OperationalPageLoadEntry[];
};

let activeTrace: PageLoadTrace | null = null;
let entryOrder = 0;

export function hasActiveOperationalPageLoadTrace(): boolean {
  return activeTrace != null;
}

export function beginOperationalPageLoadTrace(page: string): void {
  activeTrace = { page, startedAt: performance.now(), entries: [] };
  entryOrder = 0;
  console.info('[operational-page-load]', {
    event: 'trace-start',
    page,
    at: new Date().toISOString(),
  });
}

function recordPageLoadEntry(
  label: OperationalPageLoadEntry['label'],
  route: string,
  status: number,
  durationMs: number,
  ok: boolean,
  isJsonContentType: boolean
): OperationalPageLoadEntry {
  const relativeStartMs = activeTrace ? performance.now() - activeTrace.startedAt : 0;
  const entry: OperationalPageLoadEntry = {
    order: ++entryOrder,
    label,
    route,
    status,
    durationMs,
    ok,
    isJsonContentType,
    failed: !ok || !isJsonContentType,
    relativeStartMs: Math.round(relativeStartMs),
  };
  activeTrace?.entries.push(entry);
  return entry;
}

export function flushOperationalPageLoadTrace(): void {
  if (!activeTrace) return;

  const entries = [...activeTrace.entries];
  const firstFailure = entries.find((e) => e.failed);
  const slowest = entries.reduce(
    (acc, cur) => (cur.durationMs > acc.durationMs ? cur : acc),
    entries[0] ?? {
      durationMs: 0,
      label: 'none',
      route: '',
      status: 0,
      ok: true,
      isJsonContentType: true,
      failed: false,
      relativeStartMs: 0,
      order: 0,
    }
  );

  console.info('[operational-page-load]', {
    event: 'trace-complete',
    page: activeTrace.page,
    timeline: entries,
    firstFailure: firstFailure
      ? {
          label: firstFailure.label,
          route: firstFailure.route,
          status: firstFailure.status,
          order: firstFailure.order,
          isolation:
            firstFailure.label === 'A-activation'
              ? 'A-upstream-activation-failure'
              : firstFailure.label === 'B-coordination-snapshot'
                ? 'B-coordination-snapshot-failure'
                : firstFailure.label === 'C-obligations'
                  ? 'C-obligations-endpoint-failure'
                  : 'unknown',
        }
      : null,
    slowestEndpoint: slowest?.route
      ? { route: slowest.route, durationMs: slowest.durationMs, label: slowest.label }
      : null,
    at: new Date().toISOString(),
  });

  activeTrace = null;
}

/** Read body once; never parse JSON unless response.ok and content-type is application/json. */
export async function readOperationalApiResponseDiagnostics(
  route: string,
  res: Response,
  options?: { pageLoadLabel?: OperationalPageLoadEntry['label']; startedAt?: number }
): Promise<OperationalApiFetchDiagnostics> {
  const startedAt = options?.startedAt ?? performance.now();
  const contentType = res.headers.get('content-type');
  const bodyText = await res.text();
  const bodyPreview = bodyText.slice(0, 200);
  const isJsonContentType = Boolean(contentType?.includes('application/json'));
  const shouldParseJson = res.ok && isJsonContentType;

  const durationMs = Math.round(performance.now() - startedAt);

  if (options?.pageLoadLabel) {
    recordPageLoadEntry(
      options.pageLoadLabel,
      route,
      res.status,
      durationMs,
      res.ok,
      isJsonContentType
    );
  }

  if (!shouldParseJson) {
    console.error('[operational-api-fetch]', {
      route,
      status: res.status,
      statusText: res.statusText,
      contentType,
      isJsonContentType,
      ok: res.ok,
      bodyPreview,
      durationMs,
      at: new Date().toISOString(),
    });
  }

  return {
    ok: res.ok,
    status: res.status,
    contentType,
    isJsonContentType,
    bodyText,
    bodyPreview,
    shouldParseJson,
  };
}

export function parseOperationalApiJson<T>(route: string, text: string): T {
  try {
    return JSON.parse(text) as T;
  } catch (error) {
    console.error('[operational-api-fetch] json-parse-failure', {
      route,
      errorMessage: error instanceof Error ? error.message : String(error),
      bodyPreview: text.slice(0, 200),
      at: new Date().toISOString(),
    });
    throw error;
  }
}

export async function fetchOperationalApiJson<T>(
  route: string,
  fetchFn: () => Promise<Response>,
  options?: { pageLoadLabel?: OperationalPageLoadEntry['label'] }
): Promise<{ data: T | null; diagnostics: OperationalApiFetchDiagnostics }> {
  const startedAt = performance.now();
  const res = await fetchFn();
  const diagnostics = await readOperationalApiResponseDiagnostics(route, res, {
    pageLoadLabel: options?.pageLoadLabel,
    startedAt,
  });

  if (!diagnostics.shouldParseJson) {
    return { data: null, diagnostics };
  }

  return {
    data: parseOperationalApiJson<T>(route, diagnostics.bodyText),
    diagnostics,
  };
}
