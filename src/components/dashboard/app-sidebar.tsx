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
  Link as LinkIcon,
  LogOut,
  ChevronRight,
  Handshake,
  Layers,
  Building2,
  FileCheck,
  Repeat,
} from 'lucide-react';
import { OperatorSidebarNav } from '@/components/dashboard/operator-sidebar-nav';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from '@/components/ui/sidebar';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
/** Gated internal tooling — beta admin only; unchanged structure. */
const platformPreviewItems = [
  {
    title: 'Platform Preview',
    icon: Layers,
    items: [
      {
        title: 'Overview',
        href: '/dashboard/platform-preview/overview',
      },
      {
        title: 'Connections',
        href: '/dashboard/platform-preview/connections',
      },
      {
        title: 'Inventory',
        href: '/dashboard/platform-preview/inventory',
      },
      {
        title: 'Unified Ledger',
        href: '/dashboard/platform-preview/ledger',
      },
    ],
  },
];

interface AppSidebarProps {
  productProfile: DashboardProductProfile;
}

export function AppSidebar({ productProfile }: AppSidebarProps) {
  const isBetaAdmin = productProfile === 'admin';
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
      
      // Sign out from Supabase
      await supabase.auth.signOut();
      
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
    const pilotHome = '/dashboard/partners/deal-network';
    const pilotObligations = `${pilotHome}/obligations`;
    const isObligationsView = path === pilotObligations;
    const isDealNetworkSectionActive =
      path === pilotHome || (path.startsWith(`${pilotHome}/`) && !isObligationsView);
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
          <SidebarGroup>
            <SidebarGroupLabel>Pilot</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isDealNetworkSectionActive}>
                    <Link href={pilotHome}>
                      <Handshake className="size-4" />
                      <span>Deal Network</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isObligationsView}>
                    <Link href={pilotObligations}>
                      <FileCheck className="size-4" />
                      <span>Obligations</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={path === '/dashboard/payment-links' || path.startsWith('/dashboard/payment-links/')}
                  >
                    <Link href="/dashboard/payment-links">
                      <LinkIcon className="size-4" />
                      <span>Invoices</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={
                      path === '/dashboard/recurring-templates' ||
                      path.startsWith('/dashboard/recurring-templates/')
                    }
                  >
                    <Link href="/dashboard/recurring-templates">
                      <Repeat className="size-4" />
                      <span>Recurring</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={path === '/dashboard/settings/merchant' || path.startsWith('/dashboard/settings/merchant/')}
                  >
                    <Link href="/dashboard/settings/merchant">
                      <Building2 className="size-4" />
                      <span>Collection & settlement</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
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
    const pilotHome = '/dashboard/partners/deal-network';
    const pilotObligations = `${pilotHome}/obligations`;
    const isObligationsView = path === pilotObligations;
    const isDealNetworkSectionActive =
      path === pilotHome || (path.startsWith(`${pilotHome}/`) && !isObligationsView);
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
                    <span className="truncate font-semibold">Projects</span>
                    <span className="truncate text-xs text-muted-foreground">Payout coordination</span>
                  </div>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Workspace</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isDealNetworkSectionActive}>
                    <Link href={pilotHome}>
                      <Handshake className="size-4" />
                      <span>Projects</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isObligationsView}>
                    <Link href={pilotObligations}>
                      <FileCheck className="size-4" />
                      <span>Obligations</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={path === '/dashboard/payment-links' || path.startsWith('/dashboard/payment-links/')}
                  >
                    <Link href="/dashboard/payment-links">
                      <LinkIcon className="size-4" />
                      <span>Invoices</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={
                      path === '/dashboard/recurring-templates' ||
                      path.startsWith('/dashboard/recurring-templates/')
                    }
                  >
                    <Link href="/dashboard/recurring-templates">
                      <Repeat className="size-4" />
                      <span>Recurring</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={path === '/dashboard/settings/merchant' || path.startsWith('/dashboard/settings/merchant/')}
                  >
                    <Link href="/dashboard/settings/merchant">
                      <Building2 className="size-4" />
                      <span>Collection & settlement</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
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
                  <span className="truncate text-xs text-muted-foreground">Payment Platform</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <OperatorSidebarNav productProfile={productProfile} path={path} />

        {/* Platform Preview — gated beta admin; internal tooling unchanged */}
        {isBetaAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Platform Preview</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {platformPreviewItems.map((item) => (
                  <Collapsible key={item.title} asChild defaultOpen={path.includes('/platform-preview')}>
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton>
                          <item.icon className="size-4" />
                          <span>{item.title}</span>
                          <ChevronRight className="ml-auto size-4 transition-transform duration-200 group-data-[state=open]:rotate-90" />
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {item.items?.map((subItem) => {
                            const isActive = path === subItem.href;
                            return (
                              <SidebarMenuSubItem key={subItem.href}>
                                <SidebarMenuSubButton asChild isActive={isActive}>
                                  <Link href={subItem.href}>
                                    <span>{subItem.title}</span>
                                  </Link>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            );
                          })}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </Collapsible>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
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
