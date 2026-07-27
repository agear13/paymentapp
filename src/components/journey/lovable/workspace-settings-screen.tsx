'use client';

import { Settings, User, Building2, Bell, Shield, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

const GROUPS = [
  {
    icon: User,
    title: 'Account',
    items: ['Profile', 'Preferences', 'Sign-in methods'],
  },
  {
    icon: Building2,
    title: 'Workspace',
    items: ['Business details', 'Team members', 'Roles & permissions'],
  },
  {
    icon: Bell,
    title: 'Notifications',
    items: ['Commercial events', 'Weekly summary', 'AI recommendations'],
  },
  {
    icon: Shield,
    title: 'Security',
    items: ['Two-factor authentication', 'Sessions', 'Audit log'],
  },
];

export function WorkspaceSettingsScreen() {
  const openSetting = (group: string, item: string) => {
    toast.message(`${group} · ${item}`, {
      description: 'Settings management opens in your workspace admin console.',
    });
  };

  return (
    <div className="animate-fade-up space-y-8 pb-16">
      <header>
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary/60 px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-ink-soft">
          <Settings className="h-3 w-3" />
          Settings
        </div>
        <h1 className="mt-4 text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
          Workspace settings.
        </h1>
        <p className="mt-2 max-w-2xl text-[15px] text-ink-soft">
          Configure your Commercial Operating System — account, workspace, notifications and security.
        </p>
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
                  <button
                    key={item}
                    type="button"
                    onClick={() => openSetting(group.title, item)}
                    className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-[13px] font-medium text-foreground transition-colors hover:bg-secondary/70"
                  >
                    {item}
                    <ChevronRight className="h-3.5 w-3.5 text-ink-soft" />
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
