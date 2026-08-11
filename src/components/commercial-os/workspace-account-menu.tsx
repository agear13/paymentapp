'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { createClient } from '@/lib/supabase/client';
import { signOutClient } from '@/lib/auth/sign-out.client';
import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';

export function WorkspaceAccountMenu() {
  const router = useRouter();
  const supabase = createClient();
  const [user, setUser] = useState<{ email?: string | null; name?: string } | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      const u = data.user;
      if (!u) {
        setUser(null);
        return;
      }
      setUser({
        email: u.email,
        name: (u.user_metadata?.full_name as string | undefined) ?? u.email?.split('@')[0],
      });
    });
  }, [supabase]);

  const displayName = user?.name ?? 'Account';
  const initials = displayName
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  async function handleSignOut() {
    setSigningOut(true);
    const result = await signOutClient({
      supabase,
      onBeforeRedirect: () => {
        router.push('/auth/login');
        router.refresh();
      },
    });
    if (!result.ok && result.error !== 'cancelled') {
      alert(result.error);
    }
    setSigningOut(false);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-purple text-[12px] font-semibold text-primary-foreground outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Account menu"
        >
          {initials || 'A'}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{displayName}</p>
            {user?.email ? (
              <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
            ) : null}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={COMMERCIAL_OS_ROUTES.accountProfile}>Profile</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={COMMERCIAL_OS_ROUTES.accountPreferences}>Preferences</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={COMMERCIAL_OS_ROUTES.planBilling}>Plan &amp; Billing</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={COMMERCIAL_OS_ROUTES.settings}>Workspace Settings</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={signingOut} onClick={() => void handleSignOut()}>
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
