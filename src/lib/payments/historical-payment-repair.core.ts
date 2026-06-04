/**
 * Historical payment repair — inventory and idempotent backfill for pre-R1/R3/R4/R5 rows.
 * Uses confirmPayment() for missing settlement; reconcileCommissionArtifactsForPaymentEvent for gaps.
 * Runtime-safe (no server-only) for tsx scripts; re-exported from historical-payment-repair.server.ts for Next.js.
 */
import { prisma } from '@/lib/server/prisma';
import { confirmPayment, type ConfirmPaymentParams } from '@/lib/services/payment-confirmation';
import {
  detectCommissionArtifactGaps,
  reconcileCommissionArtifactsForPaymentEvent,
  type CommissionArtifactGap,
  type ReconcileCommissionResult,
} from '@/lib/referrals/commission-reconcile.server';
import {
  bankReviewProviderRef,
  cryptoReviewProviderRef,
  manualSettlementProviderRef,
} from '@/lib/payments/settlement-provider-refs';
import { log } from '@/lib/logger';

export type HistoricalRepairCohort =
  | 'A' // PAID without PAYMENT_CONFIRMED
  | 'B' // PAYMENT_CONFIRMED, commission artifacts incomplete
  | 'C' // Hedera manual verify (pre-R4)
  | 'D' // Bank/crypto review (pre-R3)
  | 'E' // Manual settlement (pre-R1)
  | 'F'; // R5 partial propagation (alias of B with gaps)

export type HistoricalRepairActionType =
  | 'skip'
  | 'settlement_confirm_payment'
  | 'commission_reconcile'
  | 'audit_only';

export type HistoricalRepairRecord = {
  paymentLinkId: string;
  organizationId: string;
  cohort: HistoricalRepairCohort;
  paymentEventId?: string;
  plannedAction: HistoricalRepairActionType;
  reason?: string;
  provider?: string;
  providerRef?: string;
};

export type HistoricalRepairRunResult = {
  dryRun: boolean;
  cohortFilter: HistoricalRepairCohort | 'all';
  records: HistoricalRepairRecord[];
  executed: Array<{
    paymentLinkId: string;
    cohort: HistoricalRepairCohort;
    action: HistoricalRepairActionType;
    success: boolean;
    paymentEventId?: string;
    alreadyProcessed?: boolean;
    reconcileStatus?: ReconcileCommissionResult['status'];
    gapsBefore?: CommissionArtifactGap[];
    error?: string;
  }>;
  summary: {
    scanned: number;
    planned: number;
    skipped: number;
    settlementRepairs: number;
    commissionRepairs: number;
    failed: number;
  };
};

export type HistoricalRepairOptions = {
  dryRun?: boolean;
  cohort?: HistoricalRepairCohort | 'all';
  organizationIds?: string[];
  limit?: number;
  /** Only links created before this date (historical scope). */
  createdBefore?: Date;
  actorUserId?: string;
};

function metaString(meta: unknown, key: string): string | undefined {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return undefined;
  const v = (meta as Record<string, unknown>)[key];
  return typeof v === 'string' ? v : undefined;
}

function metaBool(meta: unknown, key: string): boolean {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return false;
  const v = (meta as Record<string, unknown>)[key];
  return v === true || v === 'true';
}

export async function isPaidWithoutPaymentConfirmed(paymentLinkId: string): Promise<boolean> {
  const link = await prisma.payment_links.findUnique({
    where: { id: paymentLinkId },
    select: { status: true },
  });
  if (link?.status !== 'PAID') return false;
  const confirmed = await prisma.payment_events.findFirst({
    where: { payment_link_id: paymentLinkId, event_type: 'PAYMENT_CONFIRMED' },
    select: { id: true },
  });
  return !confirmed;
}

