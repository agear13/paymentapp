/**
 * IP Whitelist for Webhooks
 * 
 * Validates that webhook requests come from trusted sources
 * Prevents unauthorized webhook calls
 */

import { NextRequest } from 'next/server';
import { log } from '@/lib/logger';

/**
 * Stripe webhook IP ranges
 * Source: https://stripe.com/docs/ips
 */
const STRIPE_IP_RANGES = [
  '3.18.12.63',
  '3.130.192.231',
  '13.235.14.237',
  '13.235.122.149',
  '18.211.135.69',
  '35.154.171.200',
  '52.15.183.38',
  '54.88.130.119',
  '54.88.130.237',
  '54.187.174.169',
  '54.187.205.235',
  '54.187.216.72',
];

/**
 * Vercel/deployment platform IPs (if applicable)
 * Add your deployment platform's IP ranges here
 */
const PLATFORM_IP_RANGES: string[] = [
  // Add trusted platform IPs
];

/**
 * Custom webhook sources (development, testing)
 */
const CUSTOM_WEBHOOK_IPS: string[] = 
  process.env.WEBHOOK_ALLOWED_IPS?.split(',').map(ip => ip.trim()) || [];

/**
 * Extract client IP from request
 */
function getClientIP(request: NextRequest): string | null {
  // Try various headers in order of preference
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  const cfConnectingIp = request.headers.get('cf-connecting-ip');
  if (cfConnectingIp) {
    return cfConnectingIp;
  }

  return request.ip || null;
}

/**
 * Check if IP is in a CIDR range
 */
function isIPInCIDR(ip: string, cidr: string): boolean {
  // Simple implementation - for production, use a library like 'ip-range-check'
  if (!cidr.includes('/')) {
    // Exact IP match
    return ip === cidr;
  }

  // For CIDR ranges, you'd need to implement proper subnet matching
  // For now, return false and log warning
  log.warn({ ip, cidr }, 'CIDR range checking not fully implemented');
  return false;
}

/**
 * Check if IP is whitelisted for Stripe webhooks
 */
export function isStripeIPWhitelisted(ip: string): boolean {
  // In development, allow all IPs
  if (process.env.NODE_ENV === 'development') {
    return true;
  }

  return STRIPE_IP_RANGES.some(allowedIP => {
    return ip === allowedIP || isIPInCIDR(ip, allowedIP);
  });
}

/**
 * Check if IP is whitelisted for custom webhooks
 */
export function isCustomIPWhitelisted(ip: string): boolean {
  // In development, allow all IPs
  if (process.env.NODE_ENV === 'development') {
    return true;
  }

  return CUSTOM_WEBHOOK_IPS.some(allowedIP => {
    return ip === allowedIP || isIPInCIDR(ip, allowedIP);
  });
}

/**
 * Validate webhook IP address
 * 
 * @param request - The incoming webhook request
 * @param source - The webhook source (stripe, xero, custom)
 * @returns Object with validation result and IP address
 */
export function validateWebhookIP(
  request: NextRequest,
  source: 'stripe' | 'xero' | 'custom' = 'stripe'
): {
  allowed: boolean;
  ip: string | null;
  reason?: string;
} {
  const ip = getClientIP(request);

  if (!ip) {
    log.warn({ source }, 'Webhook IP validation failed: No IP address found');
    return {
      allowed: false,
      ip: null,
      reason: 'No IP address found in request',
    };
  }

  let allowed = false;
  let reason = '';

  switch (source) {
    case 'stripe':
      allowed = isStripeIPWhitelisted(ip);
      reason = allowed ? '' : 'IP not in Stripe whitelist';
      break;

    case 'custom':
      allowed = isCustomIPWhitelisted(ip);
      reason = allowed ? '' : 'IP not in custom whitelist';
      break;

    default:
      // For unknown sources, default to deny
      allowed = false;
      reason = 'Unknown webhook source';
  }

  if (!allowed) {
    log.warn({
      source,
      ip,
      reason,
    }, 'Webhook IP validation failed');
  }

  return { allowed, ip, reason };
}

/**
 * Middleware for webhook IP validation
 * Use this before signature verification
 * 
 * @param request - The incoming request
 * @param source - The webhook source
 * @returns True if IP is allowed, false otherwise
 */
export function webhookIPMiddleware(
  request: NextRequest,
  source: 'stripe' | 'xero' | 'custom' = 'stripe'
): boolean {
  const validation = validateWebhookIP(request, source);

  if (!validation.allowed) {
    log.warn({
      source,
      ip: validation.ip,
      path: new URL(request.url).pathname,
      userAgent: request.headers.get('user-agent'),
    }, 'Blocked webhook request from unauthorized IP');
  }

  return validation.allowed;
}

/**
 * Log webhook access attempts (successful and failed)
 */
export function logWebhookAccess(
  request: NextRequest,
  source: string,
  allowed: boolean,
  authenticated: boolean
) {
  const ip = getClientIP(request);
  const pathname = new URL(request.url).pathname;

  log.info({
    source,
    ip,
    path: pathname,
    method: request.method,
    allowed,
    authenticated,
    userAgent: request.headers.get('user-agent'),
    timestamp: new Date().toISOString(),
  }, `Webhook access ${allowed && authenticated ? 'granted' : 'denied'}`);
}







