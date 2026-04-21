import type { DashboardProductProfile } from '@/lib/auth/admin-shared';

/** How the Deal Network shell behaves for this signed-in user (server-derived from product profile). */
export type DealNetworkExperienceMode = 'referral' | 'project';

/**
 * Referral/Rabbit Hole pilot uses the existing referral-based Deal Network.
 * All other dashboard profiles use project coordination terminology and simplified surfaces.
 */
export function dealNetworkExperienceFromProductProfile(
  profile: DashboardProductProfile
): DealNetworkExperienceMode {
  return profile === 'rabbit_hole_pilot' ? 'referral' : 'project';
}
