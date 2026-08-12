'use client';

import Link from 'next/link';
import { Menu, Moon, Sun, X } from 'lucide-react';
import { useState } from 'react';
import { ProvvypayLogoMark } from '@/components/provvypay/provvypay-logo-mark';
import { CALENDLY_CONSULTATION_URL } from '@/lib/config/calendly-consultation-url';
import { LABS_NAV_ITEMS } from '@/lib/labs/labs-constants';

type LabsNavProps = {
  dark: boolean;
  onToggleDark: () => void;
};

export function LabsNav({ dark, onToggleDark }: LabsNavProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="glass sticky top-4 z-50 mx-auto w-[min(1200px,calc(100%-2rem))] rounded-2xl px-5 py-3 shadow-soft">
      <div className="flex items-center justify-between">
        <Link href="/journey" className="flex items-center gap-2">
          <ProvvypayLogoMark href="" showWordmark={false} size="sm" className="[&>div]:h-7 [&>div]:w-7" />
          <span className="text-[15px] font-semibold tracking-tight">Provvy</span>
          <span className="ml-1 rounded-md bg-accent px-1.5 py-0.5 text-[11px] font-medium text-accent-foreground">
            Labs
          </span>
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {LABS_NAV_ITEMS.map((item) => (
            <a
              key={item.label}
              href={item.href}
              className="rounded-lg px-3 py-1.5 text-[13px] text-ink-soft transition-colors hover:bg-accent hover:text-foreground"
            >
              {item.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={onToggleDark}
            aria-label="Toggle dark mode"
            className="grid h-9 w-9 place-items-center rounded-xl border border-border text-ink-soft transition-colors hover:bg-accent hover:text-foreground"
          >
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <a
            href={CALENDLY_CONSULTATION_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden rounded-lg border border-border px-3 py-2 text-[13px] font-medium text-foreground transition-colors hover:bg-accent sm:inline-flex"
          >
            Talk to Provvy Labs
          </a>
          <a
            href="#company-brain"
            className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-purple px-3.5 py-2 text-[13px] font-medium text-primary-foreground shadow-glow"
          >
            Build My Company Brain
          </a>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Toggle menu"
            className="grid h-9 w-9 place-items-center rounded-xl border border-border text-ink-soft md:hidden"
          >
            {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>
      {menuOpen && (
        <nav className="mt-3 grid gap-1 border-t border-border/60 pt-3 md:hidden">
          {LABS_NAV_ITEMS.map((item) => (
            <a
              key={item.label}
              href={item.href}
              onClick={() => setMenuOpen(false)}
              className="rounded-lg px-3 py-2 text-[13.5px] text-ink-soft hover:bg-accent hover:text-foreground"
            >
              {item.label}
            </a>
          ))}
          <a
            href={CALENDLY_CONSULTATION_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg px-3 py-2 text-[13.5px] font-medium text-foreground"
          >
            Talk to Provvy Labs
          </a>
        </nav>
      )}
    </header>
  );
}
