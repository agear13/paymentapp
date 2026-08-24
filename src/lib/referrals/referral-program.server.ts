/**
 * Phase 1 ReferralProgram helpers.
 * Resolves an explicit program or the org default (`slug=default`) for new links.
 * Does not move rates, attribution, or settlement off referral_links.
 */

import type { Prisma, PrismaClient } from '@prisma/client';

export const DEFAULT_REFERRAL_PROGRAM_SLUG = 'default';
export const DEFAULT_REFERRAL_PROGRAM_NAME = 'Default Referral Program';

type ReferralProgramClient = PrismaClient | Prisma.TransactionClient;

export class ReferralProgramResolutionError extends Error {
  readonly code = 'REFERRAL_PROGRAM_NOT_FOUND';

  constructor(message: string) {
    super(message);
    this.name = 'ReferralProgramResolutionError';
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: string }).code === 'P2002'
  );
}

export async function resolveOrCreateDefaultReferralProgramId(
  db: ReferralProgramClient,
  organizationId: string
): Promise<string> {
  const existing = await db.referral_programs.findUnique({
    where: {
      organization_id_slug: {
        organization_id: organizationId,
        slug: DEFAULT_REFERRAL_PROGRAM_SLUG,
      },
    },
    select: { id: true },
  });
  if (existing) return existing.id;

  try {
    const created = await db.referral_programs.create({
      data: {
        organization_id: organizationId,
        slug: DEFAULT_REFERRAL_PROGRAM_SLUG,
        name: DEFAULT_REFERRAL_PROGRAM_NAME,
        status: 'ACTIVE',
      },
      select: { id: true },
    });
    return created.id;
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      const raced = await db.referral_programs.findUnique({
        where: {
          organization_id_slug: {
            organization_id: organizationId,
            slug: DEFAULT_REFERRAL_PROGRAM_SLUG,
          },
        },
        select: { id: true },
      });
      if (raced) return raced.id;
    }
    throw error;
  }
}

/**
 * New referral links always receive a program_id.
 * Explicit programId must belong to the organization; otherwise the org default is used/created.
 */
export async function resolveReferralProgramIdForNewLink(
  db: ReferralProgramClient,
  organizationId: string,
  requestedProgramId?: string | null
): Promise<string> {
  const explicit = requestedProgramId?.trim() || null;
  if (explicit) {
    const program = await db.referral_programs.findFirst({
      where: { id: explicit, organization_id: organizationId },
      select: { id: true },
    });
    if (!program) {
      throw new ReferralProgramResolutionError(
        'Referral program not found for this organization'
      );
    }
    return program.id;
  }
  return resolveOrCreateDefaultReferralProgramId(db, organizationId);
}
