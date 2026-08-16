import { prisma } from '@/lib/server/prisma';
import type { TreasuryEventStatus, TreasuryLinkType } from '@prisma/client';

export type IngestTreasuryEventLinkInput = {
  organizationId: string;
  sourceEventId: string;
  targetEventId: string;
  linkType: TreasuryLinkType;
  linkStatus?: TreasuryEventStatus;
  evidence?: Record<string, unknown> | null;
};

export type IngestTreasuryEventLinkResult = {
  linkId: string;
  created: boolean;
};

/**
 * Idempotent treasury event link — unique on (source, target, link_type).
 */
export async function ingestTreasuryEventLink(
  input: IngestTreasuryEventLinkInput
): Promise<IngestTreasuryEventLinkResult> {
  const existing = await prisma.treasury_event_links.findUnique({
    where: {
      ux_treasury_event_links_pair: {
        source_event_id: input.sourceEventId,
        target_event_id: input.targetEventId,
        link_type: input.linkType,
      },
    },
    select: { id: true },
  });

  if (existing) {
    return { linkId: existing.id, created: false };
  }

  try {
    const created = await prisma.treasury_event_links.create({
      data: {
        organization_id: input.organizationId,
        source_event_id: input.sourceEventId,
        target_event_id: input.targetEventId,
        link_type: input.linkType,
        link_status: input.linkStatus ?? 'CONFIRMED',
        evidence: input.evidence ?? undefined,
      },
    });
    return { linkId: created.id, created: true };
  } catch {
    const dup = await prisma.treasury_event_links.findUnique({
      where: {
        ux_treasury_event_links_pair: {
          source_event_id: input.sourceEventId,
          target_event_id: input.targetEventId,
          link_type: input.linkType,
        },
      },
      select: { id: true },
    });
    if (dup) {
      return { linkId: dup.id, created: false };
    }
    throw new Error('Failed to create treasury event link');
  }
}
