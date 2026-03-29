'use client';

import * as React from 'react';
import Link from 'next/link';
import { Menu } from 'lucide-react';
import type { DashboardProductProfile } from '@/lib/auth/admin-shared';
import { Button } from '@/components/ui/button';
import { OrganizationSwitcher } from './organization-switcher';
import { BreadcrumbNav } from './breadcrumb-nav';
import { NotificationCenter } from './notifications/notification-center';
import { useSidebar } from '@/components/ui/sidebar';

interface AppHeaderProps {
  productProfile: DashboardProductProfile;
}

export function AppHeader({ productProfile }: AppHeaderProps) {
  const { toggleSidebar } = useSidebar();
  const isRabbitHolePilot = productProfile === 'rabbit_hole_pilot';

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b bg-background px-6">
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={toggleSidebar}
      >
        <Menu className="h-5 w-5" />
        <span className="sr-only">Toggle sidebar</span>
      </Button>

      <BreadcrumbNav productProfile={productProfile} />

      <div className="ml-auto flex items-center gap-2">
        {isRabbitHolePilot && (
          <Button variant="outline" size="sm" className="hidden sm:inline-flex" asChild>
            <Link href="/dashboard/payment-links">Invoice dashboard</Link>
          </Button>
        )}
        {!isRabbitHolePilot && (
          <>
            <NotificationCenter />
            <OrganizationSwitcher />
          </>
        )}
      </div>
    </header>
  );
}







