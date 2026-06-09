import 'server-only';

import { trackAgreementAnalyzerEvent } from '@/lib/agreement-analyzer/analytics/agreement-analyzer-analytics.server';
import { getLeadAttributionAnalyticsProperties } from '@/lib/agreement-analyzer/attribution/lead-attribution.server';
import { parseCalendlyTrackingToken } from '@/lib/agreement-analyzer/calendly/calendly-attribution.server';
import type {
  CalendlyInviteeWebhookPayload,
  CalendlyWebhookBody,
} from '@/lib/agreement-analyzer/calendly/calendly-webhook-types';
import {
  createDemoBooking,
  findDemoBookingByCalendlyEventId,
} from '@/lib/agreement-analyzer/demo-bookings/demo-bookings.server';
import { markLeadDemoBookedFromCalendly } from '@/lib/agreement-analyzer/lead-lifecycle.server';
import { loggers } from '@/lib/logger';

const SIGNED_TOKEN_PATTERN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

function isSignedTrackingToken(value: string): boolean {
  return SIGNED_TOKEN_PATTERN.test(value.trim());
}

export function extractTrackingTokenFromCalendlyPayload(
  payload: CalendlyInviteeWebhookPayload
): string | null {
  const tracking = payload.tracking;
  const candidates = [
    tracking?.utm_content,
    tracking?.utm_term,
    tracking?.utm_campaign,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && isSignedTrackingToken(candidate)) {
      return candidate.trim();
    }
  }

  for (const entry of payload.questions_and_answers ?? []) {
    if (typeof entry.answer === 'string' && isSignedTrackingToken(entry.answer)) {
      return entry.answer.trim();
    }
  }

  return null;
}

export function extractCalendlyEventId(payload: CalendlyInviteeWebhookPayload): string | null {
  if (!payload.uri) return null;

  const normalized = payload.uri
    .replace(/^https?:\/\/[^/]+\//, '')
    .replace(/\/$/, '');

  return normalized.slice(0, 255) || null;
}

export async function processCalendlyInviteeCreated(
  payload: CalendlyInviteeWebhookPayload
): Promise<{ processed: boolean; reason?: string; duplicate?: boolean }> {
  const trackingToken = extractTrackingTokenFromCalendlyPayload(payload);
  if (!trackingToken) {
    return { processed: false, reason: 'missing_tracking_token' };
  }

  const attribution = parseCalendlyTrackingToken(trackingToken);
  if (!attribution) {
    return { processed: false, reason: 'invalid_tracking_token' };
  }

  const calendlyEventId = extractCalendlyEventId(payload);
  if (!calendlyEventId) {
    return { processed: false, reason: 'missing_calendly_event_id' };
  }

  const existing = await findDemoBookingByCalendlyEventId(calendlyEventId);
  if (existing) {
    return { processed: true, duplicate: true };
  }

  const meetingTimeRaw = payload.scheduled_event?.start_time;
  if (!meetingTimeRaw) {
    return { processed: false, reason: 'missing_meeting_time' };
  }

  const meetingTime = new Date(meetingTimeRaw);
  if (Number.isNaN(meetingTime.getTime())) {
    return { processed: false, reason: 'invalid_meeting_time' };
  }

  const inviteeName = payload.name?.trim() || 'Unknown';
  const inviteeEmail = payload.email?.trim() || 'unknown@calendly.local';

  const booking = await createDemoBooking({
    leadId: attribution.leadId,
    reportId: attribution.reportId,
    calendlyEventId,
    inviteeName,
    inviteeEmail,
    meetingTime,
    bookingSource: 'calendly_webhook',
    trackingToken,
  });

  await markLeadDemoBookedFromCalendly(attribution.leadId);

  const leadAttribution = await getLeadAttributionAnalyticsProperties(attribution.leadId);

  trackAgreementAnalyzerEvent('agreement_analyzer_demo_booked', {
    leadId: attribution.leadId,
    reportId: attribution.reportId,
    overallScore: attribution.overallScore,
    priorityBand: attribution.priorityBand,
    recommendedUseCase: attribution.recommendedUseCase,
    meetingTime: meetingTime.toISOString(),
    demoBookingId: booking.id,
    calendlyEventId,
    ...leadAttribution,
  });

  loggers.api.info('Agreement analyzer demo booked via Calendly', {
    leadId: attribution.leadId,
    reportId: attribution.reportId,
    demoBookingId: booking.id,
    calendlyEventId,
  });

  return { processed: true };
}

export async function processAgreementAnalyzerCalendlyWebhook(
  body: CalendlyWebhookBody
): Promise<{ processed: boolean; reason?: string; duplicate?: boolean }> {
  if (body.event !== 'invitee.created') {
    return { processed: false, reason: 'unsupported_event_type' };
  }

  if (!body.payload) {
    return { processed: false, reason: 'missing_payload' };
  }

  return processCalendlyInviteeCreated(body.payload);
}
