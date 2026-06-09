/**
 * Client-safe formatters for heterogeneous AI report JSON array items.
 */

function humanizeKey(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatPrimitive(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

function formatNestedValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map(formatReportItem).filter(Boolean).join('; ');
  }
  if (value && typeof value === 'object') {
    return formatReportItem(value);
  }
  return formatPrimitive(value);
}

export function formatReportItem(item: unknown): string {
  if (item == null) return '';
  if (typeof item === 'string') return item.trim();
  if (typeof item === 'number' || typeof item === 'boolean') return String(item);

  if (Array.isArray(item)) {
    return item.map(formatReportItem).filter(Boolean).join(' · ');
  }

  if (typeof item === 'object') {
    const record = item as Record<string, unknown>;
    const parts = Object.entries(record)
      .map(([key, value]) => {
        const formatted = formatNestedValue(value);
        if (!formatted) return null;
        return `${humanizeKey(key)}: ${formatted}`;
      })
      .filter((part): part is string => Boolean(part));

    return parts.join(' · ');
  }

  return String(item);
}

export function readinessTone(score: number): 'high' | 'medium' | 'low' {
  if (score >= 70) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

export function readinessLabel(score: number): string {
  if (score >= 70) return 'Strong readiness';
  if (score >= 40) return 'Moderate readiness';
  return 'Needs attention';
}