export async function classifyHistoricalCohort(params: {
  paymentLinkId: string;
  paymentEventId?: string;
}): Promise<HistoricalRepairCohort> {
  if (await isPaidWithoutPaymentConfirmed(params.paymentLinkId)) {
    const link = await prisma.payment_links.findUnique({
      where: { id: params.paymentLinkId },
      select: { payment_method: true },
    });
    if (link?.payment_method === 'MANUAL_BANK') return 'D';
    if (link?.payment_method === 'CRYPTO') return 'C';
    return 'A';
  }

  const eventId =
    params.paymentEventId ??
    (
      await prisma.payment_events.findFirst({
        where: {
          payment_link_id: params.paymentLinkId,
          event_type: 'PAYMENT_CONFIRMED',
        },
        select: { id: true },
        orderBy: { created_at: 'asc' },
      })
    )?.id;

  if (!eventId) return 'A';

  const event = await prisma.payment_events.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      source_reference: true,
      hedera_transaction_id: true,
      metadata: true,
      payment_method: true,
    },
  });

  if (!event) return 'A';

  const md = event.metadata;
  if (
    metaBool(md, 'manuallyVerified') ||
    metaString(md, 'source') === 'hedera-manual-verify' ||
    metaString(md, 'settlementPath') === 'hedera_mirror_verify'
  ) {
    return 'C';
  }

  const srcRef = event.source_reference ?? '';
  if (srcRef.startsWith('bank-review:') || srcRef.startsWith('crypto-review:')) {
    return 'D';
  }
  if (srcRef.startsWith('manual-settlement:')) {
    return 'E';
  }

  const gaps = await detectCommissionArtifactGaps(eventId);
  const repairable = gaps.filter(
    (g) =>
      g !== 'INCOMPLETE_COMMISSION_METADATA' &&
      g !== 'COMMISSION_BELOW_MINIMUM' &&
      g !== 'NO_PAYMENT_CONFIRMED_EVENT'
  );
  if (repairable.length > 0) return 'F';

  return 'B';
}

