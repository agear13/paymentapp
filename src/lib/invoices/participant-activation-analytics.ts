/**
 * Participant invoice activation funnel — fire-and-forget observability.
 * Does not persist commercial amounts, customer details, or conversation text.
 */

import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';
import { isParticipantPortalInvoiceOrigin } from '@/lib/invoices/participant-invoice-activation';

export const PARTICIPANT_ACTIVATION_EVENTS = [
  'generate_invoice_clicked',
  'workspace_ready_activation_shown',
  'create_another_invoice_clicked',
] as const;

export type ParticipantActivationEvent = (typeof PARTICIPANT_ACTIVATION_EVENTS)[number];

export type ParticipantActivationProperties = {
  organizationId?: string | null;
  invoiceId?: string | null;
  invoiceOrigin?: string | null;
  hasConvertedOrganization?: boolean;
};

const ANALYTICS_ENDPOINT = '/api/invoices/activation-analytics';

/** Ordinary Workspace Create Invoice — no participant/agreement query context. */
export function ordinaryWorkspaceCreateInvoiceHref(): string {
  return COMMERCIAL_OS_ROUTES.createInvoice;
}

export function isParticipantPortalActivationSuccess(
  invoiceOrigin: string | null | undefined
): boolean {
  return isParticipantPortalInvoiceOrigin(invoiceOrigin);
}

/** Client-only funnel beacons. Server create events live on payment-link audit metadata. */
export function trackParticipantInvoiceActivation(
  event: ParticipantActivationEvent,
  properties?: ParticipantActivationProperties
): void {
  if (typeof window === 'undefined') return;

  const payload = {
    event,
    properties: properties ?? {},
    timestamp: new Date().toISOString(),
    path: window.location.pathname,
  };

  void fetch(ANALYTICS_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    keepalive: true,
    credentials: 'include',
  }).catch(() => {
    /* analytics must not block activation */
  });
}
