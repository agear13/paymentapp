import { prisma } from '@/lib/server/prisma';
import type { TreasuryEventStatus } from '@prisma/client';
import { ingestTreasuryEventLink } from '@/lib/treasury/events/treasury-event-links';

export type CorrelationMatchStrategy =
  | 'transaction_hash'
  | 'provider_deposit_reference'
  | 'deposit_address_with_hash'
  | 'known_deposit_address_with_hash'
  | 'provider_object_id'
  | 'manual'
  | 'none';

export type CorrelationCandidate = {
  sourceEventId: string;
  targetEventId: string;
  strategy: CorrelationMatchStrategy;
  status: TreasuryEventStatus;
};

type TreasuryEventRow = {
  id: string;
  organization_id: string;
  event_type: string;
  status: TreasuryEventStatus;
  transaction_hash: string | null;
  provider_reference: string;
  payment_link_id: string | null;
  source_address: string | null;
  destination_address: string | null;
  amount: { toString(): string } | null;
  asset: string | null;
  metadata?: unknown;
};

function dsMeta(row: TreasuryEventRow): Record<string, unknown> | null {
  const meta = row.metadata as Record<string, unknown> | null;
  const ds = meta?.digital_surge;
  return ds && typeof ds === 'object' ? (ds as Record<string, unknown>) : null;
}

function normalizeAddress(value: string | null | undefined): string | null {
  return value?.trim().toLowerCase() || null;
}

/**
 * Deterministic correlation between treasury events.
 * Never matches on amount alone or timestamp alone.
 */
export function findDeterministicCorrelation(
  source: TreasuryEventRow,
  target: TreasuryEventRow,
  options?: { knownDepositAddresses?: Set<string> }
): CorrelationCandidate | null {
  if (source.organization_id !== target.organization_id) {
    return null;
  }

  if (source.payment_link_id && target.payment_link_id) {
    if (source.payment_link_id !== target.payment_link_id) {
      return null;
    }
  }

  const sourceHash = source.transaction_hash?.toLowerCase().trim();
  const targetHash = target.transaction_hash?.toLowerCase().trim();

  if (sourceHash && targetHash && sourceHash === targetHash) {
    if (
      source.event_type === 'WALLET_TRANSFER' &&
      target.event_type === 'EXCHANGE_DEPOSIT' &&
      options?.knownDepositAddresses?.size
    ) {
      const dest = normalizeAddress(source.destination_address);
      if (dest && !options.knownDepositAddresses.has(dest)) {
        return null;
      }
    }

    return {
      sourceEventId: source.id,
      targetEventId: target.id,
      strategy:
        source.event_type === 'WALLET_TRANSFER' && target.event_type === 'EXCHANGE_DEPOSIT'
          ? 'known_deposit_address_with_hash'
          : 'transaction_hash',
      status: 'CONFIRMED',
    };
  }

  if (
    source.event_type === 'WALLET_TRANSFER' &&
    target.event_type === 'EXCHANGE_DEPOSIT' &&
    sourceHash &&
    targetHash &&
    sourceHash === targetHash
  ) {
    const dest = normalizeAddress(source.destination_address);
    if (dest && options?.knownDepositAddresses?.has(dest)) {
      return {
        sourceEventId: source.id,
        targetEventId: target.id,
        strategy: 'deposit_address_with_hash',
        status: 'CONFIRMED',
      };
    }
  }

  if (
    source.event_type === 'ASSET_RECEIVED' &&
    target.event_type === 'EXCHANGE_DEPOSIT' &&
    source.provider_reference &&
    target.provider_reference &&
    source.provider_reference === target.provider_reference
  ) {
    return {
      sourceEventId: source.id,
      targetEventId: target.id,
      strategy: 'provider_deposit_reference',
      status: 'CONFIRMED',
    };
  }

  return null;
}

/** Reject weak matches — amount-only and timestamp-only are never valid. */
export function isWeakCorrelationAttempt(params: {
  matchOnAmountOnly?: boolean;
  matchOnTimestampOnly?: boolean;
}): boolean {
  return Boolean(params.matchOnAmountOnly || params.matchOnTimestampOnly);
}

