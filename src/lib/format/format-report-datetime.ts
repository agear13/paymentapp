/**
 * Standard report timestamp: "20 May 2026, 1:20 PM"
 */
export function formatReportDateTime(
  value: Date | string | number,
  options?: { timeZone?: string }
): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  const formatted = new Intl.DateTimeFormat('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: options?.timeZone,
  }).format(date);

  return formatted.replace(/\b(am|pm)\b/g, (m) => m.toUpperCase());
}
