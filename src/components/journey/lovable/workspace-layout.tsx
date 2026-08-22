'use client';

import '@/components/journey/lovable/lovable-journey.css';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  Moon,
  Sun,
  LayoutGrid,
  Workflow,
  Activity,
  Plug,
  Sparkles,
  Settings,
  Landmark,
} from 'lucide-react';
import { ProvvyBrandMark } from '@/components/journey/lovable/provvy-brand-mark';
import { WorkspaceAccountMenu } from '@/components/commercial-os/workspace-account-menu';
import { WorkspaceAccountingBanners } from '@/components/journey/lovable/workspace-accounting-banners';

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutGrid;
  exact?: boolean;
  isActive?: (pathname: string) => boolean;
};

function isWorkflowLibraryPath(pathname: string): boolean {
  return (
    pathname === '/workspace/workflows' ||
    /^\/workspace\/workflows\/[^/]+\/preview$/.test(pathname)
  );
}

const NAV: NavItem[] = [
  { to: '/workspace', label: 'Workspace', icon: LayoutGrid, exact: true },
  {
    to: '/workspace/workflows',
    label: 'Workflow Library',
    icon: Workflow,
    isActive: isWorkflowLibraryPath,
  },
  {
    to: '/workspace/settlement',
    label: 'Settlement',
    icon: Landmark,
  },
  { to: '/workspace/timeline', label: 'Timeline', icon: Activity },
  { to: '/workspace/connected', label: 'Connected Systems', icon: Plug },
  { to: '/workspace/advisor', label: 'AI Advisor', icon: Sparkles },
  { to: '/workspace/settings', label: 'Settings', icon: Settings },
];

export function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '';
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('theme');
    const prefers = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = stored ? stored === 'dark' : prefers;
    setDark(isDark);
    document.documentElement.classList.toggle('dark', isDark);
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
  };

  return (
    <div className={`lovable-journey min-h-screen bg-background text-foreground antialiased ${dark ? 'dark' : ''}`}>
      <div
        className="pointer-events-none fixed inset-x-0 top-0 h-[400px]"
        style={{ background: 'var(--gradient-hero)' }}
      />
      <header className="sticky top-4 z-50 mx-auto w-[min(1280px,calc(100%-2rem))] rounded-2xl glass px-4 py-2.5 shadow-soft">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <ProvvyBrandMark href="/workspace" />
            <nav className="hidden items-center gap-1 lg:flex">
              {NAV.map((item) => {
                const active = item.isActive
                  ? item.isActive(pathname)
                  : item.exact
                    ? pathname === item.to
                    : pathname.startsWith(item.to);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.to}
                    href={item.to}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors ${
                      active
                        ? 'bg-accent text-accent-foreground'
                        : 'text-ink-soft hover:bg-secondary hover:text-foreground'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 rounded-lg border border-border px-2.5 py-1 text-[12px] text-ink-soft sm:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Operational
            </div>
            <button
              type="button"
              onClick={toggle}
              aria-label="Toggle dark mode"
              className="grid h-9 w-9 place-items-center rounded-xl border border-border text-ink-soft transition-colors hover:bg-accent hover:text-foreground"
            >
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <WorkspaceAccountMenu />
          </div>
        </div>
        <nav className="mt-2 flex items-center gap-1 overflow-x-auto lg:hidden">
          {NAV.map((item) => {
            const active = item.isActive
              ? item.isActive(pathname)
              : item.exact
                ? pathname === item.to
                : pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                href={item.to}
                className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[12.5px] font-medium transition-colors ${
                  active
                    ? 'bg-accent text-accent-foreground'
                    : 'text-ink-soft hover:bg-secondary hover:text-foreground'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="relative mx-auto w-[min(1280px,calc(100%-2rem))] py-8">
        <WorkspaceAccountingBanners />
        {children}
      </main>
    </div>
  );
}
