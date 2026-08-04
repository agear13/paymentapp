import type { Page, Request, Response } from '@playwright/test';

export type LiveSessionIssue = {
  kind:
    | 'console-error'
    | 'page-error'
    | 'react-warning'
    | 'hydration-warning'
    | 'network-failure'
    | 'api-failure'
    | 'mutation-failure'
    | 'navigation'
    | 'loading-loop'
    | 'stale-state'
    | 'test-blocker';
  message: string;
  url?: string;
  status?: number;
};

export type LiveSessionDiagnostics = {
  issues: LiveSessionIssue[];
  apiCalls: Array<{ method: string; path: string; status?: number }>;
};

const IGNORED_CONSOLE = [
  /favicon\.ico/i,
  /Download the React DevTools/i,
  /Third-party cookie/i,
];

function shouldIgnoreConsole(text: string): boolean {
  return IGNORED_CONSOLE.some((pattern) => pattern.test(text));
}

function classifyConsole(text: string): LiveSessionIssue['kind'] {
  if (/hydration/i.test(text)) return 'hydration-warning';
  if (/Warning:/i.test(text) && /react/i.test(text)) return 'react-warning';
  return 'console-error';
}

function apiPath(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.pathname + parsed.search;
  } catch {
    return url;
  }
}

export function attachLiveSessionDiagnostics(page: Page): LiveSessionDiagnostics {
  const diagnostics: LiveSessionDiagnostics = { issues: [], apiCalls: [] };
  const pendingMutations = new Map<string, number>();
  let navigationCount = 0;
  let lastNavigationAt = Date.now();

  page.on('console', (msg) => {
    const type = msg.type();
    if (type !== 'error' && type !== 'warning') return;
    const text = msg.text();
    if (shouldIgnoreConsole(text)) return;
    diagnostics.issues.push({
      kind: classifyConsole(text),
      message: text.slice(0, 500),
      url: page.url(),
    });
  });

  page.on('pageerror', (error) => {
    diagnostics.issues.push({
      kind: 'page-error',
      message: error.message.slice(0, 500),
      url: page.url(),
    });
  });

  page.on('framenavigated', () => {
    navigationCount += 1;
    const now = Date.now();
    if (navigationCount > 12 && now - lastNavigationAt < 4000) {
      diagnostics.issues.push({
        kind: 'loading-loop',
        message: 'Rapid repeated navigation detected (>12 navigations in 4s window)',
        url: page.url(),
      });
    }
    lastNavigationAt = now;
  });

  page.on('request', (req: Request) => {
    const path = apiPath(req.url());
    if (!path.startsWith('/api/')) return;
    if (req.method() === 'POST' || req.method() === 'PATCH' || req.method() === 'PUT' || req.method() === 'DELETE') {
      pendingMutations.set(req.url(), Date.now());
    }
  });

  page.on('response', async (res: Response) => {
    const req = res.request();
    const path = apiPath(res.url());
    if (!path.startsWith('/api/')) return;

    diagnostics.apiCalls.push({
      method: req.method(),
      path,
      status: res.status(),
    });

    if (res.status() === 0 || res.status() >= 500) {
      diagnostics.issues.push({
        kind: 'network-failure',
        message: `${req.method()} ${path} failed with status ${res.status()}`,
        url: page.url(),
        status: res.status(),
      });
    } else if (res.status() >= 400) {
      diagnostics.issues.push({
        kind: 'api-failure',
        message: `${req.method()} ${path} returned ${res.status()}`,
        url: page.url(),
        status: res.status(),
      });
    }

    if (pendingMutations.has(res.url()) && res.status() >= 400) {
      diagnostics.issues.push({
        kind: 'mutation-failure',
        message: `${req.method()} ${path} mutation failed (${res.status()})`,
        url: page.url(),
        status: res.status(),
      });
      pendingMutations.delete(res.url());
    } else if (pendingMutations.has(res.url())) {
      pendingMutations.delete(res.url());
    }
  });

  return diagnostics;
}

export function reportLiveIssues(diagnostics: LiveSessionDiagnostics): LiveSessionIssue[] {
  const deduped = new Map<string, LiveSessionIssue>();
  for (const issue of diagnostics.issues) {
    const key = `${issue.kind}:${issue.message}:${issue.url ?? ''}`;
    if (!deduped.has(key)) deduped.set(key, issue);
  }
  return [...deduped.values()];
}
