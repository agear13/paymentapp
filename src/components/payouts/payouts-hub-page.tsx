'use client';

import Link from 'next/link';
import { ArrowRight, CircleDollarSign, FileCheck, History } from 'lucide-react';
import { ReleaseConfidenceSummary } from '@/components/operations/release-confidence-summary';
import { ReleaseSimulationPreview } from '@/components/operations/release-simulation-preview';
import { useOperationalGuidance } from '@/hooks/use-operational-guidance';
import { PayoutHowItWorksCard } from '@/components/payouts/payout-lifecycle-explainer';
import { PayoutsHubActivationGuide } from '@/components/payouts/payouts-hub-activation-guide';
import { PayoutsNeedsAttentionStrip } from '@/components/payouts/payouts-needs-attention-strip';
import { PAYOUT_TRUST_COPY } from '@/lib/payouts/payout-trust-copy';
import {
  PAYOUTS_COMMISSIONS_HREF,
  PAYOUTS_OBLIGATIONS_HREF,
  PAYOUTS_SETTLEMENTS_HREF,
} from '@/lib/navigation/operator-nav';
import { cn } from '@/lib/utils';

const HUB_LINKS = [
  {
    title: 'Obligations',
    href: PAYOUTS_OBLIGATIONS_HREF,
    icon: FileCheck,
  },
  {
    title: 'Participant earnings',
    href: PAYOUTS_COMMISSIONS_HREF,
    icon: CircleDollarSign,
  },
  {
    title: 'Payout releases',
    href: PAYOUTS_SETTLEMENTS_HREF,
    icon: History,
  },
] as const;

export function PayoutsHubPage() {
  const { guidance } = useOperationalGuidance();
  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Payouts</h1>
        <p className="text-muted-foreground mt-2 max-w-2xl text-sm">
          Coordinate what is owed, what is ready, and what has been released to participants.
        </p>
      </div>

      <PayoutsNeedsAttentionStrip />

      <div className="space-y-4 pb-6 border-b border-border/60">
        <ReleaseConfidenceSummary confidence={guidance.releaseConfidence} />
        <ReleaseSimulationPreview confidence={guidance.releaseConfidence} />
      </div>

      <PayoutsHubActivationGuide />

      <nav className="divide-y divide-border/30" aria-label="Payout sections">
        {HUB_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              'group flex items-center justify-between gap-2 py-2.5',
              'transition-colors hover:text-foreground'
            )}
          >
            <span className="text-sm font-medium flex items-center gap-2 text-foreground/90">
              <link.icon className="h-3.5 w-3.5 text-muted-foreground/70" />
              {link.title}
            </span>
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />
          </Link>
        ))}
      </nav>

      <PayoutHowItWorksCard />

      <p className="text-xs text-muted-foreground/70">{PAYOUT_TRUST_COPY.hubFooter}</p>
    </div>
  );
}
