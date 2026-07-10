'use client';

import * as React from 'react';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { ArrowDown, ArrowRight, ExternalLink } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { PaymentLifecyclePanel } from '@/components/payment-links/payment-lifecycle-panel';
import { TimelineLayerBadge } from '@/lib/workspace-timeline/timeline-layer-badge';
import { formatTimelineAmount } from '@/lib/workspace-timeline/timeline-layer-badges';
import { TIMELINE_LAYER_META } from '@/lib/workspace-timeline/timeline-layer-badges';
import type { WorkspaceTimelineEvent } from '@/lib/workspace-timeline/types';
import { projectOverviewPath } from '@/lib/projects/project-routes';

type TimelineEventDrawerProps = {
  event: WorkspaceTimelineEvent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function TimelineEventDrawer({ event, open, onOpenChange }: TimelineEventDrawerProps) {
  if (!event) return null;

  const amountLabel = formatTimelineAmount(event.amount, event.currency, event.direction);
  const showLifecycle = event.sourceEntity.kind === 'payment_link';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="pb-4">
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${TIMELINE_LAYER_META[event.layer].dotClass}`} />
            <TimelineLayerBadge layer={event.layer} />
          </div>
          <SheetTitle className="text-lg font-semibold pr-6">{event.title}</SheetTitle>
          <SheetDescription className="text-sm space-y-1">
            {event.subtitle && <span className="block text-muted-foreground">{event.subtitle}</span>}
            {amountLabel && <span className="font-semibold text-foreground">{amountLabel}</span>}
            <span className="block text-muted-foreground">
              {format(parseISO(event.date), 'd MMMM yyyy')}
            </span>
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5">
          <div className="rounded-lg border border-border/50 bg-muted/20 px-4 py-3 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">Why is this event here?</p>
            <p className="text-sm leading-relaxed">{event.explanation.whyThisMatters}</p>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Lineage
            </p>
            <div className="space-y-1 pl-1">
              {event.lineage.map((step, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  {i > 0 && <ArrowDown className="h-3 w-3 text-muted-foreground/50 rotate-180" />}
                  <span className="font-medium">{step.label}</span>
                  {step.layer && <TimelineLayerBadge layer={step.layer} />}
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Source
            </p>
            <p className="text-sm font-medium">{event.sourceEntity.label}</p>
            {event.projectName && (
              <p className="text-sm text-muted-foreground">
                Project · <span className="text-foreground font-medium">{event.projectName}</span>
              </p>
            )}
          </div>

          {(event.commercialLayer || event.accountingLayer || event.settlementLayer) && (
            <>
              <Separator />
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Financial context
                </p>
                <dl className="space-y-2 text-sm">
                  {event.commercialLayer && (
                    <div className="flex justify-between gap-2 items-center">
                      <dt className="flex items-center gap-1.5">
                        <TimelineLayerBadge layer="commercial" />
                      </dt>
                      <dd className="font-medium tabular-nums">
                        {event.commercialLayer.currency}{' '}
                        {Number(event.commercialLayer.amount).toLocaleString()}
                      </dd>
                    </div>
                  )}
                  {event.accountingLayer && (
                    <div className="flex justify-between gap-2 items-center">
                      <dt><TimelineLayerBadge layer="accounting" /></dt>
                      <dd className="font-medium tabular-nums">
                        {event.accountingLayer.currency}{' '}
                        {Number(event.accountingLayer.amount).toLocaleString()}
                      </dd>
                    </div>
                  )}
                  {event.settlementLayer && (
                    <div className="flex justify-between gap-2 items-center">
                      <dt><TimelineLayerBadge layer="settlement" /></dt>
                      <dd className="font-medium tabular-nums">
                        {event.settlementLayer.amount} {event.settlementLayer.currency}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
            </>
          )}

          {event.linkedEntities.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Linked entities
                </p>
                <div className="flex flex-wrap gap-2">
                  {event.linkedEntities.map((entity) =>
                    entity.href ? (
                      <Button key={`${entity.kind}-${entity.id}`} asChild variant="outline" size="sm" className="h-7 text-xs">
                        <Link href={entity.href}>{entity.label}</Link>
                      </Button>
                    ) : (
                      <span key={`${entity.kind}-${entity.id}`} className="text-xs text-muted-foreground">
                        {entity.label}
                      </span>
                    )
                  )}
                </div>
              </div>
            </>
          )}

          <div className="rounded-lg border border-border/40 px-4 py-3 space-y-2 text-sm">
            {event.explanation.commercialConsequence && (
              <p><span className="font-medium">Commercial · </span>{event.explanation.commercialConsequence}</p>
            )}
            {event.explanation.accountingConsequence && (
              <p><span className="font-medium">Accounting · </span>{event.explanation.accountingConsequence}</p>
            )}
            {event.explanation.settlementConsequence && (
              <p><span className="font-medium">Settlement · </span>{event.explanation.settlementConsequence}</p>
            )}
            {event.explanation.recommendedAction && (
              <p className="text-foreground font-medium pt-1">
                Recommended · {event.explanation.recommendedAction}
              </p>
            )}
          </div>

          {event.actions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {event.actions.map((action) => (
                <Button key={action.href} asChild size="sm" variant="outline" className="h-8 text-xs">
                  <Link href={action.href}>
                    {action.label}
                    <ExternalLink className="ml-1 h-3 w-3" />
                  </Link>
                </Button>
              ))}
              {event.projectId && (
                <Button asChild size="sm" className="h-8 text-xs">
                  <Link href={projectOverviewPath(event.projectId)}>
                    Open project
                    <ArrowRight className="ml-1 h-3 w-3" />
                  </Link>
                </Button>
              )}
            </div>
          )}

          {showLifecycle && (
            <>
              <Separator />
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  History
                </p>
                <PaymentLifecyclePanel
                  paymentLinkId={event.sourceEntity.id}
                  linkStatus={event.status}
                />
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
