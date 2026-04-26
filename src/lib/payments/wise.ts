import { randomUUID } from 'crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/server/prisma';
import { getBankDetails, hasWiseCredentials, type WiseBankDetails } from '@/lib/wise/client';
import config from '@/lib/config/env';

export interface MerchantWiseConfig {
  wiseProfileId: string;
  wiseCurrency: string;
  merchantDisplayName: string;
}

export interface WisePaymentContext {
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
  metadata: {
    wise_reference: string;
    wise_profile_id_used: string;
    wise_currency_used: string;
    wise_payment_status: string;
    wise_payment_details_snapshot: unknown;
    wise_context_created_at: string;
  };
}

export function buildWiseReference(shortCode: string): string {
  return `PROVVY-${shortCode}`;
}

export async function getMerchantWiseConfig(organizationId: string, fallbackCurrency: string): Promise<MerchantWiseConfig> {
  if (!config.features.wisePayments) {
    throw new Error('Wise payments are not enabled');
  }
  if (!hasWiseCredentials()) {
    throw new Error('WISE_API_TOKEN missing; Wise is not configured');
  }

  const merchantSettings = await prisma.merchant_settings.findFirst({
    where: { organization_id: organizationId },
    select: {
      display_name: true,
      wise_enabled: true,
      wise_profile_id: true,
      wise_currency: true,
    },
  });

  if (!merchantSettings?.wise_enabled || !merchantSettings?.wise_profile_id) {
    throw new Error('Wise is not configured for this merchant');
  }

  return {
    wiseProfileId: merchantSettings.wise_profile_id,
    wiseCurrency: merchantSettings.wise_currency || fallbackCurrency,
    merchantDisplayName: merchantSettings.display_name,
  };
}

export async function buildWisePaymentContext(input: {
  shortCode: string;
  amount: string;
  organizationId: string;
  fallbackCurrency: string;
}): Promise<WisePaymentContext> {
  const merchant = await getMerchantWiseConfig(input.organizationId, input.fallbackCurrency);
  const bankDetails = await getBankDetails(merchant.wiseProfileId, merchant.wiseCurrency);
  const details = bankDetails[0] || null;
  const reference = buildWiseReference(input.shortCode);

  const instructions = {
    reference,
    amount: input.amount,
    currency: merchant.wiseCurrency,
    recipient: {
      name: merchant.merchantDisplayName,
      accountDetails: bankDetails,
    },
    instructions: {
      type: 'BANK_TRANSFER' as const,
      details,
    },
  };

  return {
    ...instructions,
    metadata: {
      wise_reference: reference,
      wise_profile_id_used: merchant.wiseProfileId,
      wise_currency_used: merchant.wiseCurrency,
      wise_payment_status: 'INSTRUCTIONS_READY',
      wise_payment_details_snapshot: instructions,
      wise_context_created_at: new Date().toISOString(),
    },
  };
}

export async function persistWiseContextForPaymentLink(input: {
  paymentLinkId: string;
  shortCode: string;
  amount: string;
  organizationId: string;
  fallbackCurrency: string;
}): Promise<WisePaymentContext> {
  const context = await buildWisePaymentContext({
    shortCode: input.shortCode,
    amount: input.amount,
    organizationId: input.organizationId,
    fallbackCurrency: input.fallbackCurrency,
  });

  await prisma.$transaction(async (tx) => {
    await tx.payment_links.update({
      where: { id: input.paymentLinkId },
      data: {
        wise_status: 'INSTRUCTIONS_READY',
        updated_at: new Date(),
      },
    });

    await tx.payment_events.create({
      data: {
        id: randomUUID(),
        payment_link_id: input.paymentLinkId,
        event_type: 'PAYMENT_INITIATED',
        payment_method: 'WISE',
        metadata: context.metadata as Prisma.InputJsonValue,
        created_at: new Date(),
      },
    });
  });

  return context;
}
