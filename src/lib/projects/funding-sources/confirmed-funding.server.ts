import 'server-only';

import { prisma } from '@/lib/server/prisma';

function toNumber(v: unknown): number {
  if (v == null) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Sum amounts from funding sources in confirmed / cleared / reconciled status. */
export async function sumConfirmedFundingFromSources(
  userId: string,
  projectId: string
): Promise<number> {
  const rows = await prisma.project_funding_sources.findMany({
    where: {
      user_id: userId,
      project_id: projectId,
      status: { in: ['confirmed', 'cleared', 'reconciled'] },
    },
    select: { amount: true },
  });
  const sum = rows.reduce((acc, r) => acc + toNumber(r.amount), 0);
  return Math.round(sum * 100) / 100;
}

/** Operational confirmed inflows: funding sources + optional legacy rail total. */
export async function sumConfirmedFundingForProject(
  userId: string,
  projectId: string,
  legacyRailFunding: number
): Promise<number> {
  const fromSources = await sumConfirmedFundingFromSources(userId, projectId);
  return Math.round(Math.max(fromSources, legacyRailFunding) * 100) / 100;
}
