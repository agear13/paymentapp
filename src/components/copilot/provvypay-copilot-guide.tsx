'use client';

import * as React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Sparkles } from 'lucide-react';
import {
  getCollectionStyleNote,
  getWorkflowRecommendation,
  type CopilotWorkflowContext,
} from '@/lib/copilot/workflow-recommendations';

export type CopilotGuideTopic = 'stripe' | 'wise' | 'hedera' | 'provider_choice';

type GuideContent = {
  title: string;
  body: string;
  steps: string[];
  footerNote: string;
  externalLabel?: string;
  externalHref?: string;
};

const GUIDE_CONTENT: Record<CopilotGuideTopic, GuideContent> = {
  stripe: {
    title: 'Connecting Stripe',
    body: 'Stripe allows you to accept card payments and coordinate payout flows.',
    steps: [
      'Create or log into Stripe',
      'Open Stripe Connect settings',
      'Copy your account ID (starts with acct_)',
      'Paste it into Provvypay',
    ],
    footerNote: 'Best for card payments, invoices, and customer checkout.',
    externalLabel: 'Open Stripe',
    externalHref: 'https://stripe.com',
  },
  wise: {
    title: 'Connecting Wise',
    body: 'Wise is useful for international bank transfer payouts and contractor settlements.',
    steps: [
      'Log into Wise Business',
      'Open profile settings',
      'Copy your Wise profile ID',
      'Paste it into Provvypay',
    ],
    footerNote: 'Best for international bank payouts with lower FX costs.',
    externalLabel: 'Open Wise',
    externalHref: 'https://wise.com',
  },
  hedera: {
    title: 'Connecting Hedera',
    body: 'Hedera can be used for digital asset settlement and stablecoin payout infrastructure.',
    steps: [
      'Open your Hedera wallet',
      'Copy your account ID (0.0.xxxxx)',
      'Paste it into Provvypay',
    ],
    footerNote: 'Best for programmable settlement and digital asset workflows.',
    externalLabel: 'Open Hedera',
    externalHref: 'https://hedera.com',
  },
  provider_choice: {
    title: 'Choosing payment providers',
    body: 'Provvypay Co-Pilot can recommend payout setups based on your workflow, countries, contractors, and settlement needs.',
    steps: [
      'Describe your participants and where they are paid',
      'Note which currencies and settlement speeds you need',
      'Co-Pilot suggests Stripe, Wise, Hedera, or manual recording options',
      'Connect providers when you are ready. Onboarding does not require them.',
    ],
    footerNote: 'You can configure providers anytime in Settings after entering your workspace.',
  },
};

type ProvvypayCopilotGuideProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  topic: CopilotGuideTopic | null;
  context?: CopilotWorkflowContext;
};

export function ProvvypayCopilotGuide({
  open,
  onOpenChange,
  topic,
  context = {},
}: ProvvypayCopilotGuideProps) {
  const content = topic ? GUIDE_CONTENT[topic] : null;
  const workflowRecommendation = getWorkflowRecommendation(context);
  const collectionStyleNote = getCollectionStyleNote(context);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md overflow-y-auto">
        {content ? (
          <>
            <SheetHeader>
              <div className="flex items-center gap-2 text-primary mb-1">
                <Sparkles className="h-4 w-4" />
                <span className="text-xs font-semibold uppercase tracking-wide">Provvypay Co-Pilot</span>
              </div>
              <SheetTitle>{content.title}</SheetTitle>
              <SheetDescription>{content.body}</SheetDescription>
            </SheetHeader>
            <div className="px-4 space-y-4">
              <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                  Recommended setup for your workflow
                </p>
                <p className="text-sm text-foreground/90">{workflowRecommendation}</p>
                {collectionStyleNote ? (
                  <p className="text-xs text-muted-foreground border-t pt-2">{collectionStyleNote}</p>
                ) : null}
              </div>
              <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                {content.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
              <p className="text-sm text-foreground/80 border-l-2 border-primary/30 pl-3">
                {content.footerNote}
              </p>
            </div>
            <SheetFooter className="flex-col sm:flex-col gap-2">
              {content.externalHref && content.externalLabel ? (
                <Button asChild variant="outline" className="w-full">
                  <Link href={content.externalHref} target="_blank" rel="noopener noreferrer">
                    {content.externalLabel}
                  </Link>
                </Button>
              ) : null}
              <Button type="button" variant="secondary" className="w-full" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </SheetFooter>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

type CopilotGuideLinkProps = {
  label?: string;
  onOpen: (topic: CopilotGuideTopic) => void;
  topic: CopilotGuideTopic;
};

export function CopilotGuideLink({ label = 'What is this?', onOpen, topic }: CopilotGuideLinkProps) {
  return (
    <button
      type="button"
      onClick={() => onOpen(topic)}
      className="text-xs text-primary hover:underline font-medium"
    >
      {label}
    </button>
  );
}
