/**
 * Participant portal → Create Invoice activation (routing + copy only).
 * Commercial amounts are never encoded in these URLs or storage keys.
 */

import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';
import {
  parseSourceParticipantHint,
} from '@/lib/participants/source-participant-hint';
import { PARTICIPANT_PORTAL_INVOICE_ORIGIN } from '@/lib/invoices/agreement-invoice-prefill';

export const GENERATE_INVOICE_INTENT = 'generate_invoice';

export type InvoiceActivationCompensationKind = 'fixed' | 'variable';

export type ParticipantInvoiceActivationCopy = {
  heading: string;
  body: string;
  action: string;
};

export function isParticipantPortalInvoiceOrigin(origin: string | null | undefined): boolean {
  return origin === PARTICIPANT_PORTAL_INVOICE_ORIGIN;
}

export function participantPortalCreateInvoiceHref(participantId: string): string {
  const parsed = parseSourceParticipantHint(participantId);
  if (parsed.kind !== 'hint') return COMMERCIAL_OS_ROUTES.createInvoice;
  const params = new URLSearchParams();
  params.set('origin', PARTICIPANT_PORTAL_INVOICE_ORIGIN);
  params.set('sourceParticipantId', parsed.value);
  return `${COMMERCIAL_OS_ROUTES.createInvoice}?${params.toString()}`;
}

export function participantInvoiceProvisioningHref(participantId: string): string {
  const parsed = parseSourceParticipantHint(participantId);
  if (parsed.kind !== 'hint') {
    return `${COMMERCIAL_OS_ROUTES.provisioning}?intent=${GENERATE_INVOICE_INTENT}`;
  }
  const params = new URLSearchParams();
  params.set('sourceParticipantId', parsed.value);
  params.set('intent', GENERATE_INVOICE_INTENT);
  return `${COMMERCIAL_OS_ROUTES.provisioning}?${params.toString()}`;
}

export function participantInvoiceActivationHref(input: {
  sourceParticipantId: string;
  convertedOrganizationId?: string | null;
}): string {
  if (input.convertedOrganizationId?.trim()) {
    return participantPortalCreateInvoiceHref(input.sourceParticipantId);
  }
  return participantInvoiceProvisioningHref(input.sourceParticipantId);
}

export function shouldShowParticipantInvoiceActivationCta(input: {
  onboardingComplete: boolean;
  previewMode: boolean;
  sourceParticipantId?: string | null;
}): boolean {
  if (input.previewMode || !input.onboardingComplete) return false;
  return parseSourceParticipantHint(input.sourceParticipantId).kind === 'hint';
}

export function invoiceActivationCompensationKindFromSections(
  sections: Array<{ kind: string }>
): InvoiceActivationCompensationKind {
  const hasVariable = sections.some(
    (section) => section.kind === 'revenue_share' || section.kind === 'commission'
  );
  const hasFixed = sections.some((section) => section.kind === 'fixed_fee');
  if (hasVariable) return 'variable';
  if (hasFixed) return 'fixed';
  return 'variable';
}

export function participantInvoiceActivationCopy(
  kind: InvoiceActivationCompensationKind
): ParticipantInvoiceActivationCopy {
  if (kind === 'fixed') {
    return {
      heading: 'Need to get paid for this agreement?',
      body: 'Generate an invoice using the payment details already captured from your agreement.',
      action: 'Generate my invoice',
    };
  }
  return {
    heading: 'Create an invoice for this agreement',
    body: "We'll use the agreement details we can safely prefill. You'll need to confirm the final invoice amount.",
    action: 'Create invoice',
  };
}

export function isSafeInvoiceActivationDestination(path: string | null | undefined): boolean {
  if (!path?.trim()) return false;
  try {
    if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('//')) {
      return false;
    }
    const url = new URL(path, 'https://provvy.local');
    if (url.pathname !== COMMERCIAL_OS_ROUTES.createInvoice) return false;
    if (url.searchParams.get('origin') !== PARTICIPANT_PORTAL_INVOICE_ORIGIN) return false;
    return parseSourceParticipantHint(url.searchParams.get('sourceParticipantId')).kind === 'hint';
  } catch {
    return false;
  }
}