export async function resolveHistoricalSettlementParams(
  paymentLinkId: string
): Promise<{ ok: true; params: ConfirmPaymentParams } | { ok: false; reason: string }> {
  const link = await prisma.payment_links.findUnique({
    where: { id: paymentLinkId },
    include: {
      manual_bank_payment_confirmations: {
        where: { status: 'APPROVED' },
        orderBy: { reviewed_at: 'desc' },
        take: 1,
      },
      crypto_payment_confirmations: {
        where: { status: 'APPROVED' },
        orderBy: { reviewed_at: 'desc' },
        take: 1,
      },
    },
  });

  if (!link) {
    return { ok: false, reason: 'payment_link_not_found' };
  }

  const amountReceived = Number(link.amount);
  if (!Number.isFinite(amountReceived) || amountReceived <= 0) {
    return { ok: false, reason: 'invalid_invoice_amount' };
  }
  const currencyReceived = String(link.invoice_currency ?? link.currency).toUpperCase();

  const bankConf = link.manual_bank_payment_confirmations[0];
  if (link.payment_method === 'MANUAL_BANK' && bankConf) {
    return {
      ok: true,
      params: {
        paymentLinkId: link.id,
        provider: 'manual',
        providerRef: bankReviewProviderRef(bankConf.id),
        amountReceived,
        currencyReceived,
        metadata: {
          historicalRepair: true,
          repairCohort: 'D',
          confirmationId: bankConf.id,
          rail: 'MANUAL_BANK',
          settlementPath: 'historical_assisted_review_backfill',
          source: 'historical-payment-repair',
        },
      },
    };
  }

  const cryptoConf = link.crypto_payment_confirmations[0];
  if (link.payment_method === 'CRYPTO' && cryptoConf) {
    return {
      ok: true,
      params: {
        paymentLinkId: link.id,
        provider: 'manual',
        providerRef: cryptoReviewProviderRef(cryptoConf.id),
        amountReceived,
        currencyReceived,
        metadata: {
          historicalRepair: true,
          repairCohort: 'D',
          confirmationId: cryptoConf.id,
          rail: 'CRYPTO',
          settlementPath: 'historical_assisted_review_backfill',
          source: 'historical-payment-repair',
        },
      },
    };
  }

  const hederaEvent = await prisma.payment_events.findFirst({
    where: {
      payment_link_id: paymentLinkId,
      hedera_transaction_id: { not: null },
    },
    orderBy: { created_at: 'desc' },
    select: { hedera_transaction_id: true, amount_received: true, currency_received: true },
  });

  if (hederaEvent?.hedera_transaction_id) {
    const tokenType = (hederaEvent.currency_received ?? 'HBAR') as ConfirmPaymentParams['tokenType'];
    return {
      ok: true,
      params: {
        paymentLinkId: link.id,
        provider: 'hedera',
        providerRef: hederaEvent.hedera_transaction_id,
        transactionId: hederaEvent.hedera_transaction_id,
        amountReceived: Number(hederaEvent.amount_received ?? amountReceived),
        currencyReceived: hederaEvent.currency_received ?? currencyReceived,
        tokenType,
        metadata: {
          historicalRepair: true,
          repairCohort: 'C',
          source: 'historical-payment-repair',
        },
      },
    };
  }

  const stripeEvent = await prisma.payment_events.findFirst({
    where: {
      payment_link_id: paymentLinkId,
      stripe_payment_intent_id: { not: null },
    },
    orderBy: { created_at: 'desc' },
    select: { stripe_payment_intent_id: true, stripe_event_id: true },
  });

  if (stripeEvent?.stripe_payment_intent_id) {
    return {
      ok: true,
      params: {
        paymentLinkId: link.id,
        provider: 'stripe',
        providerRef: stripeEvent.stripe_event_id ?? `historical-repair-${link.id}`,
        paymentIntentId: stripeEvent.stripe_payment_intent_id,
        amountReceived,
        currencyReceived,
        metadata: {
          historicalRepair: true,
          repairCohort: 'A',
          source: 'historical-payment-repair',
        },
      },
    };
  }

  if (link.payment_method === 'STRIPE' || link.payment_method === 'WISE') {
    return {
      ok: true,
      params: {
        paymentLinkId: link.id,
        provider: link.payment_method === 'WISE' ? 'wise' : 'stripe',
        providerRef: `historical-repair:${link.id}`,
        amountReceived,
        currencyReceived,
        metadata: {
          historicalRepair: true,
          repairCohort: 'A',
          source: 'historical-payment-repair',
          warning: 'no_provider_ref_on_events_using_synthetic_ref',
        },
      },
    };
  }

  return {
    ok: true,
    params: {
      paymentLinkId: link.id,
      provider: 'manual',
      providerRef: manualSettlementProviderRef(link.id),
      amountReceived,
      currencyReceived,
      metadata: {
        historicalRepair: true,
        repairCohort: 'E',
        source: 'historical-payment-repair',
        reason: 'operator_manual_backfill',
      },
    },
  };
}

async function writeRepairAudit(params: {
  paymentLinkId: string;
  organizationId: string;
  cohort: HistoricalRepairCohort;
  action: string;
  dryRun: boolean;
  details: Record<string, unknown>;
  actorUserId?: string;
}): Promise<void> {
  log.info('historical_payment_repair_action', {
    paymentLinkId: params.paymentLinkId,
    organizationId: params.organizationId,
    cohort: params.cohort,
    action: params.action,
    dryRun: params.dryRun,
    ...params.details,
  });

  if (params.dryRun) return;

  try {
    await prisma.audit_logs.create({
      data: {
        organization_id: params.organizationId,
        user_id: params.actorUserId ?? 'system-historical-payment-repair',
        entity_type: 'HistoricalPaymentRepair',
        entity_id: params.paymentLinkId,
        action: 'HISTORICAL_PAYMENT_REPAIR',
        new_values: {
          cohort: params.cohort,
          repairAction: params.action,
          ...params.details,
        },
      },
    });
  } catch {
    // Non-blocking
  }
}

