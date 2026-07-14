/**
 * Pilot Command Centre — admin-only internal dashboard for Danielle launch week.
 */

import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isAdminEmail } from '@/lib/config/env';
import { PilotCommandCentre } from '@/components/pilot/pilot-command-centre';

async function checkPilotAccess(): Promise<boolean> {
  if (process.env.NODE_ENV === 'development') return true;

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) return false;
    return isAdminEmail(user.email ?? '');
  } catch {
    return false;
  }
}

export default async function PilotCommandCentrePage() {
  const allowed = await checkPilotAccess();
  if (!allowed) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Pilot Command Centre</h1>
        <p className="text-muted-foreground">
          Launch readiness for Danielle&apos;s Rabbit Hole pilot — environment, rails, Xero, ledger, and monitoring.
        </p>
      </div>
      <PilotCommandCentre />
    </div>
  );
}
