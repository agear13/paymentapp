/**
 * Dashboard product profile (server-only).
 * Determines admin vs standard vs Rabbit Hole pilot shell.
 */
import 'server-only';

import { createUserClient } from '@/lib/supabase/server';
import {
  isBetaAdminEmail,
  isRabbitHolePilotEmail,
  type DashboardProductProfile,
} from './admin-shared';

function emailMatchesRabbitHolePilotEnv(email: string): boolean {
  const raw = process.env.RABBIT_HOLE_PILOT_EMAILS;
  if (!raw) return false;
  const emails = raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return emails.includes(email.trim().toLowerCase());
}

/** Beta admin wins over pilot if both match. */
export function isRabbitHolePilotUser(email: string | null | undefined): boolean {
  if (!email) return false;
  if (isBetaAdminEmail(email)) return false;
  if (isRabbitHolePilotEmail(email)) return true;
  return emailMatchesRabbitHolePilotEnv(email);
}

export async function getDashboardProductProfile(): Promise<DashboardProductProfile> {
  try {
    const supabase = await createUserClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user?.email) {
      return 'standard';
    }

    if (isBetaAdminEmail(user.email)) {
      return 'admin';
    }
    if (isRabbitHolePilotUser(user.email)) {
      return 'rabbit_hole_pilot';
    }
    return 'standard';
  } catch {
    return 'standard';
  }
}
