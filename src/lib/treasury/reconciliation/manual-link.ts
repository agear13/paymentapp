import { prisma } from '@/lib/server/prisma';
import type { TreasuryEventStatus } from '@prisma/client';
import {
  findDeterministicCorrelation,
} from '@/lib/treasury/reconciliation/correlation';

export class ManualReconciliationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ManualReconciliationError';
  }
}

export async function createManualTreasuryLink(params: {
  organizationId: string;
  sourceEventId: string;
  targetEventId: string;
  linkedByUserId: string;
  notes?: string | null;
  /** Explicit merchant confirmation — never silently upgrade UNKNOWN */
  confirmLink: boolean;
}): Promise<{
  linkId: string;
  auditId: string;
  manualReconciliation: {
    linkId: string;
    auditId: string;
    linkedAt: string;
    linkedByUserId: string;
    notes: string | null;
    linkStatus: TreasuryEventStatus;
    manual: true;
    sourceEventId: string;
    targetEventId: string;
  };
}> {
  if (params.sourceEventId === params.targetEventId) {
    throw new ManualReconciliationError('Cannot link an event to itself');
  }

  const [source, target] = await Promise.all([
    prisma.treasury_events.findFirst({
      where: { id: params.sourceEventId, organization_id: params.organizationId },
    }),
    prisma.treasury_events.findFirst({
      where: { id: params.targetEventId, organization_id: params.organizationId },
    }),
  ]);

  if (!source || !target) {
    throw new ManualReconciliationError('One or both treasury events were not found');
  }

  if (source.event_type === 'BANK_SETTLEMENT' || target.event_type === 'BANK_SETTLEMENT') {
    throw new ManualReconciliationError(
      'Manual links cannot create or confirm bank settlement without independent bank evidence'
    );
  }

  if (source.payment_link_id && target.payment_link_id) {
    if (source.payment_link_id !== target.payment_link_id) {
      throw new ManualReconciliationError('Cross-invoice linking is not permitted');
    }
  }

  const deterministic = findDeterministicCorrelation(source, target);
  const previousStatus = target.status;
  const newStatus: TreasuryEventStatus = params.confirmLink
    ? deterministic?.status ?? 'INFERRED'
    : 'INFERRED';

  if (!params.confirmLink) {
    throw new ManualReconciliationError('Manual link requires explicit merchant confirmation');
  }

  const evidence = {
    previous_status: previousStatus,
    new_status: newStatus,
    deterministic_strategy: deterministic?.strategy ?? null,
    source_event: {
      id: source.id,
      event_type: source.event_type,
      provider_reference: source.provider_reference,
      transaction_hash: source.transaction_hash,
    },
    target_event: {
      id: target.id,
      event_type: target.event_type,
      provider_reference: target.provider_reference,
      transaction_hash: target.transaction_hash,
    },
  };

  const link = await prisma.treasury_event_links.upsert({
    where: {
      ux_treasury_event_links_pair: {
        source_event_id: params.sourceEventId,
        target_event_id: params.targetEventId,
        link_type: 'MANUAL',
      },
    },
    create: {
      organization_id: params.organizationId,
      source_event_id: params.sourceEventId,
      target_event_id: params.targetEventId,
      link_type: 'MANUAL',
      link_status: newStatus,
      created_by_user_id: params.linkedByUserId,
      evidence,
    },
    update: {
      link_status: newStatus,
      created_by_user_id: params.linkedByUserId,
      evidence,
    },
  });

  const audit = await prisma.treasury_manual_reconciliations.create({
    data: {
      organization_id: params.organizationId,
      source_event_id: params.sourceEventId,
      target_event_id: params.targetEventId,
      linked_by_user_id: params.linkedByUserId,
      previous_status: previousStatus,
      new_status: newStatus,
      evidence,
      notes: params.notes ?? null,
    },
  });

  await prisma.treasury_events.update({
    where: { id: target.id },
    data: { status: newStatus },
  });

  if (source.payment_link_id && !target.payment_link_id) {
    await prisma.treasury_events.update({
      where: { id: target.id },
      data: { payment_link_id: source.payment_link_id },
    });
  }

  return {
    linkId: link.id,
    auditId: audit.id,
    manualReconciliation: {
      linkId: link.id,
      auditId: audit.id,
      linkedAt: audit.linked_at.toISOString(),
      linkedByUserId: params.linkedByUserId,
      notes: params.notes ?? null,
      linkStatus: newStatus,
      manual: true,
      sourceEventId: params.sourceEventId,
      targetEventId: params.targetEventId,
    },
  };
}

export async function listManualReconciliationCandidates(
  organizationId: string,
  paymentLinkId?: string
): Promise<
  Array<{
    depositEventId: string;
    depositProviderReference: string;
    depositAsset: string | null;
    depositAmount: string | null;
    depositStatus: TreasuryEventStatus;
    possiblePaymentLinkId: string | null;
  }>
> {
  const deposits = await prisma.treasury_events.findMany({
    where: {
      organization_id: organizationId,
      event_type: 'EXCHANGE_DEPOSIT',
      status: { in: ['UNKNOWN', 'INFERRED'] },
      ...(paymentLinkId ? {} : {}),
    },
    orderBy: { occurred_at: 'desc' },
    take: 50,
  });

  return deposits
    .filter((d) => !paymentLinkId || !d.payment_link_id || d.payment_link_id === paymentLinkId)
    .map((d) => ({
      depositEventId: d.id,
      depositProviderReference: d.provider_reference,
      depositAsset: d.asset,
      depositAmount: d.amount?.toString() ?? null,
      depositStatus: d.status,
      possiblePaymentLinkId: d.payment_link_id,
    }));
}
