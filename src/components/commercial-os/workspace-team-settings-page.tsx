'use client';

import Link from 'next/link';
import { FeatureGate } from '@/components/entitlements/feature-gate';
import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';

/** Reuses dashboard team settings content inside Commercial OS shell. */
export function WorkspaceTeamSettingsPage() {
  return (
    <div className="animate-fade-up space-y-6 pb-16">
      <header>
        <Link href={COMMERCIAL_OS_ROUTES.settings} className="text-[13px] text-ink-soft hover:text-foreground">
          ← Workspace Settings
        </Link>
        <h1 className="mt-4 text-3xl font-semibold tracking-[-0.03em]">Team members</h1>
        <p className="mt-2 text-[15px] text-ink-soft">
          Invite colleagues and manage roles &amp; permissions. Available on Growth and above.
        </p>
      </header>

      <FeatureGate feature="team_members" mode="block">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
          <p className="text-[15px] text-ink-soft">
            Team management uses the same workspace permissions as the operator dashboard.
          </p>
          <Link
            href="/dashboard/settings/team"
            className="mt-4 inline-flex text-[14px] font-semibold text-primary underline-offset-4 hover:underline"
          >
            Open team management →
          </Link>
        </div>
      </FeatureGate>
    </div>
  );
}
