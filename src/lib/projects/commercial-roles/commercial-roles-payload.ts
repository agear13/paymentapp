import type { RecentDeal } from '@/lib/data/mock-deal-network';
import type { CommercialRole, CommercialRoleStatus } from '@/lib/projects/commercial-roles/types';

export function commercialRolesFromDeal(deal: RecentDeal | null | undefined): CommercialRole[] {
  const roles = deal?.commercialRoles;
  return Array.isArray(roles) ? roles : [];
}

export function deriveCommercialRoleStatus(
  participantId: string | null | undefined
): CommercialRoleStatus {
  return participantId ? 'ASSIGNED' : 'PLANNED';
}

export function newCommercialRoleId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `cr_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export type CreateCommercialRoleInput = {
  title: string;
  description?: string | null;
  budgetType: CommercialRole['budgetType'];
  budgetValue: number;
};

export function addCommercialRoleToDeals(
  deals: RecentDeal[],
  projectId: string,
  input: CreateCommercialRoleInput
): RecentDeal[] {
  const role: CommercialRole = {
    id: newCommercialRoleId(),
    title: input.title.trim(),
    description: input.description?.trim() || null,
    budgetType: input.budgetType,
    budgetValue: input.budgetValue,
    participantId: null,
    status: 'PLANNED',
  };
  return deals.map((d) =>
    d.id === projectId
      ? { ...d, commercialRoles: [...commercialRolesFromDeal(d), role] }
      : d
  );
}

export function assignCommercialRoleInDeals(
  deals: RecentDeal[],
  projectId: string,
  roleId: string,
  participantId: string | null
): RecentDeal[] {
  return deals.map((d) => {
    if (d.id !== projectId) return d;
    const nextRoles = commercialRolesFromDeal(d).map((r) => {
      if (r.id !== roleId) return r;
      return {
        ...r,
        participantId,
        status: deriveCommercialRoleStatus(participantId),
      };
    });
    return { ...d, commercialRoles: nextRoles };
  });
}

export function removeCommercialRoleFromDeals(
  deals: RecentDeal[],
  projectId: string,
  roleId: string
): RecentDeal[] {
  return deals.map((d) =>
    d.id === projectId
      ? {
          ...d,
          commercialRoles: commercialRolesFromDeal(d).filter((r) => r.id !== roleId),
        }
      : d
  );
}

export function participantNameForCommercialRole(
  role: CommercialRole,
  participants: { id: string; name: string }[]
): string | null {
  if (!role.participantId) return null;
  return participants.find((p) => p.id === role.participantId)?.name ?? null;
}
