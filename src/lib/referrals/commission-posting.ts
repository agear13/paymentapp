/**
 * Commission posting for referral revenue share (Option B).
 * Supports generic multi-level splits (referral_link_splits) and legacy consultant/BD.
 * Best-effort, idempotent, webhook-safe.
 */

import Stripe from 'stripe';
import { prisma } from '@/lib/server/prisma';
import { LedgerEntryService } from '@/lib/ledger/ledger-entry-service';
import { provisionCommissionLedgerAccounts } from '@/lib/ledger/ledger-account-provisioner';
import { LEDGER_ACCOUNTS } from '@/lib/ledger/account-mapping';
import { calculateStripeFee } from '@/lib/ledger/posting-rules/stripe';
import { log } from '@/lib/logger';

/** Single split from session metadata (from referral_link_splits at checkout) */
export interface ReferralSplitMeta {
  split_id: string;
  label: string;
  percentage: number; // 0-100, e.g. 5 = 5%
  beneficiary_id: string | null;
  sort_order: number;
}

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
 * Parse referral_splits from session metadata (JSON array).
 * Returns null if missing or invalid. Used for generic multi-level split flow.
 */
export function parseReferralSplitsFromMetadata(
  metadata?: Stripe.Metadata | null
): ReferralSplitMeta[] | null {
  if (!metadata?.referral_link_id) return null;
  const raw = metadata.referral_splits;
  if (raw === undefined || raw === null || typeof raw !== 'string') return null;
  try {
    const arr = JSON.parse(raw) as unknown[];
    if (!Array.isArray(arr) || arr.length === 0 || arr.length > 15) return null;
    const parsed: ReferralSplitMeta[] = [];
    for (const item of arr) {
      const o = item as Record<string, unknown>;
      const split_id = typeof o.split_id === 'string' ? o.split_id : null;
      const percentage = toNumberSafe(o.percentage);
      if (!split_id || percentage < 0) continue;
      parsed.push({
        split_id,
        label: typeof o.label === 'string' ? o.label : `Partner ${parsed.length + 1}`,
        percentage,
        beneficiary_id: typeof o.beneficiary_id === 'string' && o.beneficiary_id ? o.beneficiary_id : null,
        sort_order: typeof o.sort_order === 'number' ? o.sort_order : parsed.length,
      });
    }
    return parsed.length > 0 ? parsed : null;
  } catch {
    return null;
  }
}

/** Decimal places for currency (default 2) */
function currencyPrecision(currency: string): number {
  const minor = new Set(['JPY', 'KRW']);
  return minor.has(currency.toUpperCase()) ? 0 : 2;
}

/**
 * Compute amount per split so total <= basisAmount. Remainder goes to first split (sort_order 1).
 */
