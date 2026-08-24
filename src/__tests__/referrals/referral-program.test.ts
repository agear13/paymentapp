/**
 * Phase 1 ReferralProgram resolution — default program vs explicit programId.
 */

import {
  DEFAULT_REFERRAL_PROGRAM_NAME,
  DEFAULT_REFERRAL_PROGRAM_SLUG,
  ReferralProgramResolutionError,
  resolveOrCreateDefaultReferralProgramId,
  resolveReferralProgramIdForNewLink,
} from '@/lib/referrals/referral-program.server';

function mockDb(overrides: {
  findUnique?: jest.Mock;
  findFirst?: jest.Mock;
  create?: jest.Mock;
}) {
  return {
    referral_programs: {
      findUnique: overrides.findUnique ?? jest.fn(),
      findFirst: overrides.findFirst ?? jest.fn(),
      create: overrides.create ?? jest.fn(),
    },
  };
}

describe('resolveOrCreateDefaultReferralProgramId', () => {
  const organizationId = 'org-1';

  it('returns the existing default program', async () => {
    const findUnique = jest.fn().mockResolvedValue({ id: 'prog-default' });
    const create = jest.fn();
    const id = await resolveOrCreateDefaultReferralProgramId(
      mockDb({ findUnique, create }) as never,
      organizationId
    );
    expect(id).toBe('prog-default');
    expect(create).not.toHaveBeenCalled();
    expect(findUnique).toHaveBeenCalledWith({
      where: {
        organization_id_slug: {
          organization_id: organizationId,
          slug: DEFAULT_REFERRAL_PROGRAM_SLUG,
        },
      },
      select: { id: true },
    });
  });

  it('creates the default program when missing', async () => {
    const findUnique = jest.fn().mockResolvedValue(null);
    const create = jest.fn().mockResolvedValue({ id: 'prog-new' });
    const id = await resolveOrCreateDefaultReferralProgramId(
      mockDb({ findUnique, create }) as never,
      organizationId
    );
    expect(id).toBe('prog-new');
    expect(create).toHaveBeenCalledWith({
      data: {
        organization_id: organizationId,
        slug: DEFAULT_REFERRAL_PROGRAM_SLUG,
        name: DEFAULT_REFERRAL_PROGRAM_NAME,
        status: 'ACTIVE',
      },
      select: { id: true },
    });
  });

  it('re-reads after a unique-constraint race', async () => {
    const findUnique = jest
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'prog-raced' });
    const create = jest.fn().mockRejectedValue({ code: 'P2002' });
    const id = await resolveOrCreateDefaultReferralProgramId(
      mockDb({ findUnique, create }) as never,
      organizationId
    );
    expect(id).toBe('prog-raced');
  });
});

describe('resolveReferralProgramIdForNewLink', () => {
  const organizationId = 'org-1';

  it('uses an explicit program that belongs to the organization', async () => {
    const findFirst = jest.fn().mockResolvedValue({ id: 'prog-explicit' });
    const id = await resolveReferralProgramIdForNewLink(
      mockDb({ findFirst }) as never,
      organizationId,
      'prog-explicit'
    );
    expect(id).toBe('prog-explicit');
    expect(findFirst).toHaveBeenCalledWith({
      where: { id: 'prog-explicit', organization_id: organizationId },
      select: { id: true },
    });
  });

  it('rejects an explicit program that is missing or in another org', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    await expect(
      resolveReferralProgramIdForNewLink(
        mockDb({ findFirst }) as never,
        organizationId,
        'prog-other'
      )
    ).rejects.toBeInstanceOf(ReferralProgramResolutionError);
  });

  it('falls back to the org default when programId is omitted', async () => {
    const findUnique = jest.fn().mockResolvedValue({ id: 'prog-default' });
    const id = await resolveReferralProgramIdForNewLink(
      mockDb({ findUnique }) as never,
      organizationId,
      null
    );
    expect(id).toBe('prog-default');
  });
});
