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
 * Normalize commission percentage: "10" (meaning 10%) -> 0.10, "0.1" stays 0.1
 */
function normalizeCommissionPct(value: unknown): number {
  const num = typeof value === 'number' ? value : Number(String(value ?? ''));
  if (Number.isNaN(num)) return 0;
  return num > 1 ? num / 100 : num;
}

/**
 * Safe conversion to number for fee strings
 */
function toNumberSafe(value: unknown): number {
  if (typeof value === 'number' && !Number.isNaN(value)) return value;
  const num = Number(String(value ?? ''));
  return Number.isNaN(num) ? 0 : num;
}

/**
 * Extract referral metadata from Stripe session.
 * Returns null if not a commission-enabled session.
 */
export function extractReferralMetadata(
  metadata?: Stripe.Metadata | null
): ReferralMetadata | null {
  if (!metadata?.referral_link_id) {
    return null;
  }

  const consultantPct = normalizeCommissionPct(metadata.consultant_pct);
  const bdPartnerPct = normalizeCommissionPct(metadata.bd_partner_pct);

  if (consultantPct <= 0 && bdPartnerPct <= 0) {
    return null;
  }

  // consultant_id required when consultant_pct > 0
  const consultantId = metadata.consultant_id || '';
  if (consultantPct > 0 && !consultantId) {
    return null;
  }

  return {
    referralLinkId: metadata.referral_link_id,
    referralCode: metadata.referral_code || '',
    consultantId: consultantId || '',
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

  try {
    return await applyRevenueShareSplitsInternal(params);
  } catch (err: any) {
    log.error(
      { correlationId, paymentLinkId, stripeEventId, error: err?.message },
      'Commission posting unexpected error (webhook-safe, returning 200)'
    );
    await createCommissionFailureAlert(organizationId, paymentLinkId, err?.message, correlationId);
    return { posted: false };
  }
}

async function applyRevenueShareSplitsInternal(
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

  // NET basis: grossAmount is major units (e.g. 100.00); fee is computed from cents, returned as major units
  let basisAmount: number;
  if (meta.commissionBasis === 'NET') {
    const amountInCents = Math.round(grossAmount * 100);
    const feeStr = calculateStripeFee(amountInCents, currency);
    const feeMajor = toNumberSafe(feeStr);
    basisAmount = Math.max(0, grossAmount - feeMajor);
  } else {
    basisAmount = grossAmount;
  }

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

      const consultantResult = await ledgerService.postJournalEntries({
        entries: consultantEntries,
        paymentLinkId,
        organizationId,
        idempotencyKey: `commission-${stripeEventId}-consultant`,
        correlationId,
      });

      if (consultantResult.entriesPosted === 0) {
        log.info(
          { correlationId, idempotencyKey: `commission-${stripeEventId}-consultant` },
          'Commission consultant entries already exist (idempotent retry)'
        );
      } else {
        log.info(
          { correlationId, consultantAmount },
          'Commission posted successfully (consultant)'
        );
      }
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

      const bdResult = await ledgerService.postJournalEntries({
        entries: bdEntries,
        paymentLinkId,
        organizationId,
        idempotencyKey: `commission-${stripeEventId}-bd`,
        correlationId,
      });

      if (bdResult.entriesPosted === 0) {
        log.info(
          { correlationId, idempotencyKey: `commission-${stripeEventId}-bd` },
          'Commission BD partner entries already exist (idempotent retry)'
        );
      } else {
        log.info(
          { correlationId, bdPartnerAmount },
          'Commission posted successfully (BD partner)'
        );
      }
    } catch (err: any) {
      log.error(
        { correlationId, bdPartnerId: meta.bdPartnerId, error: err?.message },
        'Commission posting failed (will retry)'
      );
      await createCommissionFailureAlert(organizationId, paymentLinkId, err?.message, correlationId);
      return { posted: false };
    }
  }

  // Persist commission obligation + obligation lines (audit trail for payouts)
  try {
    const obligation = await prisma.commission_obligations.create({
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

    const linesToCreate: { obligation_id: string; payee_user_id: string; role: string; amount: number; currency: string }[] = [];
    if (consultantAmount >= 0.01 && meta.consultantId) {
      linesToCreate.push({
        obligation_id: obligation.id,
        payee_user_id: meta.consultantId,
        role: 'CONSULTANT',
        amount: consultantAmount,
        currency: currencyUpper,
      });
    }
    if (bdPartnerAmount >= 0.01 && meta.bdPartnerId) {
      linesToCreate.push({
        obligation_id: obligation.id,
        payee_user_id: meta.bdPartnerId,
        role: 'BD_PARTNER',
        amount: bdPartnerAmount,
        currency: currencyUpper,
      });
    }

    if (linesToCreate.length > 0) {
      await prisma.commission_obligation_lines.createMany({
        data: linesToCreate.map((l) => ({
          obligation_id: l.obligation_id,
          payee_user_id: l.payee_user_id,
          role: l.role,
          amount: l.amount,
          currency: l.currency,
          status: 'POSTED' as const,
        })),
      });
    }
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
