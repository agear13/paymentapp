'use client';

/**
 * CommercialTimeline
 *
 * The canonical commercial history component for all pages that display
 * commercial milestones.
 *
 * Design: git-history style — linear, scannable, chronological, commercial.
 *
 * Rules:
 *   - Show only commercial milestones (not system events).
 *   - Every item has: icon, title, description, commercial impact, date, optional actor.
 *   - No paragraphs. No technical metadata. No system jargon.
 *   - Call buildCommercialTimeline() before passing events here.
 */

import * as React from 'react';
import {
  CheckCircle2,
  FileCheck2,
  Users,
  Zap,
  TrendingUp,
  DollarSign,
  CreditCard,
  FileText,
  Upload,
  Gift,
  Handshake,
  CircleDot,
  Banknote,
  Eye,
  ClipboardCheck,
  UserCheck,
  Send,
  Building2,
  Wallet,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CommercialTimelineEvent, CommercialEventType } from '@/lib/commercial/commercial-timeline-events';
import { relativeTimeLabel } from '@/lib/commercial/commercial-timeline-events';

/* ─── Icon map ──────────────────────────────────────────────────────────────── */

const EVENT_ICONS: Record<CommercialEventType, React.ElementType> = {
  agreement_negotiated:           Handshake,
  agreement_generated:            FileText,
  agreement_sent:                 Send,
  agreement_viewed:               Eye,
  agreement_approved:             CheckCircle2,
  participant_added:              Users,
  earnings_configured:            DollarSign,
  payment_provider_connected:     CreditCard,
  revenue_received:               TrendingUp,
  revenue_confirmed:              TrendingUp,
  revenue_threshold_achieved:     TrendingUp,
  deposit_received:               Banknote,
  payment_evidence_uploaded:      Upload,
  forecast_updated:               TrendingUp,
  commercial_risk_resolved:       CheckCircle2,
  obligations_created:            FileText,
  obligations_funded:             DollarSign,
  invoice_requested:              FileText,
  invoice_received:               Upload,
  exported_to_xero:               Building2,
  payment_released:               Zap,
  settlement_complete:            Wallet,
  conditional_bonus_unlocked:     Gift,
  referral_commission_confirmed:  CircleDot,
  supplier_onboarding_requested:       Send,
  supplier_invoice_generated:          FileText,
  supplier_onboarding_started:           Eye,
  supplier_onboarding_completed:         ClipboardCheck,
  supplier_abn_verified:                 CheckCircle2,
  supplier_abn_manual_review:            FileCheck2,
  supplier_gst_confirmed:                CheckCircle2,
  supplier_alternative_payment_supplied: CreditCard,
  supplier_invoice_approved:             UserCheck,
  supplier_invoice_exported_to_xero:   Building2,
  payment_request_generated:             FileText,
  payment_request_opened:                Eye,
  payment_information_submitted:         ClipboardCheck,
  operator_review_started:               FileCheck2,
  operator_approved:                     UserCheck,
  xero_invoice_created:                  Building2,
  settlement_ready:                      Wallet,
};

const EVENT_ICON_COLOURS: Record<CommercialEventType, string> = {
  agreement_negotiated:           'text-blue-600 bg-blue-50',
  agreement_generated:            'text-slate-600 bg-slate-50',
  agreement_sent:                 'text-amber-600 bg-amber-50',
  agreement_viewed:               'text-slate-500 bg-slate-50',
  agreement_approved:             'text-green-600 bg-green-50',
  participant_added:              'text-blue-600 bg-blue-50',
  earnings_configured:            'text-purple-600 bg-purple-50',
  payment_provider_connected:     'text-indigo-600 bg-indigo-50',
  revenue_received:               'text-emerald-600 bg-emerald-50',
  revenue_confirmed:              'text-emerald-600 bg-emerald-50',
  revenue_threshold_achieved:     'text-emerald-700 bg-emerald-50',
  deposit_received:               'text-emerald-600 bg-emerald-50',
  payment_evidence_uploaded:      'text-blue-600 bg-blue-50',
  forecast_updated:               'text-slate-600 bg-slate-50',
  commercial_risk_resolved:       'text-amber-600 bg-amber-50',
  obligations_created:            'text-slate-600 bg-slate-50',
  obligations_funded:             'text-emerald-600 bg-emerald-50',
  invoice_requested:              'text-amber-600 bg-amber-50',
  invoice_received:               'text-blue-600 bg-blue-50',
  exported_to_xero:               'text-blue-700 bg-blue-50',
  payment_released:               'text-green-700 bg-green-50',
  settlement_complete:            'text-green-700 bg-green-50',
  conditional_bonus_unlocked:     'text-rose-600 bg-rose-50',
  referral_commission_confirmed:  'text-purple-600 bg-purple-50',
  supplier_onboarding_requested:       'text-amber-600 bg-amber-50',
  supplier_invoice_generated:          'text-slate-600 bg-slate-50',
  supplier_onboarding_started:           'text-blue-600 bg-blue-50',
  supplier_onboarding_completed:         'text-blue-600 bg-blue-50',
  supplier_abn_verified:                 'text-green-600 bg-green-50',
  supplier_abn_manual_review:            'text-amber-600 bg-amber-50',
  supplier_gst_confirmed:                'text-green-600 bg-green-50',
  supplier_alternative_payment_supplied: 'text-indigo-600 bg-indigo-50',
  supplier_invoice_approved:             'text-green-600 bg-green-50',
  supplier_invoice_exported_to_xero:   'text-blue-700 bg-blue-50',
  payment_request_generated:             'text-slate-600 bg-slate-50',
  payment_request_opened:                'text-blue-600 bg-blue-50',
  payment_information_submitted:         'text-blue-600 bg-blue-50',
  operator_review_started:               'text-amber-600 bg-amber-50',
  operator_approved:                     'text-green-600 bg-green-50',
  xero_invoice_created:                  'text-blue-700 bg-blue-50',
  settlement_ready:                      'text-green-700 bg-green-50',
};

