'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';

export function WorkspaceAccountProfilePage() {
  const [email, setEmail] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    void createClient().auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
      setName(
        (data.user?.user_metadata?.full_name as string | undefined) ??
          data.user?.email?.split('@')[0] ??
          null
      );
    });
  }, []);

  return (
    <div className="animate-fade-up space-y-6 pb-16">
      <header>
        <Link href={COMMERCIAL_OS_ROUTES.settings} className="text-[13px] text-ink-soft hover:text-foreground">
          ← Workspace Settings
        </Link>
        <h1 className="mt-4 text-3xl font-semibold tracking-[-0.03em]">Profile</h1>
        <p className="mt-2 text-[15px] text-ink-soft">Your personal account details.</p>
      </header>
      <div className="rounded-2xl border border-border bg-card p-6 shadow-card space-y-4 max-w-lg">
        <div>
          <div className="text-[12px] uppercase tracking-wider text-ink-soft">Name</div>
          <div className="mt-1 text-[15px] font-medium">{name ?? '—'}</div>
        </div>
        <div>
          <div className="text-[12px] uppercase tracking-wider text-ink-soft">Email</div>
          <div className="mt-1 text-[15px] font-medium">{email ?? '—'}</div>
        </div>
        <p className="text-[13px] text-ink-soft">
          To change your email or password, use Sign-in &amp; Security.
        </p>
      </div>
    </div>
  );
}
