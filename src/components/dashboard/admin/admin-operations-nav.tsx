'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  Activity,
  AlertCircle,
  Database,
  FileWarning,
} from 'lucide-react';

const navItems = [
  {
    title: 'Overview',
    href: '/dashboard/admin',
    icon: Activity,
  },
  {
    title: 'Sync Queue',
    href: '/dashboard/admin/queue',
    icon: Database,
  },
  {
    title: 'Error Logs',
    href: '/dashboard/admin/errors',
    icon: AlertCircle,
  },
  {
    title: 'Orphan Detection',
    href: '/dashboard/admin/orphans',
    icon: FileWarning,
  },
];

export function AdminOperationsNav() {
  const pathname = usePathname();

  return (
    <div className="flex gap-2 overflow-x-auto border-b pb-2">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              'hover:bg-accent hover:text-accent-foreground',
              isActive
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground'
            )}
          >
            <Icon className="h-4 w-4" />
            {item.title}
          </Link>
        );
      })}
    </div>
  );
}







