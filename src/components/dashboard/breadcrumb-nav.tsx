'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';

// Map pathnames to readable titles
const pathTitles: Record<string, string> = {
  dashboard: 'Dashboard',
  'payment-links': 'Payment Links',
  ledger: 'Ledger',
  transactions: 'Transactions',
  settings: 'Settings',
  organization: 'Organization',
  merchant: 'Merchant',
  team: 'Team',
  integrations: 'Integrations',
};

export function BreadcrumbNav() {
  const pathname = usePathname();
  
  // Split the pathname into segments and filter out empty strings
  const segments = pathname.split('/').filter(Boolean);
  
  // Don't show breadcrumbs on the root dashboard
  if (segments.length <= 1) {
    return null;
  }

  // Build breadcrumb items
  const breadcrumbs = segments.map((segment, index) => {
    const href = '/' + segments.slice(0, index + 1).join('/');
    const title = pathTitles[segment] || segment.charAt(0).toUpperCase() + segment.slice(1);
    const isLast = index === segments.length - 1;

    return {
      href,
      title,
      isLast,
    };
  });

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {breadcrumbs.map((breadcrumb, index) => (
          <React.Fragment key={breadcrumb.href}>
            {index > 0 && <BreadcrumbSeparator />}
            <BreadcrumbItem>
              {breadcrumb.isLast ? (
                <BreadcrumbPage>{breadcrumb.title}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink asChild>
                  <Link href={breadcrumb.href}>{breadcrumb.title}</Link>
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
          </React.Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}













