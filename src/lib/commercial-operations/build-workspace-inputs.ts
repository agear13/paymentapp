/**
 * Build task engine inputs from persisted participants — integration glue only.
 */

import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import type { ParticipantTaskContext } from '@/lib/commercial/commercial-task-engine';
import { deriveInvoiceState } from '@/lib/commercial/invoice-lifecycle';
import { buildParticipantSettlementInput } from '@/lib/commercial/workflows/build-participant-workflow-inputs';
import { hasApprovedAgreement } from '@/lib/operations/primitives/participant-earnings-primitives';
import { deriveProjectWorkflows } from '@/lib/commercial/workflows/derive-participant-workflows';
import type { InvoiceAccountingStatusItem } from '@/lib/commercial-operations/types';

function mapFundingStatus(
  status: ReturnType<typeof buildParticipantSettlementInput>['funding']['status']
): ParticipantTaskContext['funding']['status'] {
  return status;
}

function mapXeroStatus(
  participant: DemoParticipant
): ParticipantTaskContext['accounting']['xeroStatus'] {
  const ps = participant.paymentSetup;
  if (!ps?.xeroExportedAt) return 'pending';
  if (ps.xeroSyncStatus?.toLowerCase() === 'synced') return 'exported';
  return ps.xeroExportedAt ? 'exported' : 'pending';
}

/** Map participants to task engine context — no new business rules. */
export function buildParticipantTaskContexts(
  participants: DemoParticipant[]
): ParticipantTaskContext[] {
  return participants.map((participant) => {
    const settlementInput = buildParticipantSettlementInput(participant);
    const invoice = settlementInput.invoice;
    const invoiceState = deriveInvoiceState({
      invoiceNotRequired: invoice.invoiceNotRequired,
      invoiceRequested: Boolean(invoice.invoiceDate ?? invoice.invoiceNumber),
      invoiceReceivedAt: invoice.invoiceDate ?? null,
      invoiceVerifiedAt: invoice.invoiceVerifiedAt ?? null,
      invoiceExportedAt: invoice.invoiceExportedAt ?? null,
      paymentReady: invoice.paymentReady,
    });

    return {
      participant: {
        id: participant.id,
        name: participant.name,
        role: participant.role,
        email: participant.email ?? null,
      },
      agreement: {
        approved: hasApprovedAgreement(participant),
        agreementGenerated: Boolean(participant.agreementUrl?.trim()),
        sentAt: participant.agreementSharedAt ?? null,
        earningsConfigured: Boolean(participant.commissionValue),
      },
      invoice: {
        state: invoiceState,
        requestedAt: invoice.invoiceDate ?? null,
        receivedAt: invoice.invoiceDate ?? null,
        invoiceDueDate: invoice.dueDate ?? null,
        invoiceAmount: invoice.invoiceAmount ?? null,
        obligationAmount: settlementInput.obligation.amount ?? null,
      },
      taxDetails: {
        abn: settlementInput.taxDetails.abn ?? null,
        gstRegistered: settlementInput.taxDetails.gstRegistered ?? null,
        abnValid: settlementInput.taxDetails.abnVerified,
      },
      bankDetails: {
        bsb: settlementInput.bankDetails.bsb ?? null,
        accountNumber: settlementInput.bankDetails.accountNumber ?? null,
        accountName: settlementInput.bankDetails.accountName ?? null,
        complete: Boolean(
          settlementInput.bankDetails.bsb && settlementInput.bankDetails.accountNumber
        ),
      },
      funding: {
        status: mapFundingStatus(settlementInput.funding.status),
      },
      accounting: {
        xeroStatus: mapXeroStatus(participant),
      },
      obligation: {
        amount: settlementInput.obligation.amount,
        currency: settlementInput.obligation.currency,
        type: settlementInput.obligation.type,
      },
    };
  });
}

/** Invoice and accounting status per participant from existing workflow projections. */
export function buildInvoiceAccountingStatus(
  participants: DemoParticipant[],
  projectId: string
): InvoiceAccountingStatusItem[] {
  const bundles = deriveProjectWorkflows({ projectId, participants }).participants;

  return bundles.map((bundle) => ({
    participantId: bundle.participantId,
    participantName:
      participants.find((p) => p.id === bundle.participantId)?.name ?? 'Participant',
    invoiceState: bundle.commercial.label,
    accountingState: bundle.accounting.label,
    settlementState: bundle.settlement.label,
  }));
}
