import 'server-only';

import type Stripe from 'stripe';
import { prisma } from '@/lib/server/prisma';
import { log } from '@/lib/logger';
import { LedgerEntryService } from '@/lib/ledger/ledger-entry-service';
import { provisionCommissionLedgerAccounts } from '@/lib/ledger/ledger-account-provisioner';
import { LEDGER_ACCOUNTS } from '@/lib/ledger/account-mapping';
import {
  computeBasisAmount,
  computeSplitAmounts,
  extractReferralMetadata,
  parseReferralSplitsFromMetadata,
  type ReferralMetadata,
} from '@/lib/referrals/commission-posting';
import { resolveReferralCommissionMetadata } from '@/lib/referrals/commission-metadata.server';
import { commissionRepairTrace } from '@/lib/referrals/commission-repair-trace';
import { orchestrateFundingAfterInvoiceSettlement } from '@/lib/operations/funding/bridge-invoice-settlement.server';

export type CommissionRepairAction =
  | 'ledger_posted'
  | 'obligation_created'
  | 'obligation_exists'
  | 'items_created'
  | 'lines_created'
  | 'funding_orchestrated';

export type CommissionArtifactGap =
  | 'NO_PAYMENT_CONFIRMED_EVENT'
  | 'INCOMPLETE_COMMISSION_METADATA'
  | 'COMMISSION_BELOW_MINIMUM'
  | 'NO_COMMISSION_OBLIGATIONS_ROW'
  | 'NO_COMMISSION_OBLIGATION_ITEMS'
  | 'MISSING_COMMISSION_OBLIGATION_LINES'
  | 'MISSING_COMMISSION_LEDGER';

export type ReconcileCommissionResult = {
  paymentEventId: string;
  paymentLinkId: string;
  status: 'complete' | 'repaired' | 'skipped' | 'failed';
  gapsBefore: CommissionArtifactGap[];
  actions: CommissionRepairAction[];
  error?: string;
};

export type ReconcileCommissionOptions = {
  dryRun?: boolean;
  /** Post commission ledger rows only when idempotency keys are absent (default true). */
  postMissingLedger?: boolean;
  /** Re-run pilot funding orchestration when a pilot deal is linked (default true). */
  orchestrateFunding?: boolean;
  grossAmount?: number;
  currency?: string;
  correlationId?: string;
};

type SplitExpectation = {
  split_id: string;
  label: string;
  amount: number;
  beneficiary_id: string | null;
  idempotencyKey: string;
};

type LegacyExpectation = {
  meta: ReferralMetadata;
  consultantAmount: number;
  bdPartnerAmount: number;
  consultantKey?: string;
  bdKey?: string;
};

type CommissionExpectation =
  | { path: 'splits'; splits: SplitExpectation[]; referralLinkId: string; referralCode: string; totalAmount: number }
  | { path: 'legacy'; legacy: LegacyExpectation; referralLinkId: string };

async function commissionLedgerBatchExists(idempotencyKey: string): Promise<boolean> {
  const count = await prisma.ledger_entries.count({
    where: { idempotency_key: `${idempotencyKey}-0` },
  });
  return count > 0;
}

function buildSplitExpectations(
  rootId: string,
  referralCode: string,
  aboveMin: ReturnType<typeof computeSplitAmounts>
): SplitExpectation[] {
  return aboveMin.map((s) => ({
    split_id: s.split_id,
    label: s.label,
    amount: s.amount,
    beneficiary_id: s.beneficiary_id,
    idempotencyKey: `commission-${rootId}-split-${s.split_id}`,
  }));
}

