const PII_PARAM_KEYS = new Set([
  'email',
  'e-mail',
  'name',
  'full_name',
  'phone',
  'user_id',
  'userId',
]);

export const JARVIS_GA_EVENTS = {
  landingView: 'jarvis_landing_view',
  waitlistStarted: 'jarvis_waitlist_started',
  waitlistSubmitted: 'jarvis_waitlist_submitted',
  waitlistSuccess: 'jarvis_waitlist_success',
} as const;

export type GaEventParams = Record<string, string | number | boolean>;

export const sanitizeGaEventParams = (params?: GaEventParams): GaEventParams | undefined => {
  if (!params) return undefined;
  const sanitized: GaEventParams = {};
  for (const [key, value] of Object.entries(params)) {
    if (PII_PARAM_KEYS.has(key.toLowerCase())) continue;
    if (typeof value === 'string' && value.includes('@')) continue;
    sanitized[key] = value;
  }
  return sanitized;
};

export const trackGaEvent = (eventName: string, params?: GaEventParams): void => {
  if (typeof window === 'undefined') return;
  const gtag = (window as Window & { gtag?: (...args: unknown[]) => void }).gtag;
  if (typeof gtag !== 'function') return;
  gtag('event', eventName, sanitizeGaEventParams(params));
};
