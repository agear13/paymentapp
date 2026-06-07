import type {
  AgreementHealthFactor,
  AgreementHealthSnapshot,
  AgreementHealthTrend,
} from '@/lib/agreements/health/agreement-health.types';

const STORAGE_KEY = 'provvypay:agreement-health-history:v1';
const MAX_ENTRIES_PER_AGREEMENT = 24;

type StoredHealthEntry = {
  score: number;
  timestamp: string;
  factorLabels: string[];
};

type StoredHealthHistory = Record<string, StoredHealthEntry[]>;

function readHistory(): StoredHealthHistory {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as StoredHealthHistory;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeHistory(history: StoredHealthHistory): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch {
    /* ignore quota errors */
  }
}

export function recordAgreementHealthSnapshot(snapshot: AgreementHealthSnapshot): void {
  const history = readHistory();
  const entries = history[snapshot.projectId] ?? [];
  const factorLabels = snapshot.factors
    .filter((f) => f.status !== 'positive')
    .map((f) => f.label);

  const last = entries[entries.length - 1];
  if (last && last.score === snapshot.score && last.timestamp.slice(0, 13) === snapshot.recordedAt.slice(0, 13)) {
    return;
  }

  const next: StoredHealthEntry = {
    score: snapshot.score,
    timestamp: snapshot.recordedAt,
    factorLabels,
  };

  history[snapshot.projectId] = [...entries, next].slice(-MAX_ENTRIES_PER_AGREEMENT);
  writeHistory(history);
}

function trendContributors(
  currentFactors: AgreementHealthFactor[],
  previousFactorLabels: string[]
): string[] {
  const currentWarnings = currentFactors.filter((f) => f.status !== 'positive');
  const newlyNegative = currentWarnings
    .filter((f) => !previousFactorLabels.includes(f.label))
    .map((f) => f.label);
  const resolved = previousFactorLabels.filter(
    (label) => !currentWarnings.some((f) => f.label === label)
  );

  const parts: string[] = [];
  if (resolved.length > 0) {
    parts.push(`Resolved: ${resolved.slice(0, 2).join(', ')}`);
  }
  if (newlyNegative.length > 0) {
    parts.push(`New gaps: ${newlyNegative.slice(0, 2).join(', ')}`);
  }
  if (parts.length === 0 && currentWarnings.length > 0) {
    parts.push(currentWarnings[0].detail);
  }
  return parts.slice(0, 3);
}

export function deriveAgreementHealthTrend(
  projectId: string,
  currentScore: number,
  currentFactors: AgreementHealthFactor[]
): AgreementHealthTrend {
  const history = readHistory();
  const entries = history[projectId] ?? [];
  const previous = entries.length > 0 ? entries[entries.length - 1] : null;
  const previousScore = previous?.score ?? null;
  const delta = previousScore == null ? 0 : currentScore - previousScore;

  let direction: AgreementHealthTrend['direction'] = 'stable';
  if (delta >= 3) direction = 'improved';
  if (delta <= -3) direction = 'declined';

  const label =
    previousScore == null
      ? 'Baseline recorded'
      : delta === 0
        ? 'No change'
        : delta > 0
          ? `+${delta} Health`
          : `${delta} Health`;

  return {
    delta,
    direction,
    label,
    contributingFactors: trendContributors(currentFactors, previous?.factorLabels ?? []),
    previousScore,
  };
}

export function readAgreementHealthHistory(projectId: string): StoredHealthEntry[] {
  return readHistory()[projectId] ?? [];
}
