/**
 * Workflow Engine — automation updates commercial workflows without duplicating state.
 *
 * Consumes existing workflow projections; returns workflow effect descriptors only.
 */

import type { CommercialEventKind } from '@/lib/commercial/commercial-event-bus';
import {
  CommercialActionKind,
  type ActionExecutionResult,
  type CommercialAutomationInput,
} from '@/lib/commercial-automation/types';

export type WorkflowEffectDescriptor = {
  workflow: 'commercial' | 'settlement' | 'accounting';
  effect: 'advance' | 'refresh' | 'no_change';
  targetState?: string | null;
  participantId?: string | null;
  message: string;
};

/** Map action to workflow effect — does not mutate workflow state. */
export function deriveWorkflowEffectFromAction(
  action: ActionExecutionResult,
  input: CommercialAutomationInput
): WorkflowEffectDescriptor | null {
  switch (action.kind) {
    case CommercialActionKind.ReleaseSettlement:
      return {
        workflow: 'settlement',
        effect: 'advance',
        targetState: 'PROCESSING',
        participantId: input.trigger.participantId ?? null,
        message: 'Settlement release initiated by automation',
      };

    case CommercialActionKind.OpenSettlement:
      return {
        workflow: 'settlement',
        effect: 'advance',
        targetState: 'INITIATED',
        participantId: input.trigger.participantId ?? null,
        message: 'Settlement opened by automation',
      };

    case CommercialActionKind.QueueAccountingExport:
      return {
        workflow: 'accounting',
        effect: 'advance',
        targetState: 'QUEUED',
        participantId: input.trigger.participantId ?? null,
        message: 'Accounting export queued by automation',
      };

    case CommercialActionKind.ExportInvoice:
      return {
        workflow: 'accounting',
        effect: 'advance',
        targetState: 'EXPORTED',
        message: 'Invoice export triggered by automation',
      };

    case CommercialActionKind.UpdateWorkflowState:
      return {
        workflow: 'commercial',
        effect: 'advance',
        message: 'Commercial workflow updated by automation',
      };

    case CommercialActionKind.RefreshParticipantWorkspace:
      return {
        workflow: 'commercial',
        effect: 'refresh',
        participantId: input.trigger.participantId ?? null,
        message: 'Participant workspace refreshed by automation',
      };

    default:
      return null;
  }
}

/** Map automation action to commercial event bus kind for downstream processing. */
export function commercialEventKindFromAction(
  action: CommercialActionKind
): CommercialEventKind | null {
  const mapping: Partial<Record<CommercialActionKind, CommercialEventKind>> = {
    [CommercialActionKind.GenerateInvoice]: 'invoice_requested',
    [CommercialActionKind.ExportInvoice]: 'invoice_exported',
    [CommercialActionKind.ReleaseSettlement]: 'payment_released',
    [CommercialActionKind.QueueAccountingExport]: 'invoice_exported',
    [CommercialActionKind.InviteParticipantWorkspace]: 'supplier_onboarding_started',
    [CommercialActionKind.RequestPayoutDetails]: 'supplier_onboarding_started',
  };
  return mapping[action] ?? null;
}

/** Derive all workflow effects from executed actions. */
export function deriveWorkflowEffects(
  actions: ActionExecutionResult[],
  input: CommercialAutomationInput
): WorkflowEffectDescriptor[] {
  return actions
    .map((a) => deriveWorkflowEffectFromAction(a, input))
    .filter((e): e is WorkflowEffectDescriptor => e !== null);
}
