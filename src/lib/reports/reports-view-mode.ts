export type ReportsViewMode = 'overview' | 'finance';

/** @deprecated Stored value from earlier builds */
type LegacyReportsViewMode = 'operations' | 'finance';

export const REPORTS_VIEW_MODE_STORAGE_KEY = 'provvypay-reports-view-mode';

export function getStoredReportsViewMode(): ReportsViewMode {
  if (typeof window === 'undefined') {
    return 'overview';
  }
  const stored = window.localStorage.getItem(REPORTS_VIEW_MODE_STORAGE_KEY) as
    | ReportsViewMode
    | LegacyReportsViewMode
    | null;
  if (stored === 'finance') return 'finance';
  if (stored === 'operations') return 'overview';
  if (stored === 'overview') return 'overview';
  return 'overview';
}

export function setStoredReportsViewMode(mode: ReportsViewMode): void {
  window.localStorage.setItem(REPORTS_VIEW_MODE_STORAGE_KEY, mode);
}
