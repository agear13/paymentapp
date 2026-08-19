import { NextRequest } from 'next/server';
import { getCurrentUserForApi } from '@/lib/auth/api-session.server';
import { authJsonError, authSuccess } from '@/lib/auth/auth-api.shared';
import { getOrganizationForAuthenticatedUser } from '@/lib/auth/get-org';
import { hasOrganizationRole } from '@/lib/auth/organization-access';
import {
  getMfaAssuranceSnapshot,
  remainingUnusedRecoveryCodeCount,
} from '@/lib/auth/mfa.server';
import { enrolledUserNeedsMfaChallenge } from '@/lib/auth/mfa-assurance';

const MFA_SESSION_OPTIONS = {
  allowAal1: true,
  allowSuspiciousLogin: true,
} as const;

export async function GET(request: NextRequest) {
  const auth = await getCurrentUserForApi(request, MFA_SESSION_OPTIONS);
  if (!auth.user) {
    return auth.response ?? authJsonError('Authentication required', 401);
  }

  const snapshot = await getMfaAssuranceSnapshot();
  const org = await getOrganizationForAuthenticatedUser(auth.user.id);
  const isOwner = org
    ? await hasOrganizationRole(auth.user.id, org.id, ['OWNER'])
    : false;

  const unusedRecoveryCodes = snapshot.verifiedTotpCount
    ? await remainingUnusedRecoveryCodeCount(auth.user.id)
    : 0;

  return authSuccess({
    currentLevel: snapshot.currentLevel,
    nextLevel: snapshot.nextLevel,
    enrolled: snapshot.verifiedTotpCount > 0,
    verifiedFactorCount: snapshot.verifiedTotpCount,
    factors: snapshot.totpFactors.map((factor) => ({
      id: factor.id,
      status: factor.status,
      friendlyName: factor.friendlyName,
    })),
    challengeRequired: enrolledUserNeedsMfaChallenge({
      verifiedTotpCount: snapshot.verifiedTotpCount,
      currentLevel: snapshot.currentLevel,
    }),
    ownerMfaRequired: isOwner,
    unusedRecoveryCodeCount: unusedRecoveryCodes,
  });
}
