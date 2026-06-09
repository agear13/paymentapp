import 'server-only';

import crypto from 'crypto';

const DEFAULT_CALENDLY_DEMO_URL = 'https://calendly.com/provvypay/demo';
const TRACKING_TOKEN_TTL_SECONDS = 90 * 24 * 60 * 60;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type CalendlyTrackingPayload = {
  leadId: string;
  reportId: string;
  overallScore: number | null;
  priorityBand: string | null;
  recommendedUseCase: string | null;
};

type SignedCalendlyTrackingPayload = CalendlyTrackingPayload & {
  iat: number;
};

function getCalendlyTrackingSecret(): string {
  const secret =
    process.env.AGREEMENT_ANALYZER_TRACKING_SECRET ||
    process.env.SESSION_SECRET ||
    process.env.CSRF_SECRET;

  if (!secret) {
    throw new Error('Calendly tracking secret is not configured');
  }

  return secret;
}

function encodePayload(payload: SignedCalendlyTrackingPayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

function signEncodedPayload(encodedPayload: string): string {
  return crypto.createHmac('sha256', getCalendlyTrackingSecret()).update(encodedPayload).digest('base64url');
}

function isValidTrackingPayload(payload: SignedCalendlyTrackingPayload): payload is SignedCalendlyTrackingPayload {
  if (!UUID_PATTERN.test(payload.leadId) || !UUID_PATTERN.test(payload.reportId)) {
    return false;
  }

  if (payload.overallScore != null && (!Number.isInteger(payload.overallScore) || payload.overallScore < 0)) {
    return false;
  }

  if (payload.priorityBand != null && typeof payload.priorityBand !== 'string') {
    return false;
  }

  if (payload.recommendedUseCase != null && typeof payload.recommendedUseCase !== 'string') {
    return false;
  }

  return typeof payload.iat === 'number';
}

export function createCalendlyTrackingToken(payload: CalendlyTrackingPayload): string {
  const signedPayload: SignedCalendlyTrackingPayload = {
    ...payload,
    iat: Math.floor(Date.now() / 1000),
  };

  const encodedPayload = encodePayload(signedPayload);
  const signature = signEncodedPayload(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export function parseCalendlyTrackingToken(token: string): CalendlyTrackingPayload | null {
  const [encodedPayload, signature] = token.trim().split('.');
  if (!encodedPayload || !signature) return null;

  const expectedSignature = signEncodedPayload(encodedPayload);
  const provided = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);

  if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf8')
    ) as SignedCalendlyTrackingPayload;

    if (!isValidTrackingPayload(parsed)) return null;

    const ageSeconds = Math.floor(Date.now() / 1000) - parsed.iat;
    if (ageSeconds < 0 || ageSeconds > TRACKING_TOKEN_TTL_SECONDS) return null;

    return {
      leadId: parsed.leadId,
      reportId: parsed.reportId,
      overallScore: parsed.overallScore,
      priorityBand: parsed.priorityBand,
      recommendedUseCase: parsed.recommendedUseCase,
    };
  } catch {
    return null;
  }
}

export function buildCalendlyDemoUrl(trackingToken: string): string {
  const baseUrl = process.env.AGREEMENT_ANALYZER_DEMO_URL?.trim() || DEFAULT_CALENDLY_DEMO_URL;
  const url = new URL(baseUrl);
  url.searchParams.set('tracking', trackingToken);
  // Calendly forwards UTM params into webhook tracking metadata.
  url.searchParams.set('utm_content', trackingToken);
  return url.toString();
}

export function buildCalendlyDemoBookingLink(
  payload: CalendlyTrackingPayload
): { url: string; trackingToken: string } {
  const trackingToken = createCalendlyTrackingToken(payload);
  return {
    trackingToken,
    url: buildCalendlyDemoUrl(trackingToken),
  };
}