function buildLegacyExpectations(
  rootId: string,
  meta: ReferralMetadata,
  grossAmount: number,
  currency: string
): LegacyExpectation | null {
  const basisAmount = computeBasisAmount(meta.commissionBasis, grossAmount, currency);
  const consultantAmount = meta.hasConsultant ? basisAmount * meta.consultantPct : 0;
  const bdPartnerAmount = meta.hasBd ? basisAmount * meta.bdPartnerPct : 0;
  const consultantAmountRounded = Math.max(0, consultantAmount);
  const bdPartnerAmountRounded = Math.max(0, bdPartnerAmount);
  const consultantAboveMin = meta.hasConsultant && consultantAmountRounded >= 0.01;
  const bdAboveMin = meta.hasBd && bdPartnerAmountRounded >= 0.01;
  if (!consultantAboveMin && !bdAboveMin) return null;

  return {
    meta,
    consultantAmount: consultantAmountRounded,
    bdPartnerAmount: bdPartnerAmountRounded,
    consultantKey:
      consultantAboveMin && meta.consultantId
        ? `commission-${rootId}-consultant`
        : undefined,
    bdKey:
      bdAboveMin && meta.bdPartnerId ? `commission-${rootId}-bd` : undefined,
  };
}

export async function buildCommissionExpectationForPaymentEvent(
  paymentEventId: string,
  grossAmount: number,
  currency: string
): Promise<
  | { ok: true; expectation: CommissionExpectation; referralMetadata: Stripe.Metadata }
  | { ok: false; reason: CommissionArtifactGap }
> {
  const event = await prisma.payment_events.findUnique({
    where: { id: paymentEventId },
    select: {
      id: true,
      event_type: true,
      payment_link_id: true,
      metadata: true,
      amount_received: true,
      currency_received: true,
    },
  });

  if (!event || event.event_type !== 'PAYMENT_CONFIRMED' || !event.payment_link_id) {
    return { ok: false, reason: 'NO_PAYMENT_CONFIRMED_EVENT' };
  }

  const link = await prisma.payment_links.findUnique({
    where: { id: event.payment_link_id },
    select: {
      id: true,
      organization_id: true,
      referral_link_id: true,
      commission_attribution_snapshot: true,
    },
  });

  if (!link?.organization_id) {
    return { ok: false, reason: 'NO_PAYMENT_CONFIRMED_EVENT' };
  }

  const referralMetadata = await resolveReferralCommissionMetadata({
    paymentEventMetadata: event.metadata ?? null,
    paymentLinkReferralLinkId:
      typeof link.referral_link_id === 'string' ? link.referral_link_id : null,
    paymentLinkCommissionSnapshot: link.commission_attribution_snapshot ?? null,
  });

  const md = referralMetadata ?? null;
  const splitsMeta = parseReferralSplitsFromMetadata(md);
  const legacyMeta = extractReferralMetadata(md);
  if (!splitsMeta?.length && !legacyMeta) {
    return { ok: false, reason: 'INCOMPLETE_COMMISSION_METADATA' };
  }

  const amount =
    grossAmount > 0
      ? grossAmount
      : Number(event.amount_received ?? 0);
  const currencyUpper = (currency || event.currency_received || 'USD').toUpperCase();
  const rootId = paymentEventId;

  if (splitsMeta && splitsMeta.length > 0) {
    const commissionBasis = ((md?.commission_basis as string) || 'GROSS') as 'GROSS' | 'NET';
    const basisAmount = computeBasisAmount(commissionBasis, amount, currencyUpper);
    const splitAmounts = computeSplitAmounts(basisAmount, splitsMeta, currencyUpper);
    const aboveMin = splitAmounts.filter((s) => s.amount >= 0.01);
    if (aboveMin.length === 0) {
      return { ok: false, reason: 'COMMISSION_BELOW_MINIMUM' };
    }
    const referralCode = (md?.referral_code as string) || '';
    const referralLinkId = (md?.referral_link_id as string) || link.referral_link_id!;
    return {
      ok: true,
      referralMetadata: md as Stripe.Metadata,
      expectation: {
        path: 'splits',
        referralLinkId,
        referralCode,
        totalAmount: aboveMin.reduce((sum, s) => sum + s.amount, 0),
        splits: buildSplitExpectations(rootId, referralCode, aboveMin),
      },
    };
  }

  const legacy = buildLegacyExpectations(rootId, legacyMeta!, amount, currencyUpper);
  if (!legacy) {
    return { ok: false, reason: 'COMMISSION_BELOW_MINIMUM' };
  }

  return {
    ok: true,
    referralMetadata: md as Stripe.Metadata,
    expectation: {
      path: 'legacy',
      referralLinkId: legacy.meta.referralLinkId,
      legacy,
    },
  };
}

