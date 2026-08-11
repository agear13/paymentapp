'use client';

import Link from 'next/link';
import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';

export function WorkspaceComingSoonPage({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="animate-fade-up space-y-6 pb-16">
      <header>
        <Link href={COMMERCIAL_OS_ROUTES.settings} className="text-[13px] text-ink-soft hover:text-foreground">
          ← Workspace Settings
        </Link>
        <h1 className="mt-4 text-3xl font-semibold tracking-[-0.03em]">{title}</h1>
        <p className="mt-2 text-[15px] text-ink-soft">{description}</p>
      </header>
      <div className="rounded-2xl border border-dashed border-border bg-secondary/30 p-8 text-center">
        <p className="text-[15px] font-medium">Coming soon</p>
        <p className="mt-2 text-[13px] text-ink-soft">
          This setting is not available yet. We&apos;ll notify you when it launches.
        </p>
      </div>
    </div>
  );
}
