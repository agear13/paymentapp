/**
 * Commission posting for referral revenue share (Option B).
 * Posts ledger entries for consultant and BD partner commissions.
 * Best-effort, idempotent, webhook-safe.
 */

import Stripe from 'stripe';
import { prisma } from '@/lib/server/prisma';
import { LedgerEntryService } from '@/lib/ledger/ledger-entry-service';
import { provisionCommissionLedgerAccounts } from '@/lib/ledger/ledger-account-provisioner';
import { LEDGER_ACCOUNTS } from '@/lib/ledger/account-mapping';
import { calculateStripeFee } from '@/lib/ledger/posting-rules/stripe';
import { log } from '@/lib/logger';

export interface ReferralMetadata {
  referralLinkId: string;
  referralCode: string;
  consultantId: string;
  bdPartnerId: string | null;
  consultantPct: number;
  bdPartnerPct: number;
  commissionBasis: 'GROSS' | 'NET';
}

export interface ApplyRevenueShareSplitsParams {
  session: Stripe.Checkout.Session;
  stripeEventId: string;
  paymentLinkId: string;
  organizationId: string;
  grossAmount: number; // decimal
  currency: string;
  correlationId?: string;
}

/**
 * Extract referral metadata from Stripe session.
 * Returns null if not a commission-enabled session.
 */
export function extractReferralMetadata(
  metadata?: Stripe.Metadata | null
): ReferralMetadata | null {
  if (!metadata?.referral_link_id || !metadata?.consultant_id) {
    return null;
  }

  const consultantPct = parseFloat(metadata.consultant_pct as string) || 0;
  const bdPartnerPct = parseFloat(metadata.bd_partner_pct as string) || 0;

  if (consultantPct <= 0 && bdPartnerPct <= 0) {
    return null;
  }

  return {
    referralLinkId: metadata.referral_link_id,
    referralCode: metadata.referral_code || '',
    consultantId: metadata.consultant_id,
    bdPartnerId: metadata.bd_partner_id || null,
    consultantPct,
    bdPartnerPct,
    commissionBasis: (metadata.commission_basis as 'GROSS' | 'NET') || 'GROSS',
  };
}

/**
 * Apply revenue share splits: post ledger entries for consultant and BD partner commissions.
 * Best-effort: does not throw; logs errors and creates SYSTEM_ALERT.
 */