export async function detectCommissionArtifactGaps(
  paymentEventId: string,
  options?: { grossAmount?: number; currency?: string; checkLedger?: boolean }
): Promise<CommissionArtifactGap[]> {
  const built = await buildCommissionExpectationForPaymentEvent(
    paymentEventId,
    options?.grossAmount ?? 0,
    options?.currency ?? ''
  );
  if (!built.ok) {
    return [built.reason];
  }

  const gaps: CommissionArtifactGap[] = [];
  const { expectation } = built;

  const obligation = await prisma.commission_obligations.findUnique({
    where: { stripe_event_id: paymentEventId },
    include: { obligation_items: true, obligation_lines: true },
  });

  if (!obligation) {
    gaps.push('NO_COMMISSION_OBLIGATIONS_ROW');
  }

  if (expectation.path === 'splits') {
    if (obligation && obligation.obligation_items.length < expectation.splits.length) {
      gaps.push('NO_COMMISSION_OBLIGATION_ITEMS');
    }
    const expectedLineCount = expectation.splits.length;
    if (obligation && obligation.obligation_lines.length < expectedLineCount) {
      gaps.push('MISSING_COMMISSION_OBLIGATION_LINES');
    }
    if (!obligation) {
      gaps.push('NO_COMMISSION_OBLIGATION_ITEMS');
      gaps.push('MISSING_COMMISSION_OBLIGATION_LINES');
    }
  } else {
    const { legacy } = expectation;
    let expectedLines = 0;
    if (legacy.consultantKey && legacy.meta.consultantId) expectedLines += 1;
    if (legacy.bdKey && legacy.meta.bdPartnerId) expectedLines += 1;
    if (obligation && obligation.obligation_lines.length < expectedLines) {
      gaps.push('MISSING_COMMISSION_OBLIGATION_LINES');
    }
    if (!obligation && expectedLines > 0) {
      gaps.push('MISSING_COMMISSION_OBLIGATION_LINES');
    }
  }

  if (options?.checkLedger !== false) {
    const keys =
      expectation.path === 'splits'
        ? expectation.splits.map((s) => s.idempotencyKey)
        : [
            expectation.legacy.consultantKey,
            expectation.legacy.bdKey,
          ].filter((k): k is string => Boolean(k));

    for (const key of keys) {
      const exists = await commissionLedgerBatchExists(key);
      if (!exists) {
        gaps.push('MISSING_COMMISSION_LEDGER');
        break;
      }
    }
  }

  return [...new Set(gaps)];
}

async function postSplitLedgerIfMissing(
  params: {
    paymentLinkId: string;
    organizationId: string;
    referralCode: string;
    currency: string;
    correlationId?: string;
    split: SplitExpectation;
    dryRun: boolean;
  }
): Promise<boolean> {
  const exists = await commissionLedgerBatchExists(params.split.idempotencyKey);
  if (exists) return false;

  if (params.dryRun) return true;

  const ledgerService = new LedgerEntryService();
  const payableAccount = params.split.beneficiary_id
    ? LEDGER_ACCOUNTS.CONSULTANT_PAYABLE
    : LEDGER_ACCOUNTS.PARTNER_PAYABLE_UNASSIGNED;
  const currencyUpper = params.currency.toUpperCase();
  const amountStr = params.split.amount.toFixed(2);

  await ledgerService.postJournalEntries({
    entries: [
      {
        accountCode: LEDGER_ACCOUNTS.COMMISSION_EXPENSE,
        entryType: 'DEBIT',
        amount: amountStr,
        currency: currencyUpper,
        description: `Revenue share ${params.split.label} (${params.referralCode}) - ${amountStr} ${currencyUpper}`,
      },
      {
        accountCode: payableAccount,
        entryType: 'CREDIT',
        amount: amountStr,
        currency: currencyUpper,
        description: `Partner payable ${params.split.label} (${params.referralCode}) - ${amountStr} ${currencyUpper}`,
      },
    ],
    paymentLinkId: params.paymentLinkId,
    organizationId: params.organizationId,
    idempotencyKey: params.split.idempotencyKey,
    correlationId: params.correlationId,
  });
  return true;
}

