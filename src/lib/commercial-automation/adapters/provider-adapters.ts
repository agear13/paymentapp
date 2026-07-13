/**
 * Provider adapters — future integrations without modifying the automation engine.
 *
 * Each adapter normalizes provider-specific events into automation triggers/actions.
 */

import type { CommercialEventKind } from '@/lib/commercial/commercial-event-bus';
import {
  CommercialTriggerKind,
  type CommercialTrigger,
} from '@/lib/commercial-automation/types';
import { buildCommercialTrigger, triggerFromCommercialEvent } from '@/lib/commercial-automation/trigger-engine';

export type AutomationProviderKind =
  | 'stripe'
  | 'wise'
  | 'hashpack'
  | 'metamask'
  | 'xero'
  | 'quickbooks'
  | 'netsuite'
  | 'twilio'
  | 'resend'
  | 'slack'
  | 'zapier'
  | 'webhook';

export type ProviderAdapterRegistration = {
  provider: AutomationProviderKind;
  label: string;
  /** Trigger kinds this provider can emit. */
  triggerKinds: CommercialTriggerKind[];
  implemented: boolean;
};

const PROVIDER_ADAPTERS: ProviderAdapterRegistration[] = [
  { provider: 'stripe', label: 'Stripe', triggerKinds: [CommercialTriggerKind.PaymentReceived], implemented: false },
  { provider: 'wise', label: 'Wise', triggerKinds: [CommercialTriggerKind.PaymentReceived], implemented: false },
  { provider: 'hashpack', label: 'HashPack', triggerKinds: [CommercialTriggerKind.PaymentReceived], implemented: false },
  { provider: 'metamask', label: 'MetaMask', triggerKinds: [CommercialTriggerKind.PaymentReceived], implemented: false },
  { provider: 'xero', label: 'Xero', triggerKinds: [CommercialTriggerKind.InvoiceExported], implemented: false },
  { provider: 'quickbooks', label: 'QuickBooks', triggerKinds: [CommercialTriggerKind.InvoiceExported], implemented: false },
  { provider: 'netsuite', label: 'NetSuite', triggerKinds: [CommercialTriggerKind.InvoiceExported], implemented: false },
  { provider: 'twilio', label: 'Twilio', triggerKinds: [], implemented: false },
  { provider: 'resend', label: 'Resend', triggerKinds: [], implemented: false },
  { provider: 'slack', label: 'Slack', triggerKinds: [], implemented: false },
  { provider: 'zapier', label: 'Zapier', triggerKinds: [CommercialTriggerKind.Manual], implemented: false },
  { provider: 'webhook', label: 'Webhook', triggerKinds: [CommercialTriggerKind.Manual], implemented: false },
];

/** List all provider adapter registrations. */
export function listProviderAdapters(): ProviderAdapterRegistration[] {
  return PROVIDER_ADAPTERS;
}

/** Normalize provider webhook to automation trigger. Extension point. */
export function normalizeProviderWebhookToTrigger(
  provider: AutomationProviderKind,
  payload: Record<string, unknown>,
  context: { projectId: string; occurredAt: string }
): CommercialTrigger | null {
  const adapter = PROVIDER_ADAPTERS.find((a) => a.provider === provider);
  if (!adapter || adapter.triggerKinds.length === 0) return null;

  const kind = adapter.triggerKinds[0]!;
  return buildCommercialTrigger(kind, {
    occurredAt: context.occurredAt,
    projectId: context.projectId,
    metadata: { provider, payload },
  });
}

/** Normalize commercial event to trigger via adapter layer. */
export function normalizeCommercialEventToTrigger(
  eventKind: CommercialEventKind,
  context: Omit<CommercialTrigger, 'kind' | 'label'>
): CommercialTrigger | null {
  return triggerFromCommercialEvent(eventKind, context);
}
