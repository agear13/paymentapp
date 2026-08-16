import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/server/prisma';
import { loggers } from '@/lib/logger';
import type { IngestTreasuryEventInput } from '@/lib/treasury/events/types';

const log = loggers.payment;

function toDecimal(value: string | number | null | undefined): Prisma.Decimal | null {
  if (value === null || value === undefined || value === '') return null;
  return new Prisma.Decimal(value);
}

export type IngestTreasuryEventResult = {
  eventId: string;
  created: boolean;
};

/**
 * Idempotent treasury event ingest.
 * Unique on (organization_id, provider, provider_reference, event_type).
 */
export async function ingestTreasuryEvent(
  input: IngestTreasuryEventInput
): Promise<IngestTreasuryEventResult> {
  const normalizedHash = input.transactionHash?.trim().toLowerCase() || null;

  const data = {
    organization_id: input.organizationId,
    event_type: input.eventType,
    status: input.status ?? 'CONFIRMED',
    provider: input.provider,
    provider_reference: input.providerReference,
    asset: input.asset?.trim().toUpperCase() || null,
    destination_asset: input.destinationAsset?.trim().toUpperCase() || null,
    amount: toDecimal(input.amount),
    destination_amount: toDecimal(input.destinationAmount),
    exchange_rate: toDecimal(input.exchangeRate),
    fee_amount: toDecimal(input.feeAmount),
    fee_currency: input.feeCurrency?.trim().toUpperCase() || null,
    source_address: input.sourceAddress?.trim() || null,
    destination_address: input.destinationAddress?.trim() || null,
    wallet_network: input.walletNetwork?.trim() || null,
    transaction_hash: normalizedHash,
    payment_link_id: input.paymentLinkId ?? null,
    payment_event_id: input.paymentEventId ?? null,
    parent_treasury_event_id: input.parentTreasuryEventId ?? null,
    occurred_at: input.occurredAt,
    metadata: input.metadata ?? undefined,
    raw_provider_payload: input.rawProviderPayload ?? undefined,
  };

  const existing = await prisma.treasury_events.findUnique({
    where: {
      ux_treasury_events_idempotency: {
        organization_id: input.organizationId,
        provider: input.provider,
        provider_reference: input.providerReference,
        event_type: input.eventType,
      },
    },
    select: { id: true },
  });

  if (existing) {
    return { eventId: existing.id, created: false };
  }

  try {
    const created = await prisma.treasury_events.create({ data });
    log.info('Treasury event ingested', {
      treasuryEventId: created.id,
      eventType: input.eventType,
      provider: input.provider,
      organizationId: input.organizationId,
    });
    return { eventId: created.id, created: true };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      const dup = await prisma.treasury_events.findUnique({
        where: {
          ux_treasury_events_idempotency: {
            organization_id: input.organizationId,
            provider: input.provider,
            provider_reference: input.providerReference,
            event_type: input.eventType,
          },
        },
        select: { id: true },
      });
      if (dup) {
        return { eventId: dup.id, created: false };
      }
    }
    throw error;
  }
}
