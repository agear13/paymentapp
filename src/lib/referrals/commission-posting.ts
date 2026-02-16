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
  consultantId: string | null;
  bdPartnerId: string | null;
  consultantPct: number;
  bdPartnerPct: number;
  commissionBasis: 'GROSS' | 'NET';
  /** True when consultant_id is set and consultant_pct > 0 */
  hasConsultant: boolean;
  /** True when bd_partner_id is set and bd_partner_pct > 0 */
  hasBd: boolean;
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
 * Normalize commission percentage: "10" (meaning 10%) -> 0.10, "0.1" stays 0.1.
 * Clamps to >= 0.
 */
export function normalizeCommissionPct(value: unknown): number {
  const num = typeof value === 'number' ? value : Number(String(value ?? ''));
  if (Number.isNaN(num)) return 0;
  const pct = num > 1 ? num / 100 : num;
  return pct >= 0 ? pct : 0;
}

/**
 * Safe conversion to number for fee strings
 */
export function toNumberSafe(value: unknown): number {
  if (typeof value === 'number' && !Number.isNaN(value)) return value;
  const num = Number(String(value ?? ''));
  return Number.isNaN(num) ? 0 : num;
}

/**
 * Compute basis amount for commission: GROSS = grossAmount, NET = max(0, grossAmount - stripeFee).
 */
export function computeBasisAmount(
  commissionBasis: 'GROSS' | 'NET',
  grossAmount: number,
  currency: string
): number {
  if (commissionBasis === 'GROSS') return grossAmount;
  const amountInCents = Math.round(grossAmount * 100);
  const feeStr = calculateStripeFee(amountInCents, currency);
  const feeMajor = toNumberSafe(feeStr);
  return Math.max(0, grossAmount - feeMajor);
}

/**
 * Extract referral metadata from Stripe session.
 * Only referral_link_id is required. At least one payee must be present with positive pct:
 * - Consultant: consultant_id set AND consultant_pct > 0
 * - BD: bd_partner_id set AND bd_partner_pct > 0
 * If consultant_pct > 0 but consultant_id missing, consultant is skipped; BD can still post.
 */
