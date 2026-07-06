import 'server-only';

import type { PaymentMethod } from '@prisma/client';
import { prisma } from '@/lib/server/prisma';

export async function findPendingPaymentInitiatedByMetadataField(input: {
  paymentMethod: PaymentMethod;
  metadataKeys: string[];
  value: string;
  take?: number;
}): Promise<{ paymentLinkId: string; metadata: Record<string, unknown> } | null> {
  const normalizedValue = input.value.trim().toLowerCase();
  const events = await prisma.payment_events.findMany({
    where: {
      event_type: 'PAYMENT_INITIATED',
      payment_method: input.paymentMethod,
    },
    orderBy: { created_at: 'desc' },
    take: input.take ?? 50,
    select: {
      payment_link_id: true,
      metadata: true,
    },
  });

  for (const event of events) {
    const meta =
      event.metadata && typeof event.metadata === 'object'
        ? (event.metadata as Record<string, unknown>)
        : null;
    if (!meta || !event.payment_link_id) continue;

    for (const key of input.metadataKeys) {
      const candidate = String(meta[key] ?? '').trim().toLowerCase();
      if (candidate && candidate === normalizedValue) {
        return { paymentLinkId: event.payment_link_id, metadata: meta };
      }
    }
  }

  return null;
}
