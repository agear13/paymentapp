/**
 * Wise payment setup for a payment link (public, no auth).
 * GET: return payer instructions (bank details + reference) for the payment link.
 * POST: generate/store reference and return payer instructions.
 * 
 * Returns REAL bank details when Wise is properly configured.
 * Returns explicit errors when configuration is missing.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/server/prisma';
import { loggers } from '@/lib/logger';
import { hasWiseCredentials } from '@/lib/wise/client';
import { buildWiseReference, getMerchantWiseConfig, persistWiseContextForPaymentLink } from '@/lib/payments/wise';
import { applyRateLimit } from '@/lib/rate-limit';
import { isValidShortCode } from '@/lib/short-code';

/**
 * Validate Wise configuration and return error response if missing.
 */
async function validateWiseConfig(
  organizationId: string,
  fallbackCurrency: string
): Promise<{ error: NextResponse } | { merchantSettings: Awaited<ReturnType<typeof getMerchantWiseConfig>> }> {
  if (!hasWiseCredentials()) {
    return {
      error: NextResponse.json(
        { error: 'WISE_API_TOKEN missing; Wise is not configured', code: 'WISE_TOKEN_MISSING' },
        { status: 400 }
      ),
    };
  }

  try {
    const merchantSettings = await getMerchantWiseConfig(organizationId, fallbackCurrency);
    return { merchantSettings };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Wise is not configured for this merchant';
    return {
      error: NextResponse.json({ error: message, code: 'WISE_CONFIG_ERROR' }, { status: 400 }),
    };
  }
}

function getStoredWiseInstructions(paymentLinkId: string, shortCode: string) {
  return prisma.payment_events.findFirst({
    where: {
      payment_link_id: paymentLinkId,
      payment_method: 'WISE',
      event_type: 'PAYMENT_INITIATED',
    },
    orderBy: { created_at: 'desc' },
  }).then((existingEvent) => {
    const meta = (existingEvent?.metadata && typeof existingEvent.metadata === 'object')
      ? (existingEvent.metadata as Record<string, unknown>)
      : null;
    if (!meta) return null;
    const reference = buildWiseReference(shortCode);
    if (meta.wise_payment_details_snapshot && meta.wise_reference === reference) {
      return meta.wise_payment_details_snapshot;
    }
    return null;
  });
}

/**
 * GET – return payer instructions if this link already has a Wise reference stored
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ shortCode: string }> }
) {
  const rateLimitResult = await applyRateLimit(request, 'public');
  if (!rateLimitResult.success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const { shortCode } = await params;
  if (!isValidShortCode(shortCode)) {
    return NextResponse.json({ error: 'Invalid short code' }, { status: 400 });
  }

  const paymentLink = await prisma.payment_links.findUnique({
    where: { short_code: shortCode },
  });

  if (!paymentLink) {
    return NextResponse.json({ error: 'Payment link not found' }, { status: 404 });
  }
  if (paymentLink.payment_method && paymentLink.payment_method !== 'WISE') {
    return NextResponse.json({ error: 'Wise is not enabled for this payment link' }, { status: 400 });
  }

  // Validate Wise configuration
  const validation = await validateWiseConfig(paymentLink.organization_id, paymentLink.currency);
  if ('error' in validation) {
    return validation.error;
  }

  const stored = await getStoredWiseInstructions(paymentLink.id, shortCode);
  if (stored) {
    return NextResponse.json({ instructions: stored });
  }

  try {
    const context = await persistWiseContextForPaymentLink({
      paymentLinkId: paymentLink.id,
      shortCode,
      amount: paymentLink.amount.toString(),
      organizationId: paymentLink.organization_id,
      fallbackCurrency: paymentLink.currency,
    });
    await prisma.payment_links.update({
      where: { id: paymentLink.id },
      data: { wise_status: 'INSTRUCTIONS_READY', updated_at: new Date() },
    });
    return NextResponse.json({ instructions: context });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to fetch Wise bank details';
    loggers.api.error(`Wise GET bank details failed: ${message} (shortCode: ${shortCode})`);
    return NextResponse.json(
      { error: message, code: 'WISE_API_ERROR' },
      { status: 500 }
    );
  }
}

/**
 * POST – create/store reference and return payer instructions
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ shortCode: string }> }
) {
  const rateLimitResult = await applyRateLimit(request, 'public');
  if (!rateLimitResult.success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const { shortCode } = await params;
  if (!isValidShortCode(shortCode)) {
    return NextResponse.json({ error: 'Invalid short code' }, { status: 400 });
  }

  const paymentLink = await prisma.payment_links.findUnique({
    where: { short_code: shortCode },
  });

  if (!paymentLink) {
    return NextResponse.json({ error: 'Payment link not found' }, { status: 404 });
  }
  if (paymentLink.payment_method && paymentLink.payment_method !== 'WISE') {
    return NextResponse.json({ error: 'Wise is not enabled for this payment link' }, { status: 400 });
  }

  if (paymentLink.status !== 'OPEN') {
    return NextResponse.json({ error: 'Link is not open for payment' }, { status: 400 });
  }

  // Validate Wise configuration
  const validation = await validateWiseConfig(paymentLink.organization_id, paymentLink.currency);
  if ('error' in validation) {
    return validation.error;
  }

  const stored = await getStoredWiseInstructions(paymentLink.id, shortCode);
  if (stored) {
    loggers.api.info(`Returning existing Wise instructions (idempotent) for ${shortCode}`);
    return NextResponse.json({ instructions: stored });
  }

  try {
    const context = await persistWiseContextForPaymentLink({
      paymentLinkId: paymentLink.id,
      shortCode,
      amount: paymentLink.amount.toString(),
      organizationId: paymentLink.organization_id,
      fallbackCurrency: paymentLink.currency,
    });
    loggers.api.info(`Wise payment instructions created for ${shortCode} (ref: ${context.reference}, currency: ${context.currency})`);
    return NextResponse.json({ instructions: context });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to fetch Wise bank details';
    loggers.api.error(`Wise POST bank details failed: ${message} (shortCode: ${shortCode})`);
    return NextResponse.json(
      { error: message, code: 'WISE_API_ERROR' },
      { status: 500 }
    );
  }
}