async function postLegacyLedgerIfMissing(
  params: {
    paymentLinkId: string;
    organizationId: string;
    meta: ReferralMetadata;
    currency: string;
    correlationId?: string;
    role: 'consultant' | 'bd';
    amount: number;
    idempotencyKey: string;
    dryRun: boolean;
  }
): Promise<boolean> {
  const exists = await commissionLedgerBatchExists(params.idempotencyKey);
  if (exists) return false;
  if (params.dryRun) return true;

  const ledgerService = new LedgerEntryService();
  const currencyUpper = params.currency.toUpperCase();
  const amountStr = params.amount.toFixed(2);
  const isConsultant = params.role === 'consultant';

  await ledgerService.postJournalEntries({
    entries: [
      {
        accountCode: LEDGER_ACCOUNTS.COMMISSION_EXPENSE,
        entryType: 'DEBIT',
        amount: amountStr,
        currency: currencyUpper,
        description: `${isConsultant ? 'Consultant' : 'BD partner'} commission (${params.meta.referralCode}) - ${amountStr} ${currencyUpper}`,
      },
      {
        accountCode: isConsultant
          ? LEDGER_ACCOUNTS.CONSULTANT_PAYABLE
          : LEDGER_ACCOUNTS.BD_PARTNER_PAYABLE,
        entryType: 'CREDIT',
        amount: amountStr,
        currency: currencyUpper,
        description: `${isConsultant ? 'Consultant' : 'BD partner'} payable (${params.meta.referralCode}) - ${amountStr} ${currencyUpper}`,
      },
    ],
    paymentLinkId: params.paymentLinkId,
    organizationId: params.organizationId,
    idempotencyKey: params.idempotencyKey,
    correlationId: params.correlationId,
  });
  return true;
}

async function ensureObligation(
  params: {
    paymentLinkId: string;
    referralLinkId: string;
    rootId: string;
    currency: string;
    consultantAmount: number;
    bdPartnerAmount: number;
    correlationId?: string;
    dryRun: boolean;
  }
): Promise<{ obligationId: string; created: boolean } | null> {
  const existing = await prisma.commission_obligations.findUnique({
    where: { stripe_event_id: params.rootId },
  });
  if (existing) {
    return { obligationId: existing.id, created: false };
  }
  if (params.dryRun) {
    return { obligationId: 'dry-run-obligation', created: true };
  }

  try {
    const obligation = await prisma.commission_obligations.create({
      data: {
        payment_link_id: params.paymentLinkId,
        referral_link_id: params.referralLinkId,
        stripe_event_id: params.rootId,
        consultant_amount: params.consultantAmount,
        bd_partner_amount: params.bdPartnerAmount,
        currency: params.currency.toUpperCase(),
        status: 'POSTED',
        correlation_id: params.correlationId || undefined,
      },
    });
    return { obligationId: obligation.id, created: true };
  } catch (err: unknown) {
    if ((err as { code?: string })?.code === 'P2002') {
      const row = await prisma.commission_obligations.findUnique({
        where: { stripe_event_id: params.rootId },
      });
      if (row) return { obligationId: row.id, created: false };
    }
    throw err;
  }
}

