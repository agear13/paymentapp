import { normalizeXeroOAuthReturnPath } from '@/lib/xero/oauth-return-path';

const STORAGE_KEY = 'provvy.xeroConnectContinueFrom';

/** Allowlist pathname; preserve safe same-origin query strings for continue navigation. */
export function normalizeContinueFromPath(path: string): string | null {
  const trimmed = path.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return null;

  const hashIndex = trimmed.indexOf('#');
  const withoutHash = hashIndex === -1 ? trimmed : trimmed.slice(0, hashIndex);
  const questionIndex = withoutHash.indexOf('?');
  const pathname = questionIndex === -1 ? withoutHash : withoutHash.slice(0, questionIndex);
  const search = questionIndex === -1 ? '' : withoutHash.slice(questionIndex);

  const allowedPathname = normalizeXeroOAuthReturnPath(pathname);
  if (!allowedPathname) return null;

  return search ? `${allowedPathname}${search}` : allowedPathname;
}

export function storeXeroOAuthContinueFrom(path: string | undefined): void {
  if (typeof window === 'undefined' || !path?.trim()) return;
  const normalized = normalizeContinueFromPath(path);
  if (!normalized) return;
  try {
    sessionStorage.setItem(STORAGE_KEY, normalized);
  } catch {
    /* ignore quota / private mode */
  }
}

export function readXeroOAuthContinueFrom(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return normalizeContinueFromPath(raw) ?? null;
  } catch {
    return null;
  }
}

export function clearXeroOAuthContinueFrom(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
