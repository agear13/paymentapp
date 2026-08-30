import { NextRequest, NextResponse } from 'next/server';
import { jarvisWaitlistBodySchema } from '@/lib/marketing/jarvis-waitlist';
import {
  JarvisWaitlistConsentError,
  joinJarvisWaitlist,
} from '@/lib/marketing/join-jarvis-waitlist.server';
import { applyRateLimit, getClientIdentifier } from '@/lib/rate-limit';
import { getTurnstileConfig, verifyTurnstileToken } from '@/lib/auth/turnstile.server';

const SUCCESS_MESSAGE = "You're on the Jarvis waitlist. We'll be in touch.";
const INVALID_EMAIL_MESSAGE = 'Enter a valid email address.';
const CONSENT_REQUIRED_MESSAGE =
  'Please agree to the Privacy Policy and being contacted about Jarvis.';
const GENERIC_ERROR_MESSAGE = 'Something went wrong. Please try again.';
const TURNSTILE_FAILED_MESSAGE = 'Security verification failed. Please try again.';

export async function POST(request: NextRequest) {
  const rateLimitResult = await applyRateLimit(request, 'public');
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again shortly.' },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: INVALID_EMAIL_MESSAGE }, { status: 400 });
  }

  const parsed = jarvisWaitlistBodySchema.safeParse(body);
  if (!parsed.success) {
    const consentInvalid = parsed.error.issues.some((issue) => issue.path.includes('consent'));
    return NextResponse.json(
      { error: consentInvalid ? CONSENT_REQUIRED_MESSAGE : INVALID_EMAIL_MESSAGE },
      { status: 400 }
    );
  }

  const turnstile = getTurnstileConfig();
  if (turnstile.enabled) {
    const ip = getClientIdentifier(request);
    const valid = await verifyTurnstileToken(parsed.data.turnstileToken, ip);
    if (!valid) {
      return NextResponse.json(
        { error: TURNSTILE_FAILED_MESSAGE, turnstileRequired: true },
        { status: 400 }
      );
    }
  }

  try {
    await joinJarvisWaitlist({
      email: parsed.data.email,
      consent: parsed.data.consent,
    });
    return NextResponse.json({ ok: true, message: SUCCESS_MESSAGE });
  } catch (error) {
    if (error instanceof JarvisWaitlistConsentError) {
      return NextResponse.json({ error: CONSENT_REQUIRED_MESSAGE }, { status: 400 });
    }
    console.error('[jarvis/waitlist]', error);
    return NextResponse.json({ error: GENERIC_ERROR_MESSAGE }, { status: 500 });
  }
}