export function extractReferralMetadata(
  metadata?: Stripe.Metadata | null
): ReferralMetadata | null {
  if (!metadata?.referral_link_id) {
    return null;
  }

  const referralLinkId = metadata.referral_link_id;
  const referralCode = metadata.referral_code || '';
  const consultantId = metadata.consultant_id?.trim() || null;
  const bdPartnerId = metadata.bd_partner_id?.trim() || null;
  const consultantPct = normalizeCommissionPct(metadata.consultant_pct);
  const bdPartnerPct = normalizeCommissionPct(metadata.bd_partner_pct);
  const commissionBasis = (metadata.commission_basis as 'GROSS' | 'NET') || 'GROSS';

  const hasConsultant = !!consultantId && consultantPct > 0;
  const hasBd = !!bdPartnerId && bdPartnerPct > 0;

  if (!hasConsultant && !hasBd) {
    return null;
  }

  return {
    referralLinkId,
    referralCode,
    consultantId,
    bdPartnerId,
    consultantPct,
    bdPartnerPct,
    commissionBasis,
    hasConsultant,
    hasBd,
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

  if (meta.consultantPct > 0 && !meta.consultantId) {
    log.info(
      { stripeEventId, paymentLinkId, role: 'CONSULTANT' },
      'Commission skipped: consultant_pct > 0 but consultant_id missing; BD may still post'
    );
  }
  if (meta.bdPartnerPct > 0 && !meta.bdPartnerId) {
    log.info(
      { stripeEventId, paymentLinkId, role: 'BD_PARTNER' },
      'Commission skipped: bd_partner_pct > 0 but bd_partner_id missing'
    );
  }

  const basisAmount = computeBasisAmount(meta.commissionBasis, grossAmount, currency);
  const consultantAmount = meta.hasConsultant ? basisAmount * meta.consultantPct : 0;
  const bdPartnerAmount = meta.hasBd ? basisAmount * meta.bdPartnerPct : 0;

  const consultantAmountRounded = Math.max(0, consultantAmount);
  const bdPartnerAmountRounded = Math.max(0, bdPartnerAmount);
  const consultantAboveMin = meta.hasConsultant && consultantAmountRounded >= 0.01;
  const bdAboveMin = meta.hasBd && bdPartnerAmountRounded >= 0.01;

  if (!consultantAboveMin && !bdAboveMin) {
    log.info(
      { stripeEventId, paymentLinkId, consultantAmount: consultantAmountRounded, bdPartnerAmount: bdPartnerAmountRounded },
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

  // Post consultant commission only if hasConsultant and amount >= 0.01
  if (consultantAboveMin && meta.consultantId) {
    try {
      log.info(
        { correlationId, consultantId: meta.consultantId, amount: consultantAmountRounded },
        'Posting consultant commission'
      );

      const consultantEntries = [
        {
          accountCode: LEDGER_ACCOUNTS.COMMISSION_EXPENSE,
          entryType: 'DEBIT' as const,
          amount: consultantAmountRounded.toFixed(2),
          currency: currencyUpper,
          description: `Consultant commission (${meta.referralCode}) - ${consultantAmountRounded.toFixed(2)} ${currencyUpper}`,
        },
        {
          accountCode: LEDGER_ACCOUNTS.CONSULTANT_PAYABLE,
          entryType: 'CREDIT' as const,
          amount: consultantAmountRounded.toFixed(2),
          currency: currencyUpper,
          description: `Consultant payable (${meta.referralCode}) - ${consultantAmountRounded.toFixed(2)} ${currencyUpper}`,
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
          { correlationId, consultantAmount: consultantAmountRounded },
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

  // Post BD partner commission only if hasBd and amount >= 0.01
  if (bdAboveMin && meta.bdPartnerId) {
    try {
      log.info(
        { correlationId, bdPartnerId: meta.bdPartnerId, amount: bdPartnerAmountRounded },
        'Posting BD partner commission'
      );

      const bdEntries = [
        {
          accountCode: LEDGER_ACCOUNTS.COMMISSION_EXPENSE,
          entryType: 'DEBIT' as const,
          amount: bdPartnerAmountRounded.toFixed(2),
          currency: currencyUpper,
          description: `BD partner commission (${meta.referralCode}) - ${bdPartnerAmountRounded.toFixed(2)} ${currencyUpper}`,
        },
        {
          accountCode: LEDGER_ACCOUNTS.BD_PARTNER_PAYABLE,
          entryType: 'CREDIT' as const,
          amount: bdPartnerAmountRounded.toFixed(2),
          currency: currencyUpper,
          description: `BD partner payable (${meta.referralCode}) - ${bdPartnerAmountRounded.toFixed(2)} ${currencyUpper}`,
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
          { correlationId, bdPartnerAmount: bdPartnerAmountRounded },
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

  // Persist commission obligation + obligation lines (audit trail for payouts). Only create lines for posted payees.
  let obligationId: string | null = null;
  try {
    const obligation = await prisma.commission_obligations.create({
      data: {
        payment_link_id: paymentLinkId,
        referral_link_id: meta.referralLinkId,
        stripe_event_id: stripeEventId,
        consultant_amount: consultantAmountRounded,
        bd_partner_amount: bdPartnerAmountRounded,
        currency: currencyUpper,
        status: 'POSTED',
        correlation_id: correlationId || undefined,
      },
    });
    obligationId = obligation.id;
  } catch (obligErr: any) {
    if (obligErr?.code === 'P2002') {
      log.info({ stripeEventId }, 'Commission obligation already exists (idempotent)');
      const existing = await prisma.commission_obligations.findUnique({
        where: { stripe_event_id: stripeEventId },
      });
      if (existing) obligationId = existing.id;
    } else {
      log.warn({ error: obligErr?.message }, 'Commission obligation create failed (non-blocking)');
    }
  }

  if (obligationId) {
    const linesToCreate: { obligation_id: string; payee_user_id: string; role: string; amount: number; currency: string }[] = [];
    if (consultantAboveMin && meta.consultantId) {
      linesToCreate.push({
        obligation_id: obligationId,
        payee_user_id: meta.consultantId,
        role: 'CONSULTANT',
        amount: consultantAmountRounded,
        currency: currencyUpper,
      });
    }
    if (bdAboveMin && meta.bdPartnerId) {
      linesToCreate.push({
        obligation_id: obligationId,
        payee_user_id: meta.bdPartnerId,
        role: 'BD_PARTNER',
        amount: bdPartnerAmountRounded,
        currency: currencyUpper,
      });
    }
    if (linesToCreate.length > 0) {
      try {
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
      } catch (lineErr: any) {
        if (lineErr?.code === 'P2002') {
          log.info({ stripeEventId }, 'Commission obligation lines already exist (idempotent)');
        } else {
          log.warn({ error: lineErr?.message }, 'Commission obligation lines create failed (non-blocking)');
        }
      }
    }
  }

  return {
    posted: true,
    consultantAmount: consultantAmountRounded,
    bdPartnerAmount: bdPartnerAmountRounded,
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