export async function repairSettlementForLink(
  paymentLinkId: string,
  options: { dryRun: boolean; actorUserId?: string; cohort: HistoricalRepairCohort }
): Promise<{
  success: boolean;
  paymentEventId?: string;
  alreadyProcessed?: boolean;
  error?: string;
  skipped?: boolean;
  reason?: string;
}> {
  const link = await prisma.payment_links.findUnique({
    where: { id: paymentLinkId },
    select: { id: true, organization_id: true, status: true },
  });
  if (!link) {
    return { success: false, error: 'payment_link_not_found' };
  }

  const hasConfirmed = await prisma.payment_events.findFirst({
    where: { payment_link_id: paymentLinkId, event_type: 'PAYMENT_CONFIRMED' },
    select: { id: true },
  });
  if (hasConfirmed) {
    return { success: true, skipped: true, reason: 'payment_confirmed_already_exists' };
  }

  if (link.status !== 'PAID') {
    return { success: false, skipped: true, reason: 'link_not_paid' };
  }

  const resolved = await resolveHistoricalSettlementParams(paymentLinkId);
  if (!resolved.ok) {
    return { success: false, error: resolved.reason };
  }

  await writeRepairAudit({
    paymentLinkId,
    organizationId: link.organization_id,
    cohort: options.cohort,
    action: 'settlement_confirm_payment',
    dryRun: options.dryRun,
    details: {
      provider: resolved.params.provider,
      providerRef: resolved.params.providerRef,
    },
    actorUserId: options.actorUserId,
  });

  if (options.dryRun) {
    return { success: true, skipped: false, reason: 'dry_run' };
  }

  const result = await confirmPayment(resolved.params);
  if (!result.success) {
    return { success: false, error: result.error };
  }

  return {
    success: true,
    paymentEventId: result.paymentEventId,
    alreadyProcessed: result.alreadyProcessed,
  };
}

export async function repairCommissionForPaymentEvent(
  paymentEventId: string,
  options: {
    dryRun: boolean;
    cohort: HistoricalRepairCohort;
    paymentLinkId: string;
    organizationId: string;
    actorUserId?: string;
  }
): Promise<ReconcileCommissionResult> {
  await writeRepairAudit({
    paymentLinkId: options.paymentLinkId,
    organizationId: options.organizationId,
    cohort: options.cohort,
    action: 'commission_reconcile',
    dryRun: options.dryRun,
    details: { paymentEventId },
    actorUserId: options.actorUserId,
  });

  return reconcileCommissionArtifactsForPaymentEvent(paymentEventId, {
    dryRun: options.dryRun,
    orchestrateFunding: true,
    postMissingLedger: true,
    correlationId: `historical-repair-${paymentEventId}`,
  });
}

export async function buildHistoricalRepairInventory(
  options: HistoricalRepairOptions
): Promise<HistoricalRepairRecord[]> {
  const orgFilter = options.organizationIds?.length
    ? { organization_id: { in: options.organizationIds } }
    : {};
  const createdFilter = options.createdBefore
    ? { created_at: { lt: options.createdBefore } }
    : {};

  const records: HistoricalRepairRecord[] = [];

  const paidWithout = await prisma.payment_links.findMany({
    where: {
      status: 'PAID',
      ...orgFilter,
      ...createdFilter,
      payment_events: { none: { event_type: 'PAYMENT_CONFIRMED' } },
    },
    select: { id: true, organization_id: true, payment_method: true },
    take: options.limit ?? 500,
    orderBy: { created_at: 'asc' },
  });

  for (const link of paidWithout) {
    const cohort = await classifyHistoricalCohort({ paymentLinkId: link.id });
    records.push({
      paymentLinkId: link.id,
      organizationId: link.organization_id,
      cohort,
      plannedAction: 'settlement_confirm_payment',
    });
  }

  const confirmedEvents = await prisma.payment_events.findMany({
    where: {
      event_type: 'PAYMENT_CONFIRMED',
      payment_link_id: { not: null },
      ...createdFilter,
      ...(options.organizationIds?.length
        ? { payment_links: { organization_id: { in: options.organizationIds } } }
        : {}),
    },
    select: {
      id: true,
      payment_link_id: true,
      metadata: true,
      source_reference: true,
      payment_links: { select: { organization_id: true } },
    },
    take: options.limit ?? 1000,
    orderBy: { created_at: 'asc' },
  });

  for (const pe of confirmedEvents) {
    if (!pe.payment_link_id) continue;
    const cohort = await classifyHistoricalCohort({
      paymentLinkId: pe.payment_link_id,
      paymentEventId: pe.id,
    });

    if (cohort === 'A') continue;

    const gaps = await detectCommissionArtifactGaps(pe.id);
    const repairable = gaps.filter(
      (g) =>
        g !== 'INCOMPLETE_COMMISSION_METADATA' &&
        g !== 'COMMISSION_BELOW_MINIMUM' &&
        g !== 'NO_PAYMENT_CONFIRMED_EVENT'
    );

    const needsReconcile = repairable.length > 0 || cohort === 'C' || cohort === 'D' || cohort === 'E';

    if (!needsReconcile && cohort === 'B') continue;

    records.push({
      paymentLinkId: pe.payment_link_id,
      organizationId: pe.payment_links.organization_id,
      cohort: cohort === 'B' && repairable.length > 0 ? 'F' : cohort,
      paymentEventId: pe.id,
      plannedAction: needsReconcile ? 'commission_reconcile' : 'skip',
      reason: needsReconcile ? gaps.join(',') : 'complete',
    });
  }

  if (options.cohort && options.cohort !== 'all') {
    if (options.cohort === 'B') {
      return records.filter((r) => r.cohort === 'B' || r.cohort === 'F');
    }
    return records.filter((r) => r.cohort === options.cohort);
  }

  return records;
}

