const NEEDS_ATTENTION_KEY = 'payouts.obligations.needsAttention';

export function readNeedsAttentionPreference(): boolean | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(NEEDS_ATTENTION_KEY);
  if (raw === '1') return true;
  if (raw === '0') return false;
  return null;
}

export function writeNeedsAttentionPreference(value: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(NEEDS_ATTENTION_KEY, value ? '1' : '0');
}