async function ensureSplitItems(
  obligationId: string,
  splits: SplitExpectation[],
  currency: string,
  dryRun: boolean
): Promise<number> {
  let created = 0;
  for (const s of splits) {
    const existing = await prisma.commission_obligation_items.findFirst({
      where: {
        commission_obligation_id: obligationId,
        split_id: s.split_id,
      },
    });
    if (existing) {
      if (existing.status === 'PAID' || existing.payout_id) continue;
      continue;
    }
    if (dryRun) {
      created += 1;
      continue;
    }
    await prisma.commission_obligation_items.create({
      data: {
        commission_obligation_id: obligationId,
        split_id: s.split_id,
        amount: s.amount,
        currency: currency.toUpperCase(),
        status: s.beneficiary_id ? 'POSTED' : 'PENDING_BENEFICIARY',
      },
    });
    created += 1;
  }
  return created;
}

async function ensureLine(
  params: {
    obligationId: string;
    payeeUserId: string;
    role: string;
    amount: number;
    currency: string;
    dryRun: boolean;
  }
): Promise<boolean> {
  const existing = await prisma.commission_obligation_lines.findFirst({
    where: {
      obligation_id: params.obligationId,
      payee_user_id: params.payeeUserId,
      role: params.role,
    },
  });
  if (existing) {
    if (existing.status === 'PAID' || existing.payout_id) return false;
    return false;
  }
  if (params.dryRun) return true;

  await prisma.commission_obligation_lines.create({
    data: {
      obligation_id: params.obligationId,
      payee_user_id: params.payeeUserId,
      role: params.role,
      amount: params.amount,
      currency: params.currency.toUpperCase(),
      status: 'POSTED',
    },
  });
  return true;
}

/**
 * Repair missing commission artifacts for a settled payment without re-running settlement.
 * Idempotent: existing obligations, items, lines, and ledger batches are left untouched.
 */