export function findDepositToConversionCorrelation(
  deposit: TreasuryEventRow,
  conversion: TreasuryEventRow
): CorrelationCandidate | null {
  if (deposit.organization_id !== conversion.organization_id) return null;
  if (deposit.event_type !== 'EXCHANGE_DEPOSIT' || conversion.event_type !== 'CONVERSION') {
    return null;
  }

  const depositHash = deposit.transaction_hash?.toLowerCase().trim();
  const conversionHash = conversion.transaction_hash?.toLowerCase().trim();
  if (depositHash && conversionHash && depositHash === conversionHash) {
    return {
      sourceEventId: deposit.id,
      targetEventId: conversion.id,
      strategy: 'transaction_hash',
      status: 'CONFIRMED',
    };
  }

  const depositDs = dsMeta(deposit);
  const conversionDs = dsMeta(conversion);
  const depositObjectId = depositDs?.objectId ?? depositDs?.object_id;
  const conversionObjectId = conversionDs?.objectId ?? conversionDs?.object_id;

  if (
    depositObjectId != null &&
    conversionObjectId != null &&
    String(depositObjectId) === String(conversionObjectId)
  ) {
    return {
      sourceEventId: deposit.id,
      targetEventId: conversion.id,
      strategy: 'provider_object_id',
      status: 'CONFIRMED',
    };
  }

  const conversionParent = (conversion.metadata as Record<string, unknown> | null)
    ?.source_conversion;
  if (
    typeof conversionParent === 'string' &&
    conversionParent === deposit.provider_reference
  ) {
    return {
      sourceEventId: deposit.id,
      targetEventId: conversion.id,
      strategy: 'provider_deposit_reference',
      status: 'CONFIRMED',
    };
  }

  return null;
}

async function createCorrelationLink(
  organizationId: string,
  match: CorrelationCandidate,
  linkType: 'CORRELATION' | 'PARENT_CHILD' = 'CORRELATION'
): Promise<boolean> {
  const result = await ingestTreasuryEventLink({
    organizationId,
    sourceEventId: match.sourceEventId,
    targetEventId: match.targetEventId,
    linkType,
    linkStatus: match.status,
    evidence: { strategy: match.strategy },
  });
  return result.created;
}

export async function correlateExchangeDepositsForOrganization(
  organizationId: string,
  knownDepositAddresses?: Set<string>
): Promise<number> {
  const sources = await prisma.treasury_events.findMany({
    where: {
      organization_id: organizationId,
      event_type: { in: ['ASSET_RECEIVED', 'WALLET_TRANSFER'] },
    },
  });

  const deposits = await prisma.treasury_events.findMany({
    where: {
      organization_id: organizationId,
      event_type: 'EXCHANGE_DEPOSIT',
    },
  });

  let linked = 0;

  for (const source of sources) {
    for (const target of deposits) {
      const match = findDeterministicCorrelation(source, target, { knownDepositAddresses });
      if (!match) continue;

      const created = await createCorrelationLink(organizationId, match);
      if (!created) continue;

      if (target.status === 'UNKNOWN') {
        await prisma.treasury_events.update({
          where: { id: target.id },
          data: { status: match.status },
        });
      }

      if (source.payment_link_id && !target.payment_link_id) {
        await prisma.treasury_events.update({
          where: { id: target.id },
          data: { payment_link_id: source.payment_link_id },
        });
      }

      linked += 1;
    }
  }

  return linked;
}

export async function linkConversionToDeposit(
  organizationId: string,
  conversionEventId: string,
  depositEventId: string,
  strategy: CorrelationMatchStrategy
): Promise<void> {
  await ingestTreasuryEventLink({
    organizationId,
    sourceEventId: depositEventId,
    targetEventId: conversionEventId,
    linkType: 'PARENT_CHILD',
    linkStatus: 'CONFIRMED',
    evidence: { relation: 'deposit_to_conversion', strategy },
  });
}

export async function correlateConversionsForOrganization(
  organizationId: string
): Promise<number> {
  const conversions = await prisma.treasury_events.findMany({
    where: { organization_id: organizationId, event_type: 'CONVERSION' },
  });

  const deposits = await prisma.treasury_events.findMany({
    where: { organization_id: organizationId, event_type: 'EXCHANGE_DEPOSIT' },
  });

  let linked = 0;
  for (const conversion of conversions) {
    for (const deposit of deposits) {
      const match = findDepositToConversionCorrelation(deposit, conversion);
      if (!match) continue;

      const created = await createCorrelationLink(organizationId, match, 'PARENT_CHILD');
      if (created) linked += 1;

      if (deposit.payment_link_id && !conversion.payment_link_id) {
        await prisma.treasury_events.update({
          where: { id: conversion.id },
          data: { payment_link_id: deposit.payment_link_id },
        });
      }
    }
  }

  return linked;
}
