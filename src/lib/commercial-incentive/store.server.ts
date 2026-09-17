import 'server-only';

import { prisma } from '@/lib/server/prisma';
import type { EarlyPaymentIncentiveRecord } from '@/lib/commercial-incentive/types';

export const COMMERCIAL_INCENTIVE_ENTITY_TYPE = 'commercial_incentive';

function asRecord(value: unknown): EarlyPaymentIncentiveRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Partial<EarlyPaymentIncentiveRecord>;
  if (raw.kind !== 'early_payment_discount') return null;
  if (raw.origin !== 'provvy_recommendation') return null;
  if (raw.status !== 'approved' && raw.status !== 'dismissed') return null;
  if (raw.compensationType !== 'conditional_bonus') return null;
  if (typeof raw.sourceAgreementId !== 'string' || typeof raw.workflowId !== 'string') return null;
  return raw as EarlyPaymentIncentiveRecord;
}

export async function getEarlyPaymentIncentiveDecision(
  organizationId: string,
  agreementId: string
): Promise<EarlyPaymentIncentiveRecord | null> {
  const row = await prisma.audit_logs.findFirst({
    where: {
      organization_id: organizationId,
      entity_type: COMMERCIAL_INCENTIVE_ENTITY_TYPE,
      entity_id: agreementId,
    },
    orderBy: { created_at: 'desc' },
  });
  return asRecord(row?.new_values);
}

export async function saveEarlyPaymentIncentiveDecision(input: {
  organizationId: string;
  userId: string;
  record: EarlyPaymentIncentiveRecord;
}): Promise<EarlyPaymentIncentiveRecord> {
  await prisma.audit_logs.create({
    data: {
      organization_id: input.organizationId,
      user_id: input.userId,
      entity_type: COMMERCIAL_INCENTIVE_ENTITY_TYPE,
      entity_id: input.record.sourceAgreementId,
      action: input.record.status,
      new_values: input.record,
    },
  });
  return input.record;
}
