'use client';

import Link from 'next/link';
import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';
import { NotificationPreferencesClient } from '@/components/dashboard/notifications/preferences-client';

export function WorkspaceAccountPreferencesPage() {
  return (
    <div className="animate-fade-up space-y-6 pb-16">
      <header>
        <Link href={COMMERCIAL_OS_ROUTES.settings} className="text-[13px] text-ink-soft hover:text-foreground">
          ← Workspace Settings
        </Link>
        <h1 className="mt-4 text-3xl font-semibold tracking-[-0.03em]">Preferences</h1>
        <p className="mt-2 text-[15px] text-ink-soft">Notification and workspace communication preferences.</p>
      </header>
      <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
        <NotificationPreferencesClient />
      </div>
    </div>
  );
}