export async function applyRevenueShareSplits(
  params: ApplyRevenueShareSplitsParams
): Promise<{ posted: boolean; consultantAmount?: number; bdPartnerAmount?: number }> {
  const {
    session,
    stripeEventId,
    paymentLinkId,
    organizationId,
    grossAmount,
    currency,
    correlationId,
  } = params;

  const meta = extractReferralMetadata(session.metadata);
  if (!meta) {
    log.info(
      { stripeEventId, paymentLinkId },
      'Commission skipped: no referral metadata'
    );
    return { posted: false };
  }

  const basisAmount =
    meta.commissionBasis === 'NET'
      ? grossAmount - parseFloat(calculateStripeFee(Math.round(grossAmount * 100), currency))
      : grossAmount;

  let consultantAmount = basisAmount * meta.consultantPct;
  let bdPartnerAmount = meta.bdPartnerId ? basisAmount * meta.bdPartnerPct : 0;

  if (consultantAmount < 0) consultantAmount = 0;
  if (bdPartnerAmount < 0) bdPartnerAmount = 0;

  if (consultantAmount < 0.01 && bdPartnerAmount < 0.01) {
    log.info(
      { stripeEventId, paymentLinkId, consultantAmount, bdPartnerAmount },
      'Commission skipped: amounts below minimum'
    );
    return { posted: false };
  }

  try {
    await provisionCommissionLedgerAccounts(prisma, organizationId, correlationId);
  } catch (provisionErr: any) {
    log.error(
      { correlationId, organizationId, error: provisionErr?.message },
      'Commission accounts provisioned failed'
    );
    await createCommissionFailureAlert(organizationId, paymentLinkId, provisionErr?.message, correlationId);
    return { posted: false };
  }

  const ledgerService = new LedgerEntryService();
  const currencyUpper = currency.toUpperCase();

  // Post consultant commission
  if (consultantAmount >= 0.01) {
    try {
      log.info(
        { correlationId, consultantId: meta.consultantId, amount: consultantAmount },
        'Posting consultant commission'
      );

      const consultantEntries = [
        {
          accountCode: LEDGER_ACCOUNTS.COMMISSION_EXPENSE,
          entryType: 'DEBIT' as const,
          amount: consultantAmount.toFixed(2),
          currency: currencyUpper,
          description: `Consultant commission (${meta.referralCode}) - ${consultantAmount.toFixed(2)} ${currencyUpper}`,
        },
        {
          accountCode: LEDGER_ACCOUNTS.CONSULTANT_PAYABLE,
          entryType: 'CREDIT' as const,
          amount: consultantAmount.toFixed(2),
          currency: currencyUpper,
          description: `Consultant payable (${meta.referralCode}) - ${consultantAmount.toFixed(2)} ${currencyUpper}`,
        },
      ];

      await ledgerService.postJournalEntries({
        entries: consultantEntries,
        paymentLinkId,
        organizationId,
        idempotencyKey: `commission-${stripeEventId}-consultant`,
        correlationId,
      });

      log.info(
        { correlationId, consultantAmount },
        'Commission posted successfully (consultant)'
      );
    } catch (err: any) {
      log.error(
        { correlationId, consultantId: meta.consultantId, error: err?.message },
        'Commission posting failed (will retry)'
      );
      await createCommissionFailureAlert(organizationId, paymentLinkId, err?.message, correlationId);
      return { posted: false };
    }
  }

  // Post BD partner commission
  if (bdPartnerAmount >= 0.01) {
    try {
      log.info(
        { correlationId, bdPartnerId: meta.bdPartnerId, amount: bdPartnerAmount },
        'Posting BD partner commission'
      );

      const bdEntries = [
        {
          accountCode: LEDGER_ACCOUNTS.COMMISSION_EXPENSE,
          entryType: 'DEBIT' as const,
          amount: bdPartnerAmount.toFixed(2),
          currency: currencyUpper,
          description: `BD partner commission (${meta.referralCode}) - ${bdPartnerAmount.toFixed(2)} ${currencyUpper}`,
        },
        {
          accountCode: LEDGER_ACCOUNTS.BD_PARTNER_PAYABLE,
          entryType: 'CREDIT' as const,
          amount: bdPartnerAmount.toFixed(2),
          currency: currencyUpper,
          description: `BD partner payable (${meta.referralCode}) - ${bdPartnerAmount.toFixed(2)} ${currencyUpper}`,
        },
      ];

      await ledgerService.postJournalEntries({
        entries: bdEntries,
        paymentLinkId,
        organizationId,
        idempotencyKey: `commission-${stripeEventId}-bd`,
        correlationId,
      });

      log.info(
        { correlationId, bdPartnerAmount },
        'Commission posted successfully (BD partner)'
      );
    } catch (err: any) {
      log.error(
        { correlationId, bdPartnerId: meta.bdPartnerId, error: err?.message },
        'Commission posting failed (will retry)'
      );
      await createCommissionFailureAlert(organizationId, paymentLinkId, err?.message, correlationId);
      return { posted: false };
    }
  }

  // Persist commission obligation (optional audit trail)
  try {
    await prisma.commission_obligations.create({
      data: {
        payment_link_id: paymentLinkId,
        referral_link_id: meta.referralLinkId,
        stripe_event_id: stripeEventId,
        consultant_amount: consultantAmount,
        bd_partner_amount: bdPartnerAmount,
        currency: currencyUpper,
        status: 'POSTED',
        correlation_id: correlationId || undefined,
      },
    });
  } catch (obligErr: any) {
    if (obligErr?.code === 'P2002') {
      log.info({ stripeEventId }, 'Commission obligation already exists (idempotent)');
    } else {
      log.warn({ error: obligErr?.message }, 'Commission obligation create failed (non-blocking)');
    }
  }

  return {
    posted: true,
    consultantAmount,
    bdPartnerAmount,
  };
}

async function createCommissionFailureAlert(
  organizationId: string,
  paymentLinkId: string,
  errorMessage: string,
  correlationId?: string
) {
  try {
    await prisma.notifications.create({
      data: {
        organization_id: organizationId,
        type: 'SYSTEM_ALERT',
        title: 'Commission posting failed',
        message: `Commission posting failed for payment. Correlation ID: ${correlationId || 'N/A'}. Error: ${errorMessage || 'Unknown'}. Will retry on webhook redelivery.`,
        data: {
          paymentLinkId,
          correlationId,
          error: errorMessage,
        },
      },
    });
  } catch (notifErr: any) {
    log.warn({ notifError: notifErr?.message }, 'Could not create commission failure notification');
  }
}
