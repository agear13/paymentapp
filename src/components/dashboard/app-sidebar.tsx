'use client';

/**
 * App Sidebar Component
 * 
 * NOTE: productProfile is passed from the server layout to avoid importing
 * server-only modules (like next/headers) in this client component.
 * See src/app/(dashboard)/layout.tsx for where this prop is computed.
 */

import type { DashboardProductProfile } from '@/lib/auth/admin-shared';
import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  LogOut,
  ChevronRight,
} from 'lucide-react';
import { OperatorSidebarNav, RegistrySidebarNavGroup } from '@/components/dashboard/operator-sidebar-nav';
import {
  RABBIT_HOLE_PILOT_NAVIGATION_REGISTRY,
  STRAIT_EXPERIENCES_PILOT_NAVIGATION_REGISTRY,
  WORKSPACE_PLATFORM_PREVIEW_NAVIGATION_REGISTRY,
  WORKSPACE_PARTNER_PREVIEW_NAVIGATION_REGISTRY,
} from '@/lib/workspace-features';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface AppSidebarProps {
  productProfile: DashboardProductProfile;
}

export function AppSidebar({ productProfile }: AppSidebarProps) {
  const isRabbitHolePilot = productProfile === 'rabbit_hole_pilot';
  const isStraitExperiencesPilot = productProfile === 'strait_experiences_pilot';
  const pathname = usePathname();
  /** usePathname() can be null during transitions; treat as empty for nav active states. */
  const path = pathname ?? '';
  const router = useRouter();
  const supabase = createClient();

  React.useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;
    console.log('IS RABBIT HOLE PILOT:', isRabbitHolePilot, 'path:', path);
  }, [isRabbitHolePilot, path]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [user, setUser] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    // Get initial user for display purposes (name, email, avatar)
    async function loadUser() {
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) {
          console.error('Error loading user:', error);
        } else {
          setUser(user);
        }
      } catch (error) {
        console.error('Error in getUser:', error);
      } finally {
        setLoading(false);
      }
    }

    loadUser();

    // Listen for auth changes (for user display info only)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  const handleSignOut = async () => {
    if (!confirm('Are you sure you want to sign out?')) {
      return;
    }
    
    setLoading(true);
    try {
      // Clear localStorage
      localStorage.clear();
      
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;
      const email = sessionData.session?.user.email ?? undefined;

      await supabase.auth.signOut();

      void fetch('/api/auth/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType: 'auth.logout',
          userId,
          email,
        }),
        keepalive: true,
      }).catch(() => undefined);
      
      // Redirect to login
      router.push('/auth/login');
      router.refresh();
    } catch (error) {
      console.error('Error signing out:', error);
      alert('Failed to sign out. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = () => {
    router.push('/auth/login');
  };

  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
  const initials = user 
    ? displayName
        .split(' ')
        .map((n: string) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '?';

  if (isRabbitHolePilot) {
    const pilotHome = RABBIT_HOLE_PILOT_NAVIGATION_REGISTRY[0].href;
    return (
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild>
                <Link href={pilotHome}>
                  <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                    <span className="text-lg font-bold">R</span>
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">Rabbit Hole Deal Network</span>
                    <span className="truncate text-xs text-muted-foreground">Pilot Workspace</span>
                  </div>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
          <RegistrySidebarNavGroup
            productProfile={productProfile}
            path={path}
            label="Pilot"
            sections={RABBIT_HOLE_PILOT_NAVIGATION_REGISTRY}
          />
        </SidebarContent>

        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              {loading ? (
                <SidebarMenuButton disabled>
                  <Avatar className="size-6">
                    <AvatarFallback>...</AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">Loading...</span>
                    <span className="truncate text-xs text-muted-foreground">Please wait</span>
                  </div>
                </SidebarMenuButton>
              ) : user ? (
                <SidebarMenuButton onClick={handleSignOut} disabled={loading}>
                  <Avatar className="size-6">
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">{displayName}</span>
                    <span className="truncate text-xs text-muted-foreground">{user.email}</span>
                  </div>
                  <LogOut className="size-4 ml-auto" />
                </SidebarMenuButton>
              ) : (
                <SidebarMenuButton onClick={handleSignIn}>
                  <Avatar className="size-6">
                    <AvatarFallback>?</AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">Sign In</span>
                    <span className="truncate text-xs text-muted-foreground">Click to login</span>
                  </div>
                  <ChevronRight className="size-4 ml-auto" />
                </SidebarMenuButton>
              )}
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
    );
  }

  if (isStraitExperiencesPilot) {
    const pilotHome = STRAIT_EXPERIENCES_PILOT_NAVIGATION_REGISTRY[0].href;
    return (
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild>
                <Link href={pilotHome}>
                  <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                    <span className="text-lg font-bold">P</span>
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">Agreements</span>
                    <span className="truncate text-xs text-muted-foreground">Settlement coordination</span>
                  </div>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
          <RegistrySidebarNavGroup
            productProfile={productProfile}
            path={path}
            label="Workspace"
            sections={STRAIT_EXPERIENCES_PILOT_NAVIGATION_REGISTRY}
          />
        </SidebarContent>

        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              {loading ? (
                <SidebarMenuButton disabled>
                  <Avatar className="size-6">
                    <AvatarFallback>...</AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">Loading...</span>
                    <span className="truncate text-xs text-muted-foreground">Please wait</span>
                  </div>
                </SidebarMenuButton>
              ) : user ? (
                <SidebarMenuButton onClick={handleSignOut} disabled={loading}>
                  <Avatar className="size-6">
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">{displayName}</span>
                    <span className="truncate text-xs text-muted-foreground">{user.email}</span>
                  </div>
                  <LogOut className="size-4 ml-auto" />
                </SidebarMenuButton>
              ) : (
                <SidebarMenuButton onClick={handleSignIn}>
                  <Avatar className="size-6">
                    <AvatarFallback>?</AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">Sign In</span>
                    <span className="truncate text-xs text-muted-foreground">Click to login</span>
                  </div>
                  <ChevronRight className="size-4 ml-auto" />
                </SidebarMenuButton>
              )}
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
    );
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/dashboard">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <span className="text-lg font-bold">P</span>
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">Provvypay</span>
                  <span className="truncate text-xs text-muted-foreground">Agreement Intelligence Platform</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <OperatorSidebarNav productProfile={productProfile} path={path} />

        <RegistrySidebarNavGroup
          productProfile={productProfile}
          path={path}
          label="Platform Preview"
          sections={WORKSPACE_PLATFORM_PREVIEW_NAVIGATION_REGISTRY}
        />

        <RegistrySidebarNavGroup
          productProfile={productProfile}
          path={path}
          label="Partner Workspace"
          sections={WORKSPACE_PARTNER_PREVIEW_NAVIGATION_REGISTRY}
        />
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            {loading ? (
              <SidebarMenuButton disabled>
                <Avatar className="size-6">
                  <AvatarFallback>...</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">Loading...</span>
                  <span className="truncate text-xs text-muted-foreground">Please wait</span>
                </div>
              </SidebarMenuButton>
            ) : user ? (
              <SidebarMenuButton onClick={handleSignOut} disabled={loading}>
                <Avatar className="size-6">
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">{displayName}</span>
                  <span className="truncate text-xs text-muted-foreground">{user.email}</span>
                </div>
                <LogOut className="size-4 ml-auto" />
              </SidebarMenuButton>
            ) : (
              <SidebarMenuButton onClick={handleSignIn}>
                <Avatar className="size-6">
                  <AvatarFallback>?</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">Sign In</span>
                  <span className="truncate text-xs text-muted-foreground">Click to login</span>
                </div>
                <ChevronRight className="size-4 ml-auto" />
              </SidebarMenuButton>
            )}
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
