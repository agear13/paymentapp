import 'server-only';

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import {
  checkRateLimit,
  getClientIdentifier,
  getRateLimitHeaders,
} from '@/lib/rate-limit';

const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

export const authRateLimiters = {
  registerHourly: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(5, '1 h'),
        prefix: 'ratelimit:auth:register:hour',
        analytics: false,
      })
    : null,

  registerDaily: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(20, '24 h'),
        prefix: 'ratelimit:auth:register:day',
        analytics: false,
      })
    : null,

  passwordReset: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(5, '1 h'),
        prefix: 'ratelimit:auth:password-reset',
        analytics: false,
      })
    : null,

  resendVerification: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(10, '1 h'),
        prefix: 'ratelimit:auth:resend-verification',
        analytics: false,
      })
    : null,
};

const RESEND_COOLDOWN_SECONDS = Number.parseInt(
  process.env.AUTH_VERIFICATION_RESEND_COOLDOWN_SECONDS || '60',
  10
);

const LOGIN_MAX_FAILURES = Number.parseInt(process.env.AUTH_LOGIN_MAX_FAILURES || '5', 10);

function emailKey(email: string): string {
  return createHash('sha256').update(email.trim().toLowerCase()).digest('hex').slice(0, 24);
}

function loginFailKey(email: string, ip: string): string {
  return `${emailKey(email)}:${ip}`;
}

export async function checkRegistrationRateLimit(request: Request) {
  const ip = getClientIdentifier(request);
  const hourly = await checkRateLimit(authRateLimiters.registerHourly, ip);
  if (!hourly.success) {
    return { allowed: false as const, retryAfterSeconds: secondsUntilReset(hourly.reset), ip };
  }

  const daily = await checkRateLimit(authRateLimiters.registerDaily, ip);
  if (!daily.success) {
    return { allowed: false as const, retryAfterSeconds: secondsUntilReset(daily.reset), ip };
  }

  return { allowed: true as const, ip };
}

export async function checkPasswordResetRateLimit(request: Request) {
  const ip = getClientIdentifier(request);
  const result = await checkRateLimit(authRateLimiters.passwordReset, ip);
  if (!result.success) {
    return { allowed: false as const, retryAfterSeconds: secondsUntilReset(result.reset) };
  }
  return { allowed: true as const };
}

export async function checkResendVerificationRateLimit(request: Request, userId: string) {
  const ip = getClientIdentifier(request);
  const hourly = await checkRateLimit(authRateLimiters.resendVerification, `${userId}:${ip}`);
  if (!hourly.success) {
    return { allowed: false as const, retryAfterSeconds: secondsUntilReset(hourly.reset) };
  }
  return { allowed: true as const };
}

export async function getVerificationResendCooldownRemaining(userId: string): Promise<number> {
  if (!redis) return 0;
  const key = `auth:verify:resend:cooldown:${userId}`;
  const ttl = await redis.ttl(key);
  return ttl > 0 ? ttl : 0;
}

export async function setVerificationResendCooldown(userId: string): Promise<void> {
  if (!redis) return;
  const key = `auth:verify:resend:cooldown:${userId}`;
  await redis.set(key, '1', { ex: RESEND_COOLDOWN_SECONDS });
}

export async function recordLoginFailure(email: string, ip: string): Promise<{
  locked: boolean;
  retryAfterSeconds: number;
  failureCount: number;
}> {
  if (!redis) {
    return { locked: false, retryAfterSeconds: 0, failureCount: 0 };
  }

  const key = `auth:login:fail:${loginFailKey(email, ip)}`;
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, 60 * 60);
  }

  if (count >= LOGIN_MAX_FAILURES) {
    const lockSeconds = computeLoginLockoutSeconds(count);
    const lockKey = `auth:login:lock:${loginFailKey(email, ip)}`;
    await redis.set(lockKey, String(count), { ex: lockSeconds });
    return { locked: true, retryAfterSeconds: lockSeconds, failureCount: count };
  }

  return { locked: false, retryAfterSeconds: 0, failureCount: count };
}

export async function getLoginLockoutRemaining(
  email: string,
  ip: string
): Promise<{ locked: boolean; retryAfterSeconds: number; failureCount: number }> {
  if (!redis) {
    return { locked: false, retryAfterSeconds: 0, failureCount: 0 };
  }

  const lockKey = `auth:login:lock:${loginFailKey(email, ip)}`;
  const ttl = await redis.ttl(lockKey);
  if (ttl > 0) {
    const failKey = `auth:login:fail:${loginFailKey(email, ip)}`;
    const countRaw = await redis.get<number>(failKey);
    return {
      locked: true,
      retryAfterSeconds: ttl,
      failureCount: typeof countRaw === 'number' ? countRaw : LOGIN_MAX_FAILURES,
    };
  }

  return { locked: false, retryAfterSeconds: 0, failureCount: 0 };
}

export async function clearLoginFailures(email: string, ip: string): Promise<void> {
  if (!redis) return;
  await redis.del(
    `auth:login:fail:${loginFailKey(email, ip)}`,
    `auth:login:lock:${loginFailKey(email, ip)}`
  );
}

export async function incrementAuthFailureCounter(scope: 'signup' | 'login' | 'reset', ip: string) {
  if (!redis) return 0;
  const key = `auth:failures:${scope}:${ip}`;
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, 60 * 60);
  }
  return count;
}

export async function getAuthFailureCounter(scope: 'signup' | 'login' | 'reset', ip: string) {
  if (!redis) return 0;
  const value = await redis.get<number>(`auth:failures:${scope}:${ip}`);
  return typeof value === 'number' ? value : 0;
}

function computeLoginLockoutSeconds(failureCount: number): number {
  const base = 15 * 60;
  const exponent = Math.min(failureCount - LOGIN_MAX_FAILURES, 4);
  return base * 2 ** exponent;
}

function secondsUntilReset(resetMs: number): number {
  return Math.max(1, Math.ceil((resetMs - Date.now()) / 1000));
}

export function rateLimit429Response(message: string, retryAfterSeconds: number) {
  return NextResponse.json(
    { error: message, retryAfterSeconds },
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfterSeconds),
        ...getRateLimitHeaders({
          limit: 0,
          remaining: 0,
          reset: Date.now() + retryAfterSeconds * 1000,
        }),
      },
    }
  );
}

export { RESEND_COOLDOWN_SECONDS, LOGIN_MAX_FAILURES };