export async function runHistoricalPaymentRepair(
  options: HistoricalRepairOptions = {}
): Promise<HistoricalRepairRunResult> {
  const dryRun = options.dryRun !== false;
  const cohortFilter = options.cohort ?? 'all';
  const actorUserId = options.actorUserId ?? 'system-historical-payment-repair';

  const inventory = await buildHistoricalRepairInventory(options);

  const executed: HistoricalRepairRunResult['executed'] = [];
  let settlementRepairs = 0;
  let commissionRepairs = 0;
  let skipped = 0;
  let failed = 0;

  const cohortA = inventory.filter((r) => r.plannedAction === 'settlement_confirm_payment');
  for (const row of cohortA) {
    const out = await repairSettlementForLink(row.paymentLinkId, {
      dryRun,
      actorUserId,
      cohort: row.cohort,
    });
    if (out.skipped) skipped += 1;
    else if (out.success && !dryRun && !out.reason?.includes('dry_run')) settlementRepairs += 1;
    else if (!out.success) failed += 1;
    executed.push({
      paymentLinkId: row.paymentLinkId,
      cohort: row.cohort,
      action: 'settlement_confirm_payment',
      success: out.success,
      paymentEventId: out.paymentEventId,
      alreadyProcessed: out.alreadyProcessed,
      error: out.error ?? out.reason,
    });
  }

  const cohortBc = inventory.filter((r) => r.plannedAction === 'commission_reconcile');
  for (const row of cohortBc) {
    if (!row.paymentEventId) {
      skipped += 1;
      continue;
    }
    const result = await repairCommissionForPaymentEvent(row.paymentEventId, {
      dryRun,
      cohort: row.cohort,
      paymentLinkId: row.paymentLinkId,
      organizationId: row.organizationId,
      actorUserId,
    });
    if (result.status === 'skipped' || result.status === 'complete') {
      if (result.status === 'complete') skipped += 1;
      else skipped += 1;
    } else if (result.status === 'repaired' && !dryRun) {
      commissionRepairs += 1;
    } else if (result.status === 'failed') {
      failed += 1;
    }
    executed.push({
      paymentLinkId: row.paymentLinkId,
      cohort: row.cohort,
      action: 'commission_reconcile',
      success: result.status !== 'failed',
      paymentEventId: row.paymentEventId,
      reconcileStatus: result.status,
      gapsBefore: result.gapsBefore,
      error: result.error,
    });
  }

  return {
    dryRun,
    cohortFilter,
    records: inventory,
    executed,
    summary: {
      scanned: inventory.length,
      planned: inventory.filter((r) => r.plannedAction !== 'skip').length,
      skipped,
      settlementRepairs,
      commissionRepairs,
      failed,
    },
  };
}
