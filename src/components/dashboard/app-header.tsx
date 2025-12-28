'use client';

import * as React from 'react';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { OrganizationSwitcher } from './organization-switcher';
import { BreadcrumbNav } from './breadcrumb-nav';
import { NotificationCenter } from './notifications/notification-center';
import { useSidebar } from '@/components/ui/sidebar';

export function AppHeader() {
  const { toggleSidebar } = useSidebar();

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

      <BreadcrumbNav />

      <div className="ml-auto flex items-center gap-2">
        <NotificationCenter />
        <OrganizationSwitcher />
      </div>
    </header>
  );
}







