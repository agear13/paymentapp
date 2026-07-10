'use client';

import * as React from 'react';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { ArrowRight, ExternalLink } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { PaymentLifecyclePanel } from '@/components/payment-links/payment-lifecycle-panel';
import { CALENDAR_CATEGORY_META } from '@/lib/calendar/calendar-styles';
import { formatCalendarAmount } from '@/lib/calendar/calendar-styles';
import type { CalendarEvent } from '@/lib/calendar/types';
import { projectOverviewPath } from '@/lib/projects/project-routes';

type CalendarEventDrawerProps = {
  event: CalendarEvent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function sourceLabel(sourceType: CalendarEvent['sourceType']): string {
  const labels: Record<CalendarEvent['sourceType'], string> = {
    invoice: 'Invoice',
    payment_link: 'Payment link',
    funding_source: 'Funding source',
    commercial_role: 'Commercial role',
    participant: 'Participant',
    obligation: 'Obligation',
    settlement: 'Revenue share',
    commercial_task: 'Operational task',
    project: 'Project',
    recurring: 'Recurring schedule',
    approval: 'Approval',
  };
  return labels[sourceType] ?? 'Source';
}

function SourceSection({ event }: { event: CalendarEvent }) {
  const meta = event.sourceMetadata;
  const rows: Array<{ label: string; value: string | null }> = [];

  if (event.sourceType === 'invoice' || event.sourceType === 'payment_link') {
    rows.push(
      { label: 'Invoice', value: meta.invoiceNumber ? String(meta.invoiceNumber) : null },
      { label: 'Created', value: meta.createdAt ? format(parseISO(String(meta.createdAt)), 'd MMM yyyy') : null },
      { label: 'Customer', value: meta.customer ? String(meta.customer) : null },
      { label: 'Due', value: meta.dueDate ? format(parseISO(String(meta.dueDate)), 'd MMMM') : null }
    );
  } else if (event.sourceType === 'commercial_role') {
    rows.push(
      { label: 'Role', value: meta.roleTitle ? String(meta.roleTitle) : null },
      { label: 'Budget', value: meta.budget ? String(meta.budget) : null },
      { label: 'Payment date', value: meta.paymentDate ? String(meta.paymentDate) : null }
    );
  } else if (event.sourceType === 'participant') {
    rows.push(
      { label: 'Participant', value: event.participantName },
      { label: 'Role', value: meta.role ? String(meta.role) : null },
      { label: 'Due', value: meta.payoutDueDate ? format(parseISO(String(meta.payoutDueDate)), 'd MMMM') : null }
    );
  } else if (event.sourceType === 'funding_source') {
    rows.push(
      { label: 'Type', value: meta.sourceType ? String(meta.sourceType) : null },
      { label: 'Expected', value: meta.expectedDate ? format(parseISO(String(meta.expectedDate)), 'd MMMM') : null },
      { label: 'Confidence', value: meta.confidence ? String(meta.confidence) : null }
    );
  } else {
    for (const [key, value] of Object.entries(meta)) {
      if (value == null) continue;
      rows.push({ label: key.replace(/([A-Z])/g, ' $1').trim(), value: String(value) });
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Source</p>
      <p className="text-sm font-medium">{sourceLabel(event.sourceType)}</p>
      <dl className="space-y-1.5">
        {rows.filter((r) => r.value).map((row) => (
          <div key={row.label} className="flex justify-between gap-3 text-sm">
            <dt className="text-muted-foreground">{row.label}</dt>
            <dd className="font-medium text-right">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function LayersSection({ event }: { event: CalendarEvent }) {
  const { commercial, accounting, settlement } = {
    commercial: event.commercialLayer,
    accounting: event.accountingLayer,
    settlement: event.settlementLayer,
  };
  if (!commercial && !accounting && !settlement) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Financial context
      </p>
      <dl className="space-y-1.5 text-sm">
        {commercial && (
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Commercial</dt>
            <dd className="font-medium tabular-nums">
              {commercial.currency} {Number(commercial.amount).toLocaleString()}
            </dd>
          </div>
        )}
        {accounting && (
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Accounting</dt>
            <dd className="font-medium tabular-nums">
              {accounting.currency} {Number(accounting.amount).toLocaleString()}
            </dd>
          </div>
        )}
        {settlement && (
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Settlement</dt>
            <dd className="font-medium tabular-nums">
              {settlement.amount} {settlement.currency}
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
}

export function CalendarEventDrawer({ event, open, onOpenChange }: CalendarEventDrawerProps) {
  if (!event) return null;

  const category = CALENDAR_CATEGORY_META[event.type];
  const amountLabel = formatCalendarAmount(event.amount, event.currency, event.direction);
  const showLifecycle =
    event.sourceType === 'invoice' || event.sourceType === 'payment_link';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="pb-4">
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${category.dotClass}`} />
            <Badge variant="outline" className="text-[10px]">
              {category.label}
            </Badge>
          </div>
          <SheetTitle className="text-lg font-semibold pr-6">{event.title}</SheetTitle>
          <SheetDescription className="text-sm">
            {amountLabel && <span className="font-semibold text-foreground">{amountLabel}</span>}
            {amountLabel && ' · '}
            Due {format(parseISO(event.date), 'd MMMM yyyy')}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5">
          <div className="rounded-lg border border-border/50 bg-muted/20 px-4 py-3 space-y-2">
            <p className="text-xs text-muted-foreground">Why is this on my calendar?</p>
            <p className="text-sm leading-relaxed">
              This {category.label.toLowerCase()} is scheduled for{' '}
              <span className="font-medium">{format(parseISO(event.date), 'EEEE d MMMM')}</span>
              {event.projectName ? (
                <>
                  {' '}
                  as part of <span className="font-medium">{event.projectName}</span>.
                </>
              ) : (
                '.'
              )}
            </p>
          </div>

          <SourceSection event={event} />

          {event.projectName && (
            <>
              <Separator />
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Related project
                </p>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">{event.projectName}</p>
                    <p className="text-xs text-muted-foreground capitalize">{event.status}</p>
                  </div>
                  {event.projectId && (
                    <Button asChild variant="outline" size="sm" className="h-7 text-xs">
                      <Link href={projectOverviewPath(event.projectId)}>
                        Open project
                        <ArrowRight className="ml-1 h-3 w-3" />
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}

          <LayersSection event={event} />

          {event.actions.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Actions
                </p>
                <div className="flex flex-wrap gap-2">
                  {event.actions.map((action) => (
                    <Button
                      key={action.href}
                      asChild
                      variant={action.variant ?? 'outline'}
                      size="sm"
                      className="h-8 text-xs"
                    >
                      <Link href={action.href}>
                        {action.label}
                        <ExternalLink className="ml-1 h-3 w-3" />
                      </Link>
                    </Button>
                  ))}
                </div>
              </div>
            </>
          )}

          {showLifecycle && (
            <>
              <Separator />
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Timeline
                </p>
                <PaymentLifecyclePanel
                  paymentLinkId={event.sourceId}
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
