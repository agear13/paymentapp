/** @jest-environment jsdom */

import {
  captureInvoiceActivationIntentFromSearchParams,
  clearStoredInvoiceActivationIntent,
  consumePostProvisioningDestination,
  persistInvoiceActivationIntent,
  readStoredInvoiceActivationNext,
} from '@/lib/journey/journey-invoice-activation.client';
import {
  persistSourceParticipantHint,
  readStoredSourceParticipantHint,
} from '@/lib/journey/journey-source-participant.client';

describe('generate-invoice intent through provisioning', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it('persists intent and lands directly on agreement-origin Create Invoice after bootstrap', () => {
    persistInvoiceActivationIntent('p-sarah-1');
    expect(readStoredSourceParticipantHint()).toBe('p-sarah-1');
    expect(readStoredInvoiceActivationNext()).toBe(
      '/workspace/receivables/create?origin=participant_portal&sourceParticipantId=p-sarah-1'
    );

    const afterOauth = captureInvoiceActivationIntentFromSearchParams(
      new URLSearchParams({ build: '1' })
    );
    expect(afterOauth).toBe(
      '/workspace/receivables/create?origin=participant_portal&sourceParticipantId=p-sarah-1'
    );

    const next = consumePostProvisioningDestination();
    expect(next).toBe(
      '/workspace/receivables/create?origin=participant_portal&sourceParticipantId=p-sarah-1'
    );
    expect(readStoredInvoiceActivationNext()).toBeNull();
    expect(readStoredSourceParticipantHint()).toBe('p-sarah-1');
  });

  it('captures intent from the provisioning query and keeps it across build=1', () => {
    captureInvoiceActivationIntentFromSearchParams(
      new URLSearchParams({
        sourceParticipantId: 'p-sarah-1',
        intent: 'generate_invoice',
      })
    );
    expect(readStoredInvoiceActivationNext()).toContain('origin=participant_portal');

    const kept = captureInvoiceActivationIntentFromSearchParams(
      new URLSearchParams({ build: '1' })
    );
    expect(kept).toContain('sourceParticipantId=p-sarah-1');
  });

  it('does not persist commercial prefill payloads with the intent', () => {
    persistInvoiceActivationIntent('p-sarah-1');
    expect(sessionStorage.getItem('provvy.journey.invoiceActivationIntent')).toBe(
      'generate_invoice'
    );
    expect(sessionStorage.getItem('provvy.journey.invoiceActivationNext')).not.toContain('6000');
    expect(sessionStorage.getItem('provvy.journey.invoiceActivationNext')).not.toContain(
      'amount'
    );
    expect(sessionStorage.getItem('provvy.journey.participantPrefill')).toBeNull();
  });

  it('leaves ordinary provisioning on Workspace when no invoice intent is stored', () => {
    persistSourceParticipantHint('p-invite-1');
    expect(consumePostProvisioningDestination()).toBeNull();
    expect(readStoredSourceParticipantHint()).toBe('p-invite-1');
  });

  it('clears stored invoice intent', () => {
    persistInvoiceActivationIntent('p-sarah-1');
    clearStoredInvoiceActivationIntent();
    expect(readStoredInvoiceActivationNext()).toBeNull();
  });
});
