import 'server-only';

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/server/prisma';
import { getPilotSnapshotForUser } from '@/lib/deal-network-demo/pilot-snapshot.server';
import { sumObligationsAmountForDeal, sumPilotFundingForDeal } from '@/lib/deal-network-demo/pilot-project-funding.server';
import { countProjectObligationEligibleParticipants } from '@/lib/operations/derivations/derive-compensation-settlement-basis';
import { buildProjectTreasurySummary } from '@/lib/projects/funding-sources/treasury-summary';
import { recalculateOperationalFundingState } from '@/lib/operations/lifecycle/funding-lifecycle';
import type { ProjectFundingSourceDto, ProjectTreasurySummary } from '@/lib/projects/funding-sources/types';

function toNumber(v: unknown): number {
  if (v == null) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function rowToFundingSourceDto(row: {
  id: string;
  project_id: string;
  organization_id: string | null;
  name: string;
  description: string | null;
  source_type: string;
  amount: unknown;
  currency: string;
  status: string;
  confidence_level: string;
  expected_settlement_date: Date | null;
  actual_settlement_date: Date | null;
  linked_invoice_id: string | null;
  linked_payment_id: string | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}): ProjectFundingSourceDto {
  return {
    id: row.id,
    projectId: row.project_id,
    organizationId: row.organization_id,
    name: row.name,
    description: row.description,
    sourceType: row.source_type as ProjectFundingSourceDto['sourceType'],
    amount: toNumber(row.amount),
    currency: row.currency,
    status: row.status as ProjectFundingSourceDto['status'],
    confidenceLevel: row.confidence_level as ProjectFundingSourceDto['confidenceLevel'],
    expectedSettlementDate: row.expected_settlement_date?.toISOString() ?? null,
    actualSettlementDate: row.actual_settlement_date?.toISOString() ?? null,
    linkedInvoiceId: row.linked_invoice_id,
    linkedPaymentId: row.linked_payment_id,
    notes: row.notes,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function assertProjectOwnedByUser(
  userId: string,
  projectId: string
): Promise<boolean> {
  const deal = await prisma.deal_network_pilot_deals.findFirst({
    where: { id: projectId, user_id: userId },
    select: { id: true },
  });
  return Boolean(deal);
}

export async function listProjectFundingSources(
  userId: string,
  projectId: string
): Promise<ProjectFundingSourceDto[]> {
  const rows = await prisma.project_funding_sources.findMany({
    where: { user_id: userId, project_id: projectId },
    orderBy: [{ status: 'asc' }, { expected_settlement_date: 'asc' }, { created_at: 'desc' }],
  });
  return rows.map(rowToFundingSourceDto);
}

export type CreateFundingSourceInput = {
  name: string;
  description?: string | null;
  sourceType: ProjectFundingSourceDto['sourceType'];
  amount: number;
  currency: string;
  status?: ProjectFundingSourceDto['status'];
  confidenceLevel?: ProjectFundingSourceDto['confidenceLevel'];
  expectedSettlementDate?: string | null;
  actualSettlementDate?: string | null;
  linkedInvoiceId?: string | null;
  linkedPaymentId?: string | null;
  notes?: string | null;
  organizationId?: string | null;
};

export async function createProjectFundingSource(
  userId: string,
  projectId: string,
  input: CreateFundingSourceInput
): Promise<ProjectFundingSourceDto> {
  const row = await prisma.project_funding_sources.create({
    data: {
      project_id: projectId,
      user_id: userId,
      organization_id: input.organizationId ?? null,
      name: input.name,
      description: input.description ?? null,
      source_type: input.sourceType,
      amount: new Prisma.Decimal(input.amount.toFixed(2)),
      currency: input.currency.toUpperCase(),
      status: input.status ?? 'forecast',
      confidence_level: input.confidenceLevel ?? 'medium',
      expected_settlement_date: input.expectedSettlementDate
        ? new Date(input.expectedSettlementDate)
        : null,
      actual_settlement_date: input.actualSettlementDate
        ? new Date(input.actualSettlementDate)
        : null,
      linked_invoice_id: input.linkedInvoiceId ?? null,
      linked_payment_id: input.linkedPaymentId ?? null,
      notes: input.notes ?? null,
      created_by: userId,
    },
  });
  return rowToFundingSourceDto(row);
}

export type UpdateFundingSourceInput = Partial<CreateFundingSourceInput>;

export async function updateProjectFundingSource(
  userId: string,
  projectId: string,
  sourceId: string,
  input: UpdateFundingSourceInput
): Promise<ProjectFundingSourceDto | null> {
  const existing = await prisma.project_funding_sources.findFirst({
    where: { id: sourceId, user_id: userId, project_id: projectId },
  });
  if (!existing) return null;

  const row = await prisma.project_funding_sources.update({
    where: { id: sourceId },
    data: {
      ...(input.name != null ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.sourceType != null ? { source_type: input.sourceType } : {}),
      ...(input.amount != null
        ? { amount: new Prisma.Decimal(input.amount.toFixed(2)) }
        : {}),
      ...(input.currency != null ? { currency: input.currency.toUpperCase() } : {}),
      ...(input.status != null ? { status: input.status } : {}),
      ...(input.confidenceLevel != null ? { confidence_level: input.confidenceLevel } : {}),
      ...(input.expectedSettlementDate !== undefined
        ? {
            expected_settlement_date: input.expectedSettlementDate
              ? new Date(input.expectedSettlementDate)
              : null,
          }
        : {}),
      ...(input.actualSettlementDate !== undefined
        ? {
            actual_settlement_date: input.actualSettlementDate
              ? new Date(input.actualSettlementDate)
              : null,
          }
        : {}),
      ...(input.linkedInvoiceId !== undefined
        ? { linked_invoice_id: input.linkedInvoiceId }
        : {}),
      ...(input.linkedPaymentId !== undefined
        ? { linked_payment_id: input.linkedPaymentId }
        : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
    },
  });
  return rowToFundingSourceDto(row);
}

export async function getProjectFundingSource(
  userId: string,
  projectId: string,
  sourceId: string
): Promise<ProjectFundingSourceDto | null> {
  const row = await prisma.project_funding_sources.findFirst({
    where: { id: sourceId, user_id: userId, project_id: projectId },
  });
  return row ? rowToFundingSourceDto(row) : null;
}

export async function deleteProjectFundingSource(
  userId: string,
  projectId: string,
  sourceId: string
): Promise<ProjectFundingSourceDto | null> {
  const existing = await getProjectFundingSource(userId, projectId, sourceId);
  if (!existing) return null;
  await prisma.project_funding_sources.delete({ where: { id: sourceId } });
  return existing;
}

/** Confirmed inflows from payment rails not yet mirrored as funding source rows. */
export async function legacyRailConfirmedFunding(projectId: string): Promise<number> {
  return sumPilotFundingForDeal(projectId);
}

export async function getProjectTreasurySummaryForUser(
  userId: string,
  projectId: string
): Promise<ProjectTreasurySummary | null> {
  const snapshot = await getPilotSnapshotForUser(userId);
  const deal = snapshot.deals.find((d) => d.id === projectId && !d.archived);
  if (!deal) return null;

  const [sources, obligationsTotal, legacyFunding] = await Promise.all([
    listProjectFundingSources(userId, projectId),
    sumObligationsAmountForDeal(userId, projectId),
    legacyRailConfirmedFunding(projectId),
  ]);

  const projectObligationEligibleParticipantCount = countProjectObligationEligibleParticipants(
    snapshot.participants,
    projectId
  );

  const defaultCurrency =
    deal.projectValueCurrency === 'AUD'
      ? 'AUD'
      : sources[0]?.currency ?? 'USD';

  const legacyConfirmed =
    sources.length === 0 || legacyFunding > 0 ? legacyFunding : 0;

  return recalculateOperationalFundingState({
    fundingSources: sources,
    obligationsTotal,
    legacyConfirmedFunding: legacyConfirmed,
    defaultCurrency,
    projectObligationEligibleParticipantCount,
  }).treasury;
}
