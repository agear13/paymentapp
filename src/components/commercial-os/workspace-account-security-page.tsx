'use client';

import Link from 'next/link';
import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';
import { LastLoginSection } from '@/components/dashboard/settings/last-login-section';

export function WorkspaceAccountSecurityPage() {
  return (
    <div className="animate-fade-up space-y-6 pb-16">
      <header>
        <Link href={COMMERCIAL_OS_ROUTES.settings} className="text-[13px] text-ink-soft hover:text-foreground">
          ← Workspace Settings
        </Link>
        <h1 className="mt-4 text-3xl font-semibold tracking-[-0.03em]">Sign-in &amp; Security</h1>
        <p className="mt-2 text-[15px] text-ink-soft">Sessions and account security.</p>
      </header>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-card space-y-6">
        <div>
          <h2 className="text-[15px] font-semibold">Recent sign-in</h2>
          <div className="mt-3">
            <LastLoginSection />
          </div>
        </div>

        <div className="rounded-xl border border-dashed p-4">
          <h2 className="text-[15px] font-semibold">Two-factor authentication</h2>
          <p className="mt-2 text-[13px] text-ink-soft">Coming soon — enhanced account protection.</p>
        </div>
      </div>
    </div>
  );
}