export function computeSplitAmounts(
  basisAmount: number,
  splits: ReferralSplitMeta[],
  currency: string
): { split_id: string; label: string; percentage: number; beneficiary_id: string | null; amount: number }[] {
  const prec = currencyPrecision(currency);
  const mult = 10 ** prec;
  const sorted = [...splits].sort((a, b) => a.sort_order - b.sort_order);
  const amounts: { split_id: string; label: string; percentage: number; beneficiary_id: string | null; amount: number }[] = [];
  let total = 0;
  for (const s of sorted) {
    const raw = (basisAmount * s.percentage) / 100;
    const amount = Math.floor(raw * mult) / mult;
    amounts.push({ ...s, amount });
    total += amount;
  }
  const remainder = Math.floor((basisAmount - total) * mult) / mult;
  if (remainder > 0 && amounts.length > 0) {
    amounts[0].amount = Math.floor((amounts[0].amount + remainder) * mult) / mult;
  }
  return amounts;
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
  const { session, stripeEventId, paymentLinkId, organizationId, grossAmount, currency, correlationId } = params;

  // Generic multi-level splits (from referral_link_splits at checkout)
  const splitsMeta = parseReferralSplitsFromMetadata(session.metadata);
  if (splitsMeta && splitsMeta.length > 0) {
    return applyRevenueShareSplitsFromSplitsInternal(params, splitsMeta);
  }

  // Legacy: consultant + BD from referral_rules metadata
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

/**
 * Generic split flow: post ledger and create obligation + items from referral_splits metadata.
 */
async function applyRevenueShareSplitsFromSplitsInternal(
  params: ApplyRevenueShareSplitsParams,
  splitsMeta: ReferralSplitMeta[]
): Promise<{ posted: boolean; consultantAmount?: number; bdPartnerAmount?: number }> {
  const { session, stripeEventId, paymentLinkId, organizationId, grossAmount, currency, correlationId } = params;
  const metadata = session.metadata || {};
  const referralLinkId = metadata.referral_link_id as string;
  const referralCode = (metadata.referral_code as string) || '';
  const commissionBasis = ((metadata.commission_basis as string) || 'GROSS') as 'GROSS' | 'NET';

  const basisAmount = computeBasisAmount(commissionBasis, grossAmount, currency);
  const splitAmounts = computeSplitAmounts(basisAmount, splitsMeta, currency);
  const aboveMin = splitAmounts.filter((s) => s.amount >= 0.01);
  if (aboveMin.length === 0) {
    log.info({ stripeEventId, paymentLinkId }, 'Commission skipped: all split amounts below minimum');
    return { posted: false };
  }

  try {
    await provisionCommissionLedgerAccounts(prisma, organizationId, correlationId);
  } catch (provisionErr: unknown) {
    const message = (provisionErr as Error)?.message;
    log.error({ correlationId, organizationId, error: message }, 'Commission accounts provision failed');
    await createCommissionFailureAlert(organizationId, paymentLinkId, message, correlationId);
    return { posted: false };
  }

  const ledgerService = new LedgerEntryService();
  const currencyUpper = currency.toUpperCase();

  for (const s of aboveMin) {
    try {
      const payableAccount = s.beneficiary_id ? LEDGER_ACCOUNTS.CONSULTANT_PAYABLE : LEDGER_ACCOUNTS.PARTNER_PAYABLE_UNASSIGNED;
      const entries = [
        {
          accountCode: LEDGER_ACCOUNTS.COMMISSION_EXPENSE,
          entryType: 'DEBIT' as const,
          amount: s.amount.toFixed(2),
          currency: currencyUpper,
          description: `Revenue share ${s.label} (${referralCode}) - ${s.amount.toFixed(2)} ${currencyUpper}`,
        },
        {
          accountCode: payableAccount,
          entryType: 'CREDIT' as const,
          amount: s.amount.toFixed(2),
          currency: currencyUpper,
          description: `Partner payable ${s.label} (${referralCode}) - ${s.amount.toFixed(2)} ${currencyUpper}`,
        },
      ];
      const result = await ledgerService.postJournalEntries({
        entries,
        paymentLinkId,
        organizationId,
        idempotencyKey: `commission-${stripeEventId}-split-${s.split_id}`,
        correlationId,
      });
      if (result.entriesPosted === 0) {
        log.info({ correlationId, idempotencyKey: `commission-${stripeEventId}-split-${s.split_id}` }, 'Commission split entries already exist (idempotent retry)');
      } else {
        log.info({ correlationId, splitId: s.split_id, amount: s.amount }, 'Commission split posted');
      }
    } catch (err: unknown) {
      const message = (err as Error)?.message;
      log.error({ correlationId, splitId: s.split_id, error: message }, 'Commission split posting failed');
      await createCommissionFailureAlert(organizationId, paymentLinkId, message, correlationId);
      return { posted: false };
    }
  }

  const totalAmount = aboveMin.reduce((sum, s) => sum + s.amount, 0);
  let obligationId: string | null = null;
  let createdObligation = false;
  try {
    const obligation = await prisma.commission_obligations.create({
      data: {
        payment_link_id: paymentLinkId,
        referral_link_id: referralLinkId,
        stripe_event_id: stripeEventId,
        consultant_amount: totalAmount,
        bd_partner_amount: 0,
        currency: currencyUpper,
        status: 'POSTED',
        correlation_id: correlationId || undefined,
      },
    });
    obligationId = obligation.id;
    createdObligation = true;
  } catch (obligErr: unknown) {
    const err = obligErr as { code?: string };
    if (err?.code === 'P2002') {
      log.info({ stripeEventId }, 'Commission obligation already exists (idempotent)');
      const existing = await prisma.commission_obligations.findUnique({
        where: { stripe_event_id: stripeEventId },
      });
      if (existing) obligationId = existing.id;
    } else {
      log.warn({ error: (obligErr as Error)?.message }, 'Commission obligation create failed (non-blocking)');
    }
  }

  if (obligationId && createdObligation) {
    for (const s of aboveMin) {
      try {
        await prisma.commission_obligation_items.create({
          data: {
            commission_obligation_id: obligationId,
            split_id: s.split_id,
            amount: s.amount,
            currency: currencyUpper,
            status: s.beneficiary_id ? 'POSTED' : 'PENDING_BENEFICIARY',
          },
        });
      } catch (itemErr: unknown) {
        if ((itemErr as { code?: string })?.code === 'P2002') {
          log.info({ stripeEventId, splitId: s.split_id }, 'Commission obligation item already exists (idempotent)');
        } else {
          log.warn({ error: (itemErr as Error)?.message }, 'Commission obligation item create failed');
        }
      }
    }
    const payeeUserId = (s: (typeof aboveMin)[0]) => s.beneficiary_id || 'PENDING_BENEFICIARY';
    try {
      await prisma.commission_obligation_lines.createMany({
        data: aboveMin.map((s) => ({
          obligation_id: obligationId!,
          payee_user_id: payeeUserId(s),
          role: s.label,
          amount: s.amount,
          currency: currencyUpper,
          status: 'POSTED' as const,
        })),
      });
    } catch (lineErr: unknown) {
      if ((lineErr as { code?: string })?.code === 'P2002') {
        log.info({ stripeEventId }, 'Commission obligation lines already exist (idempotent)');
      } else {
        log.warn({ error: (lineErr as Error)?.message }, 'Commission obligation lines create failed');
      }
    }
  }

  return { posted: true, consultantAmount: totalAmount, bdPartnerAmount: 0 };
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
