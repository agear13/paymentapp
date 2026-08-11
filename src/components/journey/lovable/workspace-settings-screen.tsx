'use client';

import Link from 'next/link';
import {
  Settings,
  User,
  Building2,
  Bell,
  Shield,
  ChevronRight,
  CreditCard,
} from 'lucide-react';
import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';

type SettingLink = {
  label: string;
  href?: string;
  comingSoon?: boolean;
};

type SettingGroup = {
  icon: typeof User;
  title: string;
  items: SettingLink[];
};

const GROUPS: SettingGroup[] = [
  {
    icon: User,
    title: 'Account',
    items: [
      { label: 'Profile', href: COMMERCIAL_OS_ROUTES.accountProfile },
      { label: 'Preferences', href: COMMERCIAL_OS_ROUTES.accountPreferences },
      { label: 'Sign-in & Security', href: COMMERCIAL_OS_ROUTES.accountSecurity },
    ],
  },
  {
    icon: Building2,
    title: 'Workspace',
    items: [
      { label: 'Business details', href: `${COMMERCIAL_OS_ROUTES.settings}/business` },
      { label: 'Payments & Settlement', href: COMMERCIAL_OS_ROUTES.payments },
      { label: 'Team members', href: `${COMMERCIAL_OS_ROUTES.settings}/team` },
      { label: 'Roles & permissions', href: `${COMMERCIAL_OS_ROUTES.settings}/team` },
      { label: 'Plan & Billing', href: COMMERCIAL_OS_ROUTES.planBilling },
    ],
  },
  {
    icon: Bell,
    title: 'Notifications',
    items: [
      { label: 'Commercial events', href: COMMERCIAL_OS_ROUTES.accountPreferences },
      { label: 'Weekly summary', comingSoon: true },
      { label: 'AI recommendations', comingSoon: true },
    ],
  },
  {
    icon: Shield,
    title: 'Security',
    items: [
      { label: 'Sessions', href: COMMERCIAL_OS_ROUTES.accountSecurity },
      { label: 'Two-factor authentication', comingSoon: true },
      { label: 'Audit log', comingSoon: true },
    ],
  },
];

function SettingRow({ group, item }: { group: string; item: SettingLink }) {
  if (item.comingSoon) {
    return (
      <div className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-[13px] text-ink-soft">
        <span>{item.label}</span>
        <span className="text-[11px] uppercase tracking-wide">Coming soon</span>
      </div>
    );
  }

  if (!item.href) return null;

  return (
    <Link
      href={item.href}
      className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-[13px] font-medium text-foreground transition-colors hover:bg-secondary/70"
    >
      {item.label}
      <ChevronRight className="h-3.5 w-3.5 text-ink-soft" />
    </Link>
  );
}

export function WorkspaceSettingsScreen() {
  return (
    <div className="animate-fade-up space-y-8 pb-16">
      <header>
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary/60 px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-ink-soft">
          <Settings className="h-3 w-3" />
          Settings
        </div>
        <h1 className="mt-4 text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
          Workspace settings
        </h1>
        <p className="mt-2 max-w-2xl text-[15px] text-ink-soft">
          Your account and workspace — profile, billing, payments, team, and security.
        </p>
        <Link
          href={COMMERCIAL_OS_ROUTES.planBilling}
          className="mt-4 inline-flex items-center gap-2 rounded-xl border border-primary/20 bg-accent/50 px-4 py-2.5 text-[13px] font-semibold text-foreground transition-colors hover:bg-accent"
        >
          <CreditCard className="h-4 w-4" />
          Plan &amp; Billing
        </Link>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        {GROUPS.map((group) => {
          const Icon = group.icon;
          return (
            <div key={group.title} className="rounded-2xl border border-border bg-card p-5 shadow-card">
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-lg bg-secondary text-foreground">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="text-[15px] font-semibold">{group.title}</div>
              </div>
              <div className="mt-4 space-y-1">
                {group.items.map((item) => (
                  <SettingRow key={item.label} group={group.title} item={item} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
