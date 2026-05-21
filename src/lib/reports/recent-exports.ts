export type RecentExportRecord = {
  id: string;
  name: string;
  type: string;
  format: string;
  generatedAt: string;
  status: 'ready' | 'failed';
};

const STORAGE_KEY = 'provvypay-recent-exports';
const MAX_RECENT = 8;

export function loadRecentExports(): RecentExportRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentExportRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveRecentExport(record: Omit<RecentExportRecord, 'id'>): RecentExportRecord[] {
  const entry: RecentExportRecord = {
    ...record,
    id: `${record.type}-${Date.now()}`,
  };
  const next = [entry, ...loadRecentExports().filter((e) => e.type !== record.type || e.format !== record.format)].slice(
    0,
    MAX_RECENT
  );
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}