/* ─── Props ─────────────────────────────────────────────────────────────────── */

export type CommercialTimelineProps = {
  events: CommercialTimelineEvent[];
  className?: string;
  /** Maximum number of events to display. Default: 20. */
  maxItems?: number;
  /** Message shown when there are no events. Default: hidden. */
  emptyMessage?: string;
  /** When true, shows the commercialImpact for each event. Default: true. */
  showImpact?: boolean;
  /** When true, compresses the display for sidebar / card contexts. Default: false. */
  compact?: boolean;
};

/* ─── Component ─────────────────────────────────────────────────────────────── */

export function CommercialTimeline({
  events,
  className,
  maxItems = 20,
  emptyMessage,
  showImpact = true,
  compact = false,
}: CommercialTimelineProps) {
  const visible = events.slice(0, maxItems);

  if (visible.length === 0) {
    if (!emptyMessage) return null;
    return (
      <p className="text-sm text-muted-foreground py-2">{emptyMessage}</p>
    );
  }

  return (
    <div className={cn('relative', className)}>
      {/* Vertical line */}
      <div
        aria-hidden
        className="absolute left-[18px] top-0 bottom-0 w-px bg-border/50"
      />

      <ol className="space-y-0">
        {visible.map((event, idx) => (
          <CommercialTimelineItem
            key={event.id}
            event={event}
            isLast={idx === visible.length - 1}
            showImpact={showImpact}
            compact={compact}
          />
        ))}
      </ol>

      {events.length > maxItems && (
        <p className="mt-4 ml-10 text-xs text-muted-foreground">
          {events.length - maxItems} earlier events hidden.
        </p>
      )}
    </div>
  );
}

/* ─── Single event item ─────────────────────────────────────────────────────── */

function CommercialTimelineItem({
  event,
  isLast,
  showImpact,
  compact,
}: {
  event: CommercialTimelineEvent;
  isLast: boolean;
  showImpact: boolean;
  compact: boolean;
}) {
  const Icon = EVENT_ICONS[event.type] ?? CircleDot;
  const colours = EVENT_ICON_COLOURS[event.type] ?? 'text-muted-foreground bg-muted';

  return (
    <li className={cn('relative flex gap-3', compact ? 'py-2.5' : 'py-3.5')}>
      {/* Icon node */}
      <div
        className={cn(
          'relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
          colours
        )}
      >
        <Icon className="h-4 w-4" aria-hidden />
      </div>

      {/* Content */}
      <div className={cn('flex-1 min-w-0', !isLast && 'pb-1')}>
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <p className={cn('font-medium text-foreground leading-snug', compact ? 'text-sm' : 'text-sm')}>
            {event.title}
          </p>
          <time
            dateTime={event.occurredAt}
            className="shrink-0 text-xs text-muted-foreground tabular-nums"
            title={new Date(event.occurredAt).toLocaleString()}
          >
            {relativeTimeLabel(event.occurredAt)}
          </time>
        </div>

        {/* Description */}
        <p className="mt-0.5 text-sm text-muted-foreground leading-snug">
          {event.description}
        </p>

        {/* Commercial impact */}
        {showImpact && !compact && event.commercialImpact && (
          <p className="mt-1 text-xs text-muted-foreground/75 italic leading-snug">
            {event.commercialImpact}
          </p>
        )}
      </div>
    </li>
  );
}

/* ─── Participant commercial history (compact journey) ──────────────────────── */

import type { ParticipantCommercialJourneyStep } from '@/lib/commercial/commercial-timeline-events';
import { Check } from 'lucide-react';

export type ParticipantCommercialHistoryProps = {
  journey: ParticipantCommercialJourneyStep[];
  className?: string;
};

/**
 * Renders a compact "Negotiated → Approved → Paid" style progression
 * for individual participant cards.
 */
export function ParticipantCommercialHistory({
  journey,
  className,
}: ParticipantCommercialHistoryProps) {
  // Only show stages that have been completed or the next pending one
  const completedCount = journey.filter((s) => s.completed).length;
  if (completedCount === 0) return null;

  // Show all completed + the next pending (up to a max of 5 for readability)
  const visible = journey
    .filter((s, idx) => s.completed || idx === completedCount)
    .slice(0, 5);

  return (
    <div className={cn('flex items-center gap-1 flex-wrap', className)}>
      {visible.map((step, idx) => (
        <React.Fragment key={step.stage}>
          <div
            className={cn(
              'flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
              step.completed
                ? 'bg-green-50 text-green-700'
                : 'bg-muted text-muted-foreground'
            )}
          >
            {step.completed && <Check className="h-2.5 w-2.5" />}
            {step.label}
          </div>
          {idx < visible.length - 1 && (
            <span className="text-muted-foreground/50 text-xs">→</span>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}
