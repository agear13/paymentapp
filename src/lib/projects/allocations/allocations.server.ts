import 'server-only';

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/server/prisma';
import { assertProjectOwnedByUser } from '@/lib/projects/funding-sources/funding-sources.server';
import type {
  ProjectAllocationBudgetType,
  ProjectAllocationDto,
  ProjectAllocationStatus,
} from '@/lib/projects/allocations/types';

function toNumber(v: unknown): number {
  if (v == null) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function deriveStatusFromParticipant(
  current: ProjectAllocationStatus,
  participantId: string | null | undefined
): ProjectAllocationStatus {
  if (participantId) {
    if (current === 'PLANNED') return 'ASSIGNED';
    return current;
  }
  if (current === 'ASSIGNED') return 'PLANNED';
  return current;
}

export function rowToAllocationDto(
  row: {
    id: string;
    project_id: string;
    title: string;
    role: string;
    description: string | null;
    budget_type: string;
    budget_value: unknown;
    currency: string;
    planned_budget_value: unknown;
    actual_budget_value: unknown | null;
    participant_id: string | null;
    status: string;
    notes: string | null;
    created_at: Date;
    updated_at: Date;
    participant?: { name: string } | null;
  }
): ProjectAllocationDto {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    role: row.role,
    description: row.description,
    budgetType: row.budget_type as ProjectAllocationBudgetType,
    budgetValue: toNumber(row.budget_value),
    currency: row.currency,
    plannedBudgetValue: toNumber(row.planned_budget_value),
    actualBudgetValue: row.actual_budget_value != null ? toNumber(row.actual_budget_value) : null,
    participantId: row.participant_id,
    participantName: row.participant?.name ?? null,
    status: row.status as ProjectAllocationStatus,
    notes: row.notes,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function listProjectAllocations(
  userId: string,
  projectId: string
): Promise<ProjectAllocationDto[]> {
  const rows = await prisma.project_allocations.findMany({
    where: { user_id: userId, project_id: projectId },
    orderBy: [{ status: 'asc' }, { created_at: 'asc' }],
    include: { participant: { select: { name: true } } },
  });
  return rows.map(rowToAllocationDto);
}

export type CreateAllocationInput = {
  title: string;
  role: string;
  description?: string | null;
  budgetType: ProjectAllocationBudgetType;
  budgetValue: number;
  currency?: string;
  notes?: string | null;
};

export async function createProjectAllocation(
  userId: string,
  projectId: string,
  input: CreateAllocationInput
): Promise<ProjectAllocationDto> {
  const budgetDecimal = new Prisma.Decimal(input.budgetValue);
  const row = await prisma.project_allocations.create({
    data: {
      project_id: projectId,
      user_id: userId,
      title: input.title.trim(),
      role: input.role.trim(),
      description: input.description?.trim() || null,
      budget_type: input.budgetType,
      budget_value: budgetDecimal,
      planned_budget_value: budgetDecimal,
      currency: (input.currency ?? 'USD').toUpperCase().slice(0, 3),
      status: 'PLANNED',
      notes: input.notes?.trim() || null,
    },
    include: { participant: { select: { name: true } } },
  });
  return rowToAllocationDto(row);
}

export type UpdateAllocationInput = Partial<CreateAllocationInput> & {
  participantId?: string | null;
  status?: ProjectAllocationStatus;
};

export async function updateProjectAllocation(
  userId: string,
  projectId: string,
  allocationId: string,
  input: UpdateAllocationInput
): Promise<ProjectAllocationDto | null> {
  const existing = await prisma.project_allocations.findFirst({
    where: { id: allocationId, user_id: userId, project_id: projectId },
  });
  if (!existing) return null;

  if (input.participantId) {
    const participant = await prisma.deal_network_pilot_participants.findFirst({
      where: { id: input.participantId, deal_id: projectId },
      select: { id: true },
    });
    if (!participant) return null;
  }

  const nextStatus =
    input.status ??
    deriveStatusFromParticipant(
      existing.status as ProjectAllocationStatus,
      input.participantId !== undefined ? input.participantId : existing.participant_id
    );

  const row = await prisma.project_allocations.update({
    where: { id: allocationId },
    data: {
      ...(input.title != null ? { title: input.title.trim() } : {}),
      ...(input.role != null ? { role: input.role.trim() } : {}),
      ...(input.description !== undefined
        ? { description: input.description?.trim() || null }
        : {}),
      ...(input.budgetType != null ? { budget_type: input.budgetType } : {}),
      ...(input.budgetValue != null
        ? {
            budget_value: new Prisma.Decimal(input.budgetValue),
            planned_budget_value: new Prisma.Decimal(input.budgetValue),
          }
        : {}),
      ...(input.currency != null
        ? { currency: input.currency.toUpperCase().slice(0, 3) }
        : {}),
      ...(input.notes !== undefined ? { notes: input.notes?.trim() || null } : {}),
      ...(input.participantId !== undefined
        ? { participant_id: input.participantId }
        : {}),
      status: nextStatus,
    },
    include: { participant: { select: { name: true } } },
  });
  return rowToAllocationDto(row);
}

export async function deleteProjectAllocation(
  userId: string,
  projectId: string,
  allocationId: string
): Promise<boolean> {
  const existing = await prisma.project_allocations.findFirst({
    where: { id: allocationId, user_id: userId, project_id: projectId },
    select: { id: true },
  });
  if (!existing) return false;
  await prisma.project_allocations.delete({ where: { id: allocationId } });
  return true;
}

export { assertProjectOwnedByUser };
