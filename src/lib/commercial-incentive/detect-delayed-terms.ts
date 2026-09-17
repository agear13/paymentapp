const DELAYED_PATTERNS: Array<{ re: RegExp; group: number }> = [
  { re: /\bnet\s*[- ]?(\d{1,3})\b/i, group: 1 },
  {
    re: /\b(\d{1,3})\s*days?\s+after\s+(?:each\s+)?(?:delivery|invoice|milestone|batch|instalment|installment)\b/i,
    group: 1,
  },
  { re: /\b(?:due|paid|payment)\s+(?:within\s+|in\s+)?(\d{1,3})\s*days\b/i, group: 1 },
];

const EXISTING_EARLY_DISCOUNT_RE =
  /\bearly[ -]?pay|\bprompt[ -]?pay|\b(\d+(?:\.\d+)?)\s*%\s*(?:off|discount).{0,40}\b(\d{1,3})\s*days|\bwithin\s*(\d{1,3})\s*days.{0,40}\b(\d+(?:\.\d+)?)\s*%/i;

export function combineTermText(
  description: string | null | undefined,
  dueCondition: string | null | undefined
): string {
  return `${description ?? ''} ${dueCondition ?? ''}`.replace(/\s+/g, ' ').trim();
}

export function parseDelayedPaymentDays(text: string | null | undefined): number | null {
  const value = text?.trim();
  if (!value) return null;

  for (const pattern of DELAYED_PATTERNS) {
    const match = value.match(pattern.re);
    const raw = match?.[pattern.group];
    if (!raw) continue;
    const days = Number.parseInt(raw, 10);
    if (Number.isInteger(days) && days > 0) return days;
  }

  return null;
}

export function textAlreadyHasEarlyPaymentDiscount(text: string | null | undefined): boolean {
  return Boolean(text?.trim() && EXISTING_EARLY_DISCOUNT_RE.test(text));
}
