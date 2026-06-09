'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/dashboard/agreement-analyzer', label: 'Overview', exact: true },
  { href: '/dashboard/agreement-analyzer/analytics', label: 'Analytics', exact: false },
  { href: '/dashboard/agreement-analyzer/operations', label: 'Operations', exact: false },
] as const;

export function AgreementAnalyzerDashboardNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-2 border-b pb-4">
      {NAV_ITEMS.map((item) => {
        const isActive = item.exact
          ? pathname === item.href
          : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'rounded-md px-3 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
