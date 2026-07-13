/**
 * Trigger Engine — register and resolve commercial automation triggers.
 *
 * Future integrations register new triggers without modifying the engine.
 */

import type { CommercialEventKind } from '@/lib/commercial/commercial-event-bus';
import {
  COMMERCIAL_EVENT_TO_TRIGGER,
  COMMERCIAL_TRIGGER_LABELS,
  CommercialTriggerKind,
  type CommercialTrigger,
} from '@/lib/commercial-automation/types';

export type TriggerRegistration = {
  kind: CommercialTriggerKind;
  label: string;
  description: string;
};

const BUILTIN_TRIGGERS: TriggerRegistration[] = Object.values(CommercialTriggerKind).map(
  (kind) => ({
    kind,
    label: COMMERCIAL_TRIGGER_LABELS[kind],
    description: `Automation trigger: ${COMMERCIAL_TRIGGER_LABELS[kind]}`,
  })
);

const customTriggers = new Map<CommercialTriggerKind, TriggerRegistration>();

/** Register a custom trigger (for future integrations). */
export function registerCommercialTrigger(registration: TriggerRegistration): void {
  customTriggers.set(registration.kind, registration);
}

/** List all registered triggers. */
export function listCommercialTriggers(): TriggerRegistration[] {
  return [...BUILTIN_TRIGGERS, ...customTriggers.values()];
}

/** Resolve trigger from commercial event bus kind. */
export function triggerFromCommercialEvent(
  eventKind: CommercialEventKind,
  context: Omit<CommercialTrigger, 'kind' | 'label'>
): CommercialTrigger | null {
  const kind = COMMERCIAL_EVENT_TO_TRIGGER[eventKind];
  if (!kind) return null;

  return {
    kind,
    label: COMMERCIAL_TRIGGER_LABELS[kind],
    ...context,
  };
}

/** Build a trigger instance. */
export function buildCommercialTrigger(
  kind: CommercialTriggerKind,
  context: Omit<CommercialTrigger, 'kind' | 'label'>
): CommercialTrigger {
  return {
    kind,
    label: COMMERCIAL_TRIGGER_LABELS[kind],
    ...context,
  };
}

/** Check if a trigger kind is registered. */
export function isRegisteredTrigger(kind: CommercialTriggerKind): boolean {
  return (
    BUILTIN_TRIGGERS.some((t) => t.kind === kind) || customTriggers.has(kind)
  );
}
