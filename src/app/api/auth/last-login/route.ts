import { getCurrentUser } from '@/lib/auth/session';
import { getUserAuthProfile } from '@/lib/auth/login-tracking.server';
import { authJsonError, authSuccess } from '@/lib/auth/auth-api.shared';
import { formatRelativeTime } from '@/lib/auth/user-agent-parse';

/**
 * GET /api/auth/last-login — last login metadata for account settings.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return authJsonError('Authentication required', 401);
  }

  const profile = await getUserAuthProfile(user.id);
  if (!profile?.lastLoginAt) {
    return authSuccess({ lastLogin: null });
  }

  return authSuccess({
    lastLogin: {
      browser: profile.lastLoginBrowser,
      os: profile.lastLoginOs,
      location: profile.lastLoginLocation,
      at: profile.lastLoginAt.toISOString(),
      relative: formatRelativeTime(profile.lastLoginAt),
    },
  });
}