export async function reconcileCommissionArtifactsForPaymentEvent(
  paymentEventId: string,
  options?: ReconcileCommissionOptions
): Promise<ReconcileCommissionResult> {
  const dryRun = options?.dryRun === true;
  const postMissingLedger = options?.postMissingLedger !== false;
  const orchestrateFunding = options?.orchestrateFunding !== false;

  const event = await prisma.payment_events.findUnique({
    where: { id: paymentEventId },
    select: {
      id: true,
      event_type: true,
      payment_link_id: true,
      pilot_deal_id: true,
      correlation_id: true,
      amount_received: true,
      currency_received: true,
    },
  });

  if (!event?.payment_link_id || event.event_type !== 'PAYMENT_CONFIRMED') {
    const result: ReconcileCommissionResult = {
      paymentEventId,
      paymentLinkId: event?.payment_link_id ?? '',
      status: 'failed',
      gapsBefore: ['NO_PAYMENT_CONFIRMED_EVENT'],
      actions: [],
      error: 'Payment event is not PAYMENT_CONFIRMED',
    };
    commissionRepairTrace('commission_repair_failed', result);
    return result;
  }

  const paymentLinkId = event.payment_link_id;
  const correlationId = options?.correlationId ?? event.correlation_id ?? undefined;
  const grossAmount = options?.grossAmount ?? Number(event.amount_received ?? 0);
  const currency = (options?.currency ?? event.currency_received ?? 'USD').toUpperCase();

  commissionRepairTrace('commission_repair_started', {
    paymentEventId,
    paymentLinkId,
    correlationId,
    dryRun,
  });

  const gapsBefore = await detectCommissionArtifactGaps(paymentEventId, {
    grossAmount,
    currency,
    checkLedger: postMissingLedger,
  });

  const repairableGaps = gapsBefore.filter(
    (g) =>
      g !== 'INCOMPLETE_COMMISSION_METADATA' &&
      g !== 'COMMISSION_BELOW_MINIMUM' &&
      g !== 'NO_PAYMENT_CONFIRMED_EVENT'
  );

  if (repairableGaps.length === 0) {
    const skipReason = gapsBefore.includes('INCOMPLETE_COMMISSION_METADATA')
      ? 'incomplete_metadata'
      : gapsBefore.includes('COMMISSION_BELOW_MINIMUM')
        ? 'below_minimum'
        : 'already_complete';

    const result: ReconcileCommissionResult = {
      paymentEventId,
      paymentLinkId,
      status: gapsBefore.length === 0 ? 'complete' : 'skipped',
      gapsBefore,
      actions: [],
    };

    if (orchestrateFunding && !dryRun && skipReason === 'already_complete') {
      try {
        await orchestrateFundingAfterInvoiceSettlement(paymentEventId);
        result.actions.push('funding_orchestrated');
      } catch (fundingErr: unknown) {
        log.warn('Commission repair funding orchestration failed (non-blocking)', {
          paymentEventId,
          paymentLinkId,
          error: fundingErr instanceof Error ? fundingErr.message : String(fundingErr),
        });
      }
    }

    commissionRepairTrace('commission_repair_skipped', {
      paymentEventId,
      paymentLinkId,
      skipReason,
      gapsBefore,
      actions: result.actions,
    });
    return result;
  }

  const link = await prisma.payment_links.findUnique({
    where: { id: paymentLinkId },
    select: { organization_id: true },
  });
  if (!link?.organization_id) {
    const result: ReconcileCommissionResult = {
      paymentEventId,
      paymentLinkId,
      status: 'failed',
      gapsBefore,
      actions: [],
      error: 'Payment link organization not found',
    };
    commissionRepairTrace('commission_repair_failed', result);
    return result;
  }

  const actions: CommissionRepairAction[] = [];

  try {
    const built = await buildCommissionExpectationForPaymentEvent(
      paymentEventId,
      grossAmount,
      currency
    );
    if (!built.ok) {
      const result: ReconcileCommissionResult = {
        paymentEventId,
        paymentLinkId,
        status: 'skipped',
        gapsBefore,
        actions: [],
        error: built.reason,
      };
      commissionRepairTrace('commission_repair_skipped', result);
      return result;
    }

    if (!dryRun) {
      await provisionCommissionLedgerAccounts(prisma, link.organization_id, correlationId);
    }

    const { expectation } = built;

    if (postMissingLedger) {
      if (expectation.path === 'splits') {
        for (const split of expectation.splits) {
          const posted = await postSplitLedgerIfMissing({
            paymentLinkId,
            organizationId: link.organization_id,
            referralCode: expectation.referralCode,
            currency,
            correlationId,
            split,
            dryRun,
          });
          if (posted) actions.push('ledger_posted');
        }
      } else {
        const { legacy } = expectation;
        if (legacy.consultantKey && legacy.meta.consultantId) {
          const posted = await postLegacyLedgerIfMissing({
            paymentLinkId,
            organizationId: link.organization_id,
            meta: legacy.meta,
            currency,
            correlationId,
            role: 'consultant',
            amount: legacy.consultantAmount,
            idempotencyKey: legacy.consultantKey,
            dryRun,
          });
          if (posted) actions.push('ledger_posted');
        }
        if (legacy.bdKey && legacy.meta.bdPartnerId) {
          const posted = await postLegacyLedgerIfMissing({
            paymentLinkId,
            organizationId: link.organization_id,
            meta: legacy.meta,
            currency,
            correlationId,
            role: 'bd',
            amount: legacy.bdPartnerAmount,
            idempotencyKey: legacy.bdKey,
            dryRun,
          });
          if (posted) actions.push('ledger_posted');
        }
      }
    }

    const consultantAmount =
      expectation.path === 'splits'
        ? expectation.totalAmount
        : expectation.legacy.consultantAmount;
    const bdPartnerAmount =
      expectation.path === 'splits' ? 0 : expectation.legacy.bdPartnerAmount;

    const obligationResult = await ensureObligation({
      paymentLinkId,
      referralLinkId: expectation.referralLinkId,
      rootId: paymentEventId,
      currency,
      consultantAmount,
      bdPartnerAmount,
      correlationId,
      dryRun,
    });

    if (!obligationResult) {
      throw new Error('Failed to ensure commission obligation');
    }

    if (obligationResult.created) {
      actions.push('obligation_created');
    } else {
      actions.push('obligation_exists');
    }

    const obligationId = obligationResult.obligationId;

    if (expectation.path === 'splits') {
      const itemsCreated = await ensureSplitItems(
        obligationId,
        expectation.splits,
        currency,
        dryRun
      );
      if (itemsCreated > 0) actions.push('items_created');

      for (const s of expectation.splits) {
        const payeeUserId = s.beneficiary_id || 'PENDING_BENEFICIARY';
        const lineCreated = await ensureLine({
          obligationId,
          payeeUserId,
          role: s.label,
          amount: s.amount,
          currency,
          dryRun,
        });
        if (lineCreated) actions.push('lines_created');
      }
    } else {
      const { legacy } = expectation;
      if (legacy.consultantKey && legacy.meta.consultantId) {
        const lineCreated = await ensureLine({
          obligationId,
          payeeUserId: legacy.meta.consultantId,
          role: 'CONSULTANT',
          amount: legacy.consultantAmount,
          currency,
          dryRun,
        });
        if (lineCreated) actions.push('lines_created');
      }
      if (legacy.bdKey && legacy.meta.bdPartnerId) {
        const lineCreated = await ensureLine({
          obligationId,
          payeeUserId: legacy.meta.bdPartnerId,
          role: 'BD_PARTNER',
          amount: legacy.bdPartnerAmount,
          currency,
          dryRun,
        });
        if (lineCreated) actions.push('lines_created');
      }
    }

    if (orchestrateFunding && !dryRun) {
      try {
        await orchestrateFundingAfterInvoiceSettlement(paymentEventId);
        actions.push('funding_orchestrated');
      } catch (fundingErr: unknown) {
        log.warn('Commission repair funding orchestration failed (non-blocking)', {
          paymentEventId,
          paymentLinkId,
          error: fundingErr instanceof Error ? fundingErr.message : String(fundingErr),
        });
      }
    }

    const gapsAfter = await detectCommissionArtifactGaps(paymentEventId, {
      grossAmount,
      currency,
      checkLedger: postMissingLedger,
    });
    const stillRepairable = gapsAfter.filter(
      (g) =>
        g !== 'INCOMPLETE_COMMISSION_METADATA' &&
        g !== 'COMMISSION_BELOW_MINIMUM' &&
        g !== 'NO_PAYMENT_CONFIRMED_EVENT'
    );

    const result: ReconcileCommissionResult = {
      paymentEventId,
      paymentLinkId,
      status: stillRepairable.length === 0 ? 'repaired' : 'failed',
      gapsBefore,
      actions: [...new Set(actions)],
      ...(stillRepairable.length > 0
        ? { error: `Remaining gaps: ${stillRepairable.join(', ')}` }
        : {}),
    };

    commissionRepairTrace(
      stillRepairable.length === 0 ? 'commission_repair_completed' : 'commission_repair_failed',
      {
        paymentEventId,
        paymentLinkId,
        status: result.status,
        gapsBefore,
        gapsAfter,
        actions: result.actions,
        error: result.error,
      }
    );

    return result;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    log.error(
      'Commission artifact reconcile failed',
      err instanceof Error ? err : undefined,
      { paymentEventId, paymentLinkId, correlationId }
    );
    const result: ReconcileCommissionResult = {
      paymentEventId,
      paymentLinkId,
      status: 'failed',
      gapsBefore,
      actions: [...new Set(actions)],
      error: message,
    };
    commissionRepairTrace('commission_repair_failed', result);
    return result;
  }
}
