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
import { getBankDetails, hasWiseCredentials, WiseBankDetails } from '@/lib/wise/client';
import config from '@/lib/config/env';
import { applyRateLimit } from '@/lib/rate-limit';
import { isValidShortCode } from '@/lib/short-code';
import { randomUUID } from 'crypto';

interface WisePaymentInstructions {
  reference: string;
  amount: string;
  currency: string;
  recipient: {
    name: string;
    accountDetails: WiseBankDetails[];
  };
  instructions: {
    type: 'BANK_TRANSFER';
    details: WiseBankDetails | null;
  };
}

/**
 * Generate a stable reference for a payment link.
 * Format: PROVVY-{shortCode} (max 18 chars for bank transfer references)
 */
function generateReference(shortCode: string): string {
  return `PROVVY-${shortCode}`;
}

interface MerchantWiseSettings {
  wise_profile_id: string;
  wise_enabled: boolean;
  wise_currency: string | null;
  display_name: string;
}

/**
 * Validate Wise configuration and return error response if missing.
 */
async function validateWiseConfig(
  organizationId: string
): Promise<{ error: NextResponse } | { merchantSettings: MerchantWiseSettings }> {
  // Check global feature flag
  if (!config.features.wisePayments) {
    return {
      error: NextResponse.json(
        { error: 'Wise payments are not enabled', code: 'WISE_DISABLED' },
        { status: 400 }
      ),
    };
  }

  // Check API token
  if (!hasWiseCredentials()) {
    return {
      error: NextResponse.json(
        { error: 'WISE_API_TOKEN missing; Wise is not configured', code: 'WISE_TOKEN_MISSING' },
        { status: 400 }
      ),
    };
  }

  // Check merchant settings - query all fields and extract what we need
  const merchantSettings = await prisma.merchant_settings.findFirst({
    where: { organization_id: organizationId },
  });

  // Type assertion for fields that may not be in generated types yet (migration pending)
  const settings = merchantSettings as (typeof merchantSettings & {
    wise_profile_id?: string | null;
    wise_enabled?: boolean;
    wise_currency?: string | null;
  }) | null;

  if (!settings?.wise_enabled) {
    return {
      error: NextResponse.json(
        { error: 'Wise is not enabled for this merchant', code: 'WISE_NOT_ENABLED' },
        { status: 400 }
      ),
    };
  }

  if (!settings?.wise_profile_id) {
    return {
      error: NextResponse.json(
        { error: 'Wise profile ID is not configured for this merchant', code: 'WISE_PROFILE_MISSING' },
        { status: 400 }
      ),
    };
  }

  return {
    merchantSettings: {
      wise_profile_id: settings.wise_profile_id,
      wise_enabled: settings.wise_enabled,
      wise_currency: settings.wise_currency ?? null,
      display_name: settings.display_name,
    },
  };
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

  // Validate Wise configuration
  const validation = await validateWiseConfig(paymentLink.organization_id);
  if ('error' in validation) {
    return validation.error;
  }

  const { merchantSettings } = validation;
  const profileId = merchantSettings.wise_profile_id;
  const currency = merchantSettings.wise_currency || paymentLink.currency;
  const reference = generateReference(shortCode);

  // Check if we already have stored instructions in payment_events
  // Use PAYMENT_INITIATED as the event type (PAYMENT_PENDING may not exist in enum yet)
  const existingEvent = await prisma.payment_events.findFirst({
    where: {
      payment_link_id: paymentLink.id,
      payment_method: 'WISE',
    },
    orderBy: { created_at: 'desc' },
  });

  if (existingEvent?.metadata && typeof existingEvent.metadata === 'object') {
    const meta = existingEvent.metadata as Record<string, unknown>;
    if (meta.wise_instructions && meta.wise_reference === reference) {
      return NextResponse.json({
        instructions: meta.wise_instructions,
      });
    }
  }

  // Fetch fresh bank details from Wise
  try {
    const bankDetails = await getBankDetails(profileId, currency);
    const primaryDetails = bankDetails[0] || null;

    const instructions: WisePaymentInstructions = {
      reference,
      amount: paymentLink.amount.toString(),
      currency,
      recipient: {
        name: merchantSettings.display_name,
        accountDetails: bankDetails,
      },
      instructions: {
        type: 'BANK_TRANSFER',
        details: primaryDetails,
      },
    };

    return NextResponse.json({ instructions });
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

  if (paymentLink.status !== 'OPEN') {
    return NextResponse.json({ error: 'Link is not open for payment' }, { status: 400 });
  }

  // Validate Wise configuration
  const validation = await validateWiseConfig(paymentLink.organization_id);
  if ('error' in validation) {
    return validation.error;
  }

  const { merchantSettings } = validation;
  const profileId = merchantSettings.wise_profile_id;
  const currency = merchantSettings.wise_currency || paymentLink.currency;
  const reference = generateReference(shortCode);

  // Check for existing instructions (idempotency)
  const existingEvent = await prisma.payment_events.findFirst({
    where: {
      payment_link_id: paymentLink.id,
      payment_method: 'WISE',
    },
    orderBy: { created_at: 'desc' },
  });

  if (existingEvent?.metadata && typeof existingEvent.metadata === 'object') {
    const meta = existingEvent.metadata as Record<string, unknown>;
    if (meta.wise_instructions && meta.wise_reference === reference) {
      loggers.api.info(`Returning existing Wise instructions (idempotent) for ${shortCode}`);
      return NextResponse.json({
        instructions: meta.wise_instructions,
      });
    }
  }

  // Fetch bank details from Wise API
  try {
    const bankDetails = await getBankDetails(profileId, currency);
    const primaryDetails = bankDetails[0] || null;

    const instructions: WisePaymentInstructions = {
      reference,
      amount: paymentLink.amount.toString(),
      currency,
      recipient: {
        name: merchantSettings.display_name,
        accountDetails: bankDetails,
      },
      instructions: {
        type: 'BANK_TRANSFER',
        details: primaryDetails,
      },
    };

    // Store instructions in payment_events for idempotency
    // Use PAYMENT_INITIATED as the event type
    await prisma.payment_events.create({
      data: {
        id: randomUUID(),
        payment_link_id: paymentLink.id,
        event_type: 'PAYMENT_INITIATED',
        payment_method: 'WISE',
        metadata: {
          wise_reference: reference,
          wise_instructions: JSON.parse(JSON.stringify(instructions)),
          wise_profile_id: profileId,
          created_at: new Date().toISOString(),
        } as object,
        created_at: new Date(),
      },
    });

    loggers.api.info(`Wise payment instructions created for ${shortCode} (ref: ${reference}, currency: ${currency})`);

    return NextResponse.json({ instructions });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to fetch Wise bank details';
    loggers.api.error(`Wise POST bank details failed: ${message} (shortCode: ${shortCode})`);
    return NextResponse.json(
      { error: message, code: 'WISE_API_ERROR' },
      { status: 500 }
    );
  }
}
